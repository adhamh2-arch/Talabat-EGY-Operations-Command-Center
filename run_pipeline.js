#!/usr/bin/env node
/**
 * run_pipeline.js  (v2 — Master Tracker edition)
 *
 * 10-step orchestrator for the talabat EGY Operations daily pipeline.
 *
 * Usage:  node run_pipeline.js [YYYY-MM-DD]
 *         (defaults to today's date)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config', 'agents.config.json');
const MCP_DATA_DIR = join(__dirname, 'mcp_data');
const LOGS_DIR     = join(__dirname, 'logs');
const TRACKER_DIR  = join(__dirname, 'tracker');
const STATE_FILE   = join(__dirname, '.pipeline_state.json');

for (const dir of [LOGS_DIR, MCP_DATA_DIR, TRACKER_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ── Logging ───────────────────────────────────────────────────────────────────
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function log(level, msg) {
  const ts   = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  const logFile = join(LOGS_DIR, `pipeline_${getToday()}.log`);
  try { writeFileSync(logFile, line + '\n', { flag: 'a' }); } catch {}
}

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

function loadState() {
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')); } catch {}
  }
  return { lastRun: null, runCount: 0, history: [] };
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Step runner ───────────────────────────────────────────────────────────────
function runStep(name, fn, { blocking = true } = {}) {
  log('INFO', `Step: ${name} - STARTED`);
  const start = Date.now();
  try {
    const result  = fn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log('INFO', `Step: ${name} - COMPLETED (${elapsed}s)`);
    return { step: name, status: 'success', elapsed: +elapsed, result };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const msg     = err.message || String(err);
    log(blocking ? 'ERROR' : 'WARN', `Step: ${name} - ${blocking ? 'FAILED' : 'NON-BLOCKING FAILURE'} (${elapsed}s): ${msg}`);
    return { step: name, status: blocking ? 'failed' : 'skipped', elapsed: +elapsed, error: msg };
  }
}

// ── Step implementations ──────────────────────────────────────────────────────

function step1_validateConfig() {
  const config        = loadConfig();
  const clusters      = Object.keys(config.clusters);
  const agents        = Object.keys(config.agents);
  const enabledAgents = agents.filter(a => config.agents[a].enabled);
  if (clusters.length === 0)      throw new Error('No clusters configured');
  if (enabledAgents.length === 0) throw new Error('No enabled agents');
  return { clusters: clusters.length, enabledAgents: enabledAgents.length, agents: enabledAgents };
}

function step2_checkDataFiles(runDate) {
  const clusterFile = join(MCP_DATA_DIR, `cluster_data_${runDate}.json`);
  if (!existsSync(clusterFile)) {
    log('WARN', `No cluster data for ${runDate}. Data must be fetched via MCP bridge before pipeline runs.`);
    return { dataAvailable: false, file: `mcp_data/cluster_data_${runDate}.json` };
  }
  const data      = JSON.parse(readFileSync(clusterFile, 'utf-8'));
  const cityCount = data.today?.city_performance?.length || 0;
  const clusterKeys = [...new Set((data.today?.city_performance || []).map(c => c.cluster))];
  return { dataAvailable: true, cities: cityCount, clusters: clusterKeys };
}

function step3_runBridgeScoring(runDate) {
  const out = execSync(
    `node "${join(__dirname, 'mcp_bridge_runner.js')}" ${runDate}`,
    { encoding: 'utf-8', timeout: 60000 }
  );
  return JSON.parse(out.trim());
}

function step4_checkGmailMonitor(runDate) {
  const out = execSync(
    `node "${join(__dirname, 'step_gmail_monitor.js')}" ${runDate}`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(out.trim());
}

function step5_upsertMaster(runDate) {
  const out = execSync(
    `node "${join(__dirname, 'step_upsert_master.js')}" ${runDate}`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(out.trim());
}

function step6_generateRecommendations(runDate) {
  const out = execSync(
    `node "${join(__dirname, 'step_recommend.js')}" ${runDate}`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(out.trim());
}

function step7_fireAlerts(runDate) {
  const out = execSync(
    `node "${join(__dirname, 'step_fire_alerts.js')}" ${runDate}`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(out.trim());
}

function step8_prepareExport(runDate) {
  const out = execSync(
    `node "${join(__dirname, 'step_prepare_export.js')}" ${runDate}`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(out.trim());
}

function step9_validateResults(runDate) {
  // Check master_tracker.json
  const masterFile = join(TRACKER_DIR, 'master_tracker.json');
  if (!existsSync(masterFile)) throw new Error('master_tracker.json not found');

  const master = JSON.parse(readFileSync(masterFile, 'utf-8'));
  if (!master.cases || Object.keys(master.cases).length === 0) {
    throw new Error('master_tracker.json has no cases');
  }

  // Check scored_output
  const scoredFile = join(MCP_DATA_DIR, `scored_output_${runDate}.json`);
  if (!existsSync(scoredFile)) throw new Error(`scored_output_${runDate}.json not found`);

  const scored = JSON.parse(readFileSync(scoredFile, 'utf-8'));
  const issues = [];
  if (!scored.clusterResults || scored.clusterResults.length === 0) issues.push('No cluster results');
  if (!scored.summary) issues.push('No summary section');
  for (const cr of (scored.clusterResults || [])) {
    if (cr.vendorFailRate === undefined) issues.push(`Missing fail rate for ${cr.name}`);
  }

  const activeCases = Object.values(master.cases).filter(c => c.is_active).length;

  return {
    valid:          issues.length === 0,
    issues,
    totalCases:     Object.keys(master.cases).length,
    activeCases,
    clusters:       scored.clusterResults?.length || 0,
  };
}

function step10_generateReport(runDate) {
  const scoredFile = join(MCP_DATA_DIR, `scored_output_${runDate}.json`);
  const masterFile = join(TRACKER_DIR, 'master_tracker.json');
  const config     = loadConfig();

  const scored = JSON.parse(readFileSync(scoredFile, 'utf-8'));
  const master = JSON.parse(readFileSync(masterFile, 'utf-8'));
  const cases  = master.cases || {};

  // ── Tracker summary stats ─────────────────────────────────────────────────
  const allCases       = Object.values(cases);
  const activeCases    = allCases.filter(c => c.is_active);
  const newToday       = allCases.filter(c => c.first_detection_date === runDate && c.is_active);
  const flaggedEmail   = allCases.filter(c => c.email_required && c.is_active);
  const bySeverity     = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const c of activeCases) {
    if (bySeverity[c.recurrence_severity] !== undefined) bySeverity[c.recurrence_severity]++;
  }

  // Top 5 recurring offenders (highest severity + most appearances)
  const SEVERITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const top5 = [...activeCases]
    .sort((a, b) => {
      const sr = (SEVERITY_RANK[b.recurrence_severity] || 0) - (SEVERITY_RANK[a.recurrence_severity] || 0);
      if (sr !== 0) return sr;
      return (b.appearances || 0) - (a.appearances || 0);
    })
    .slice(0, 5);

  // Communication status
  const emailsSent     = allCases.filter(c => c.email_sent).length;
  const responsesRcvd  = allCases.filter(c => c.response_received).length;
  const pendingFollowup = allCases.filter(c => c.email_sent && !c.response_received).length;

  // ── Text report ───────────────────────────────────────────────────────────
  const reportLines = [
    '========================================',
    '  talabat EGY Operations Daily Report',
    `  Date: ${runDate}`,
    '========================================',
    '',
    'CLUSTER PERFORMANCE vs TARGETS',
    '─────────────────────────────────────',
  ];

  for (const cr of scored.clusterResults) {
    const status = cr.deviation > 0 ? 'ABOVE TARGET' : 'ON TARGET';
    const icon   = cr.deviation > 0 ? '[!]' : '[OK]';
    const dodStr = cr.dod.failedOrders > 0 ? `+${cr.dod.failedOrders}` : `${cr.dod.failedOrders}`;
    reportLines.push(`${icon} ${cr.name}: ${cr.vendorFailRate}% (target ${cr.targetLabel}) | ${status} | Risk: ${cr.riskLevel.toUpperCase()} (${cr.riskScore})`);
    reportLines.push(`    Failed: ${cr.failedOrders.toLocaleString()} | Lost GMV: ${cr.lostGmv.toLocaleString()} EGP | DoD Failed: ${dodStr}%`);
    if (cr.topOffenders.length > 0) {
      reportLines.push(`    Top offender: ${cr.topOffenders[0].vendor} (${cr.topOffenders[0].failedOrders} failed, ${cr.topOffenders[0].lostGmv.toLocaleString()} EGP lost)`);
    }
    if (cr.cities && cr.cities.length > 0) {
      reportLines.push('    Cities:');
      for (const city of cr.cities) {
        const flag = city.vendorFailRate > cr.target * 100 ? ' ◄' : '';
        reportLines.push(`      ${city.city.padEnd(28)} ${city.vendorFailRate.toFixed(4)}%  failed: ${city.failedOrders.toLocaleString()}  lost: ${city.lostGmv.toLocaleString()} EGP${flag}`);
      }
    }
    reportLines.push('');
  }

  reportLines.push('MASTER TRACKER SUMMARY');
  reportLines.push('─────────────────────────────────────');
  reportLines.push(`Active Cases:       ${activeCases.length}`);
  reportLines.push(`New Today:          ${newToday.length}`);
  reportLines.push(`Flagged for Email:  ${flaggedEmail.length}`);
  reportLines.push(`By Severity:        Critical=${bySeverity.Critical}  High=${bySeverity.High}  Medium=${bySeverity.Medium}  Low=${bySeverity.Low}`);
  reportLines.push('');
  reportLines.push('TOP 5 RECURRING OFFENDERS');
  reportLines.push('─────────────────────────────────────');
  for (const c of top5) {
    reportLines.push(`  [${c.recurrence_severity}] ${c.vendor_name} (${c.cluster}) — ${c.appearances}x appearances, ${c.consecutive_days} consecutive days`);
    reportLines.push(`    Last: ${c.last_failed_orders} failed, ${(c.last_lost_gmv || 0).toLocaleString()} EGP lost | Reason: ${c.top_failure_reason || '—'}`);
  }
  reportLines.push('');
  reportLines.push('COMMUNICATION STATUS');
  reportLines.push('─────────────────────────────────────');
  reportLines.push(`Emails Sent:       ${emailsSent}`);
  reportLines.push(`Responses Received: ${responsesRcvd}`);
  reportLines.push(`Pending Follow-ups: ${pendingFollowup}`);
  reportLines.push('');
  reportLines.push('SUMMARY');
  reportLines.push('─────────────────────────────────────');
  reportLines.push(`Total Orders:    ${scored.summary.totalAllOrders.toLocaleString()}`);
  reportLines.push(`Total Failed:    ${scored.summary.totalFailed.toLocaleString()}`);
  reportLines.push(`Total Lost GMV:  ${scored.summary.totalLostGmv.toLocaleString()} EGP`);
  reportLines.push(`Overall Fail Rate: ${scored.summary.overallFailRate}%`);
  if (scored.summary.clustersAboveTarget?.length > 0) {
    reportLines.push(`Clusters Above Target: ${scored.summary.clustersAboveTarget.join(', ')}`);
  }

  const report     = reportLines.join('\n');
  const reportFile = join(LOGS_DIR, `report_${runDate}.txt`);
  writeFileSync(reportFile, report);

  // ── HTML report ───────────────────────────────────────────────────────────
  const riskColor = { critical: '#D32F2F', high: '#FF5A00', medium: '#FFB74D', low: '#4CAF50' };

  const clusterRows = scored.clusterResults.map(cr => {
    const devColor = cr.deviation > 0 ? '#D32F2F' : '#4CAF50';
    const dodColor = cr.dod.failedOrders > 0 ? '#D32F2F' : '#4CAF50';
    const cityRows = (cr.cities || []).map(c => {
      const overTarget = c.vendorFailRate > cr.target * 100;
      return `<tr style="font-size:0.85em;background:${overTarget ? '#FFF3E0' : '#FAFAFA'}">
        <td style="padding:4px 8px 4px 32px;color:#555">${c.city}</td>
        <td style="padding:4px 8px;color:${overTarget ? '#D32F2F' : '#333'}">${c.vendorFailRate.toFixed(4)}%</td>
        <td style="padding:4px 8px">${c.failedOrders.toLocaleString()}</td>
        <td style="padding:4px 8px">${c.lostGmv.toLocaleString()} EGP</td>
        <td></td><td></td><td></td>
      </tr>`;
    }).join('');
    const offender = cr.topOffenders[0];
    return `<tr>
      <td style="padding:10px 8px;font-weight:600">${cr.name}</td>
      <td style="padding:10px 8px;color:${devColor};font-weight:600">${cr.vendorFailRate}%</td>
      <td style="padding:10px 8px">${cr.targetLabel}</td>
      <td style="padding:10px 8px;color:${devColor}">${cr.deviation > 0 ? '+' : ''}${cr.deviation.toFixed(2)}%</td>
      <td style="padding:10px 8px"><span style="background:${riskColor[cr.riskLevel]};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.85em">${cr.riskLevel.toUpperCase()} (${cr.riskScore})</span></td>
      <td style="padding:10px 8px;color:${dodColor}">${cr.dod.failedOrders > 0 ? '+' : ''}${cr.dod.failedOrders}%</td>
      <td style="padding:10px 8px;color:#555;font-size:0.85em">${offender ? offender.vendor : '—'}</td>
    </tr>${cityRows}`;
  }).join('');

  const kaRows = (scored.keyAccounts?.topOffenders || []).slice(0, 5).map(ka =>
    `<tr><td style="padding:8px">${ka.vendor}</td><td style="padding:8px">${ka.city || '—'}</td><td style="padding:8px">${ka.failedOrders}</td><td style="padding:8px">${(ka.lostGmv || 0).toLocaleString()} EGP</td></tr>`
  ).join('');

  const severityColors = { Critical: '#D32F2F', High: '#FF5A00', Medium: '#FFB74D', Low: '#4CAF50' };
  const top5Rows = top5.map(c =>
    `<tr>
      <td style="padding:8px">${c.vendor_name}</td>
      <td style="padding:8px">${c.cluster}</td>
      <td style="padding:8px;text-align:center">
        <span style="background:${severityColors[c.recurrence_severity] || '#999'};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.82em">
          ${c.recurrence_severity}
        </span>
      </td>
      <td style="padding:8px;text-align:center">${c.appearances}</td>
      <td style="padding:8px;text-align:center">${c.consecutive_days}</td>
      <td style="padding:8px;text-align:right">${(c.last_failed_orders || 0).toLocaleString()}</td>
      <td style="padding:8px;text-align:right">${(c.last_lost_gmv || 0).toLocaleString()} EGP</td>
      <td style="padding:8px">${c.top_failure_reason || '—'}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>talabat EGY Ops Report — ${runDate}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:24px;background:#F5F5F5;color:#212121}
  h1{color:#FF5A00;margin-bottom:4px}
  h2{color:#FF5A00;font-size:1em;margin:24px 0 8px}
  .summary-grid{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px}
  .card{background:#fff;border-radius:8px;padding:16px 24px;box-shadow:0 1px 4px rgba(0,0,0,.1);min-width:150px;flex:1}
  .card .value{font-size:1.6em;font-weight:700;color:#FF5A00}
  .card .label{font-size:0.8em;color:#666;margin-top:4px}
  .section{margin-bottom:32px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}
  th{background:#FF5A00;color:#fff;padding:10px 8px;text-align:left;font-size:0.9em}
  tr:nth-child(even){background:#FAFAFA}
  .tracker-strip{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
  .t-card{background:#fff;border-radius:8px;padding:12px 20px;box-shadow:0 1px 4px rgba(0,0,0,.1);min-width:130px;flex:1;border-top:3px solid #FF5A00}
  .t-card .val{font-size:1.5em;font-weight:700;color:#FF5A00}
  .t-card .lbl{font-size:0.78em;color:#666;margin-top:2px}
  .footer{margin-top:24px;color:#999;font-size:0.8em}
</style>
</head>
<body>
<h1>talabat EGY Operations Daily Report</h1>
<p style="color:#666;margin-top:0">Date: <strong>${runDate}</strong> &nbsp;|&nbsp; Generated by ${config.system.name} v${config.system.version}</p>

<div class="summary-grid">
  <div class="card"><div class="value">${scored.summary.totalAllOrders.toLocaleString()}</div><div class="label">Total Orders</div></div>
  <div class="card"><div class="value" style="color:#D32F2F">${scored.summary.totalFailed.toLocaleString()}</div><div class="label">Failed Orders</div></div>
  <div class="card"><div class="value" style="color:#D32F2F">${scored.summary.overallFailRate}%</div><div class="label">Overall Fail Rate</div></div>
  <div class="card"><div class="value" style="color:#D32F2F">${scored.summary.totalLostGmv.toLocaleString()}</div><div class="label">Lost GMV (EGP)</div></div>
  <div class="card"><div class="value" style="color:${scored.summary.criticalClusters > 0 ? '#D32F2F' : '#4CAF50'}">${scored.summary.criticalClusters}</div><div class="label">Critical Clusters</div></div>
  <div class="card"><div class="value" style="color:${scored.summary.highRiskClusters > 0 ? '#FF5A00' : '#4CAF50'}">${scored.summary.highRiskClusters}</div><div class="label">High Risk Clusters</div></div>
</div>

<h2>MASTER TRACKER SUMMARY</h2>
<div class="tracker-strip">
  <div class="t-card"><div class="val">${activeCases.length}</div><div class="lbl">Active Cases</div></div>
  <div class="t-card"><div class="val" style="color:#4CAF50">${newToday.length}</div><div class="lbl">New Today</div></div>
  <div class="t-card"><div class="val" style="color:#FF5A00">${flaggedEmail.length}</div><div class="lbl">Flagged for Email</div></div>
  <div class="t-card" style="border-top-color:#D32F2F"><div class="val" style="color:#D32F2F">${bySeverity.Critical}</div><div class="lbl">Critical</div></div>
  <div class="t-card" style="border-top-color:#FF5A00"><div class="val" style="color:#FF5A00">${bySeverity.High}</div><div class="lbl">High</div></div>
  <div class="t-card" style="border-top-color:#FFB74D"><div class="val" style="color:#FFB74D">${bySeverity.Medium}</div><div class="lbl">Medium</div></div>
  <div class="t-card" style="border-top-color:#4CAF50"><div class="val" style="color:#4CAF50">${bySeverity.Low}</div><div class="lbl">Low</div></div>
  <div class="t-card"><div class="val">${emailsSent}</div><div class="lbl">Emails Sent</div></div>
  <div class="t-card"><div class="val">${responsesRcvd}</div><div class="lbl">Responses</div></div>
  <div class="t-card" style="border-top-color:#FFB74D"><div class="val" style="color:#FF8A50">${pendingFollowup}</div><div class="lbl">Pending Follow-up</div></div>
</div>

<h2>CLUSTER PERFORMANCE vs TARGETS</h2>
<table>
  <thead><tr>
    <th>Cluster</th><th>Fail Rate</th><th>Target</th><th>Deviation</th>
    <th>Risk</th><th>DoD Failed</th><th>Top Offender</th>
  </tr></thead>
  <tbody>${clusterRows}</tbody>
</table>

<h2 style="margin-top:32px">TOP 5 RECURRING OFFENDERS</h2>
<table>
  <thead><tr>
    <th>Vendor</th><th>Cluster</th><th>Severity</th>
    <th style="text-align:center">Appearances</th><th style="text-align:center">Consec. Days</th>
    <th style="text-align:right">Failed</th><th style="text-align:right">Lost GMV</th>
    <th>Top Reason</th>
  </tr></thead>
  <tbody>${top5Rows}</tbody>
</table>

<h2 style="margin-top:32px">KEY ACCOUNTS TOP OFFENDERS</h2>
<table>
  <thead><tr><th>Vendor</th><th>City</th><th>Failed Orders</th><th>Lost GMV</th></tr></thead>
  <tbody>${kaRows}</tbody>
</table>

<div class="footer">Report generated by ${config.system.name}. Data source: ${scored.source || 'MCP Bridge'}.</div>
</body>
</html>`;

  const htmlFile = join(LOGS_DIR, `report_${runDate}.html`);
  writeFileSync(htmlFile, html);

  return { reportFile, htmlFile, activeCases: activeCases.length, newToday: newToday.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const runDate = process.argv[2] || getToday();
  const config  = loadConfig();

  log('INFO', '=== AUTONOMOUS PIPELINE STARTED (v2 Master Tracker) ===');
  log('INFO', `System: ${config.system.name} v${config.system.version}`);
  log('INFO', `Run Date: ${runDate}`);

  const state   = loadState();
  const runId   = `run_${Date.now()}`;
  const results = [];

  // Step 1 — BLOCKING
  results.push(runStep('1. Validate Config', () => step1_validateConfig()));

  // Step 2 — check data; abort if missing
  results.push(runStep('2. Check Data Files', () => step2_checkDataFiles(runDate)));
  if (!results[1].result?.dataAvailable) {
    log('ERROR', 'No cluster data available. Pipeline cannot proceed without MCP data.');
    log('INFO',  'Hint: Save data to mcp_data/cluster_data_<date>.json then re-run.');
    saveState({ ...state, lastRun: runDate, lastRunId: runId, lastStatus: 'NO_DATA',
      runCount: state.runCount + 1,
      history: [...(state.history || []).slice(-29), { runId, date: runDate, status: 'NO_DATA', timestamp: new Date().toISOString() }] });
    process.exit(1);
  }

  // Step 3 — BLOCKING
  results.push(runStep('3. Score Clusters',          () => step3_runBridgeScoring(runDate)));

  // Step 4 — NON-BLOCKING (Gmail monitor — pre-flight only)
  results.push(runStep('4. Check Gmail Monitor',     () => step4_checkGmailMonitor(runDate), { blocking: false }));

  // Step 5 — BLOCKING
  results.push(runStep('5. Upsert Master Tracker',   () => step5_upsertMaster(runDate)));
  if (results[4].status === 'failed') {
    log('ERROR', 'Upsert Master Tracker failed — aborting pipeline to protect data integrity.');
    process.exit(1);
  }

  // Step 6 — BLOCKING
  results.push(runStep('6. Generate Recommendations', () => step6_generateRecommendations(runDate)));
  if (results[5].status === 'failed') {
    log('ERROR', 'Generate Recommendations failed — aborting.');
    process.exit(1);
  }

  // Step 7 — NON-BLOCKING
  results.push(runStep('7. Fire Alerts',             () => step7_fireAlerts(runDate), { blocking: false }));

  // Step 8 — NON-BLOCKING
  results.push(runStep('8. Prepare Export',          () => step8_prepareExport(runDate), { blocking: false }));

  // Step 9 — BLOCKING (inline validation)
  results.push(runStep('9. Validate Results',        () => step9_validateResults(runDate)));

  // Step 10 — inline report generation
  results.push(runStep('10. Generate Report',        () => step10_generateReport(runDate)));

  // ── Summary ─────────────────────────────────────────────────────────────────
  const allPassed    = results.every(r => r.status === 'success' || r.status === 'skipped');
  const hardFailed   = results.filter(r => r.status === 'failed').length;
  const totalElapsed = results.reduce((s, r) => s + r.elapsed, 0);

  log('INFO', '');
  log('INFO', '=== PIPELINE SUMMARY ===');
  for (const r of results) {
    const icon = r.status === 'success' ? '✓' : r.status === 'skipped' ? '~' : '✗';
    log('INFO', `  ${icon} ${r.step}: ${r.status.toUpperCase()} (${r.elapsed}s)`);
  }
  log('INFO', `Total time: ${totalElapsed.toFixed(1)}s`);
  log('INFO', `Overall: ${hardFailed === 0 ? 'SUCCESS' : 'PARTIAL FAILURE'}`);
  log('INFO', '');
  log('INFO', 'Next: Upload export CSV to Google Sheets and send Gmail drafts via MCP tools.');
  log('INFO', '=== PIPELINE COMPLETED ===');

  const finalStatus = hardFailed === 0 ? 'SUCCESS' : 'PARTIAL_FAILURE';

  saveState({
    ...state,
    lastRun:    runDate,
    lastRunId:  runId,
    lastStatus: finalStatus,
    runCount:   state.runCount + 1,
    history: [...(state.history || []).slice(-29), {
      runId,
      date:      runDate,
      status:    finalStatus,
      steps:     results.map(r => ({ step: r.step, status: r.status })),
      elapsed:   totalElapsed,
      timestamp: new Date().toISOString(),
    }],
  });

  console.log(JSON.stringify({
    status:       finalStatus,
    runId,
    runDate,
    steps:        results.length,
    passed:       results.filter(r => r.status === 'success').length,
    skipped:      results.filter(r => r.status === 'skipped').length,
    failed:       hardFailed,
    totalElapsed,
  }));
}

main().catch(err => {
  log('ERROR', `Pipeline crashed: ${err.message}`);
  process.exit(1);
});
