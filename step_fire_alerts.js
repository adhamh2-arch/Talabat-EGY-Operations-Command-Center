#!/usr/bin/env node
/**
 * step_fire_alerts.js
 *
 * Reads master_tracker.json for cases where email_required=true AND email_sent=false,
 * groups them by AM email, builds per-AM HTML email bodies, and writes
 * pending_drafts_YYYY-MM-DD.json to mcp_data/.
 *
 * In TEST MODE: all drafts redirect to testEmail with [TEST] subject prefix.
 * A separate stakeholder summary draft is always created.
 *
 * Special flag:
 *   --mark-sent  --vendor_key="name|cluster"  --thread_id="..."
 *                --recipient="email"  --date="YYYY-MM-DD"
 *
 * Usage:  node step_fire_alerts.js 2026-06-24
 *         node step_fire_alerts.js --mark-sent --vendor_key="X|Y" --thread_id="T" --recipient="a@b.com" --date="2026-06-24"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  loadMasterTracker,
  saveMasterTracker,
  appendCommunicationLog,
} from './lib/master_tracker_store.js';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config', 'agents.config.json');
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

if (!existsSync(MCP_DATA_DIR)) mkdirSync(MCP_DATA_DIR, { recursive: true });

const config   = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
const alertCfg = config.alerting;

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

// --mark-sent mode
if (args.includes('--mark-sent')) {
  const getArg = (name) => {
    const prefix = `--${name}=`;
    const found  = args.find(a => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const vendorKey = getArg('vendor_key');
  const threadId  = getArg('thread_id');
  const recipient = getArg('recipient');
  const date      = getArg('date');

  if (!vendorKey || !threadId || !date) {
    console.error('--mark-sent requires --vendor_key, --thread_id, and --date');
    process.exit(1);
  }

  const trackerData = loadMasterTracker();
  const c = trackerData.cases[vendorKey];
  if (!c) {
    console.error(`Vendor key not found: ${vendorKey}`);
    process.exit(1);
  }

  c.email_sent      = true;
  c.email_sent_date = date;
  c.email_thread_id = threadId;
  c.communication_status = 'awaiting_response';

  saveMasterTracker({ cases: trackerData.cases });

  appendCommunicationLog({
    vendor_key:  vendorKey,
    thread_id:   threadId,
    recipient:   recipient || c.am_email,
    date,
    action:      'email_sent',
  });

  console.log(JSON.stringify({ status: 'MARKED_SENT', vendor_key: vendorKey, thread_id: threadId, date }));
  process.exit(0);
}

// ── Normal mode ───────────────────────────────────────────────────────────────
const RUN_DATE = args[0];
if (!RUN_DATE) {
  console.error('Usage: node step_fire_alerts.js <YYYY-MM-DD>');
  process.exit(1);
}

// ── Load and filter active cases that need email ──────────────────────────────
const trackerData = loadMasterTracker();
const cases       = trackerData.cases;

const pending = Object.values(cases).filter(
  c => c.email_required === true && c.email_sent === false
);

if (pending.length === 0) {
  console.log(JSON.stringify({
    status:   'NO_ALERTS',
    run_date: RUN_DATE,
    message:  'No pending alerts.',
  }));
  process.exit(0);
}

// ── Group by AM email ─────────────────────────────────────────────────────────
const byAm = {};
for (const row of pending) {
  const email = row.am_email || 'unassigned';
  if (!byAm[email]) byAm[email] = [];
  byAm[email].push(row);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n)  { return Number(n || 0).toLocaleString('en-EG'); }
function fmtPct(n)  { return (parseFloat(n) || 0).toFixed(2) + '%'; }

function severityBadge(level) {
  const map = {
    Low:      '<span style="background:#4CAF50;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">LOW</span>',
    Medium:   '<span style="background:#FFB74D;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">MEDIUM</span>',
    High:     '<span style="background:#FF5A00;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">HIGH</span>',
    Critical: '<span style="background:#D32F2F;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">CRITICAL</span>',
    // legacy
    NEW:      '<span style="background:#4CAF50;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">NEW</span>',
    MEDIUM:   '<span style="background:#FFB74D;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">MEDIUM</span>',
    HIGH:     '<span style="background:#FF5A00;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">HIGH</span>',
    CRITICAL: '<span style="background:#D32F2F;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">CRITICAL</span>',
  };
  return map[level] || level || '—';
}

function subjectPrefix(rows) {
  const levels = rows.map(r => (r.recurrence_severity || '').toUpperCase());
  if (levels.includes('CRITICAL')) return alertCfg.emailSubjectPrefix?.CRITICAL || '🔴 [ESCALATION REQUIRED]';
  if (levels.includes('HIGH'))     return alertCfg.emailSubjectPrefix?.HIGH     || '🟠 [ACTION REQUIRED]';
  if (levels.includes('MEDIUM'))   return alertCfg.emailSubjectPrefix?.MEDIUM   || '🟡 [MONITOR]';
  return alertCfg.emailSubjectPrefix?.LOW || '⚪ [FYI]';
}

// ── Build per-AM HTML email ───────────────────────────────────────────────────
function buildAmEmail(amName, rows) {
  const tableRows = rows.map(r => `
    <tr>
      <td style="padding:8px;border:1px solid #e0e0e0">${r.vendor_name || r.chain_name || '—'}</td>
      <td style="padding:8px;border:1px solid #e0e0e0">${r.city || '—'}</td>
      <td style="padding:8px;border:1px solid #e0e0e0">${r.cluster || '—'}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:right">${fmtNum(r.last_failed_orders)}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:right">${fmtPct(r.last_fail_rate)}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:right">${fmtNum(r.last_lost_gmv)} EGP</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:right">${fmtNum(r.last_vendor_fault_cases)}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:center">${severityBadge(r.recurrence_severity)}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:center">${r.appearances || 1}x</td>
      <td style="padding:8px;border:1px solid #e0e0e0">${r.top_failure_reason || '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:900px;margin:0 auto">
  <div style="background:#FF5A00;padding:16px 24px;border-radius:8px 8px 0 0">
    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Talabat_logo.svg/200px-Talabat_logo.svg.png"
         alt="talabat" height="32" style="vertical-align:middle;margin-right:12px">
    <span style="color:#fff;font-size:18px;font-weight:bold;vertical-align:middle">
      Operations Alert — ${RUN_DATE}
    </span>
  </div>

  <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;padding:24px">
    <p>Hi ${amName || 'Account Manager'},</p>
    <p>The following vendors in your portfolio have been flagged for attention today.
       Please review and take the appropriate action.</p>

    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead>
        <tr style="background:#FF5A00;color:#fff">
          <th style="padding:10px;text-align:left;border:1px solid #cc4800">Vendor</th>
          <th style="padding:10px;text-align:left;border:1px solid #cc4800">City</th>
          <th style="padding:10px;text-align:left;border:1px solid #cc4800">Cluster</th>
          <th style="padding:10px;text-align:right;border:1px solid #cc4800">Failed Orders</th>
          <th style="padding:10px;text-align:right;border:1px solid #cc4800">Fail Rate</th>
          <th style="padding:10px;text-align:right;border:1px solid #cc4800">Lost GMV</th>
          <th style="padding:10px;text-align:right;border:1px solid #cc4800">Fault Cases</th>
          <th style="padding:10px;text-align:center;border:1px solid #cc4800">Severity</th>
          <th style="padding:10px;text-align:center;border:1px solid #cc4800">Appearances</th>
          <th style="padding:10px;text-align:left;border:1px solid #cc4800">Top Reason</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div style="margin-top:24px;padding:16px;background:#FFF3E0;border-radius:6px;border-left:4px solid #FF5A00">
      <strong>Action Required:</strong> Please reach out to the flagged vendors within 24 hours
      to investigate root causes and align on improvement plans.
    </div>

    <p style="margin-top:24px;color:#666;font-size:12px">
      This is an automated alert from the talabat Egypt Operations Monitoring pipeline.<br>
      Date: ${RUN_DATE} | Generated at: ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;
}

// ── Build stakeholder summary email ──────────────────────────────────────────
function buildStakeholderEmail(allRows) {
  const totalVendors    = new Set(allRows.map(r => r.vendor_key)).size;
  const totalFailed     = allRows.reduce((s, r) => s + (r.last_failed_orders || 0), 0);
  const totalLostGmv    = allRows.reduce((s, r) => s + (r.last_lost_gmv || 0), 0);
  const totalFaultCases = allRows.reduce((s, r) => s + (r.last_vendor_fault_cases || 0), 0);

  const levelCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const r of allRows) {
    const s = r.recurrence_severity;
    if (s && levelCounts[s] !== undefined) levelCounts[s]++;
  }

  const amMap = {};
  for (const r of allRows) {
    const am = r.am_name || r.am_email || 'Unassigned';
    if (!amMap[am]) amMap[am] = { count: 0, totalFailed: 0 };
    amMap[am].count++;
    amMap[am].totalFailed += r.last_failed_orders || 0;
  }

  const amSummaryRows = Object.entries(amMap)
    .sort((a, b) => b[1].totalFailed - a[1].totalFailed)
    .map(([am, s]) => `<tr>
      <td style="padding:8px;border:1px solid #e0e0e0">${am}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:center">${s.count}</td>
      <td style="padding:8px;border:1px solid #e0e0e0;text-align:right">${fmtNum(s.totalFailed)}</td>
    </tr>`).join('');

  const detailRows = allRows.map(r => `<tr>
    <td style="padding:6px;border:1px solid #e0e0e0">${r.vendor_name || '—'}</td>
    <td style="padding:6px;border:1px solid #e0e0e0">${r.cluster}</td>
    <td style="padding:6px;border:1px solid #e0e0e0">${r.city || '—'}</td>
    <td style="padding:6px;border:1px solid #e0e0e0">${r.am_name || '—'}</td>
    <td style="padding:6px;border:1px solid #e0e0e0;text-align:right">${fmtNum(r.last_failed_orders)}</td>
    <td style="padding:6px;border:1px solid #e0e0e0;text-align:right">${fmtPct(r.last_fail_rate)}</td>
    <td style="padding:6px;border:1px solid #e0e0e0;text-align:right">${fmtNum(r.last_lost_gmv)} EGP</td>
    <td style="padding:6px;border:1px solid #e0e0e0;text-align:center">${severityBadge(r.recurrence_severity)}</td>
    <td style="padding:6px;border:1px solid #e0e0e0;text-align:center">${r.appearances || 1}x</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:1000px;margin:0 auto">
  <div style="background:#FF5A00;padding:16px 24px;border-radius:8px 8px 0 0">
    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Talabat_logo.svg/200px-Talabat_logo.svg.png"
         alt="talabat" height="32" style="vertical-align:middle;margin-right:12px">
    <span style="color:#fff;font-size:18px;font-weight:bold;vertical-align:middle">
      Daily Operations Summary — ${RUN_DATE}
    </span>
  </div>

  <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;padding:24px">
    <h2 style="color:#FF5A00;margin-top:0">Alert Summary</h2>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
      ${[
        ['Flagged Vendors', totalVendors, '#D32F2F'],
        ['Total Failed Orders', fmtNum(totalFailed), '#FF5A00'],
        ['Total Lost GMV', fmtNum(totalLostGmv) + ' EGP', '#FF8A50'],
        ['Total Fault Cases', fmtNum(totalFaultCases), '#FFB74D'],
      ].map(([label, val, color]) => `
        <div style="flex:1;min-width:160px;background:#FFF3E0;border-radius:8px;padding:16px;text-align:center;border-left:4px solid ${color}">
          <div style="font-size:22px;font-weight:bold;color:${color}">${val}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${label}</div>
        </div>`).join('')}
    </div>

    <div style="margin-bottom:24px">
      <strong>Severity Breakdown:</strong>&nbsp;&nbsp;
      ${Object.entries(levelCounts).map(([l, n]) => `${severityBadge(l)} <strong>${n}</strong>`).join('&nbsp;&nbsp;')}
    </div>

    <h3 style="color:#FF5A00">By Account Manager</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead>
        <tr style="background:#FF5A00;color:#fff">
          <th style="padding:8px;text-align:left">AM Name</th>
          <th style="padding:8px;text-align:center">Flagged Vendors</th>
          <th style="padding:8px;text-align:right">Total Failed</th>
        </tr>
      </thead>
      <tbody>${amSummaryRows}</tbody>
    </table>

    <h3 style="color:#FF5A00">Full Flagged Vendor Detail</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#FF5A00;color:#fff">
          <th style="padding:8px;text-align:left">Vendor</th>
          <th style="padding:8px;text-align:left">Cluster</th>
          <th style="padding:8px;text-align:left">City</th>
          <th style="padding:8px;text-align:left">AM</th>
          <th style="padding:8px;text-align:right">Failed</th>
          <th style="padding:8px;text-align:right">Fail Rate</th>
          <th style="padding:8px;text-align:right">Lost GMV</th>
          <th style="padding:8px;text-align:center">Severity</th>
          <th style="padding:8px;text-align:center">Appearances</th>
        </tr>
      </thead>
      <tbody>${detailRows}</tbody>
    </table>

    <p style="margin-top:24px;color:#666;font-size:12px">
      Automated summary from talabat Egypt Operations Monitoring pipeline.<br>
      Date: ${RUN_DATE} | Generated at: ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;
}

// ── Assemble drafts ───────────────────────────────────────────────────────────
const testMode  = alertCfg.testMode === true;
const testEmail = alertCfg.testEmail;
const sendMode  = alertCfg.sendMode === true ? true : false;
const drafts    = [];

for (const [amEmail, rows] of Object.entries(byAm)) {
  if (amEmail === 'unassigned' || !amEmail.includes('@')) continue;

  const amName  = rows[0].am_name || amEmail;
  const prefix  = subjectPrefix(rows);
  const subject = (testMode ? '[TEST] ' : '') +
    `${prefix} Vendor Alerts for Your Portfolio — ${RUN_DATE} (${rows.length} vendor${rows.length !== 1 ? 's' : ''})`;
  const body    = buildAmEmail(amName, rows);
  const to      = testMode ? testEmail : amEmail;

  drafts.push({
    type:         'am_alert',
    to,
    real_to:      amEmail,
    am_name:      amName,
    subject,
    body_html:    body,
    vendor_count: rows.length,
    vendor_ids:   rows.map(r => r.vendor_key?.split('|')[0] || ''),
    vendor_keys:  rows.map(r => r.vendor_key),
    send_mode:    sendMode,
  });
}

// Stakeholder summary
const stakePrefix  = subjectPrefix(pending);
const stakeSubject = (testMode ? '[TEST] ' : '') +
  `${stakePrefix} Daily Ops Summary — ${RUN_DATE} — ${pending.length} Alerts`;

drafts.push({
  type:         'stakeholder_summary',
  to:           alertCfg.stakeholderEmail,
  real_to:      alertCfg.stakeholderEmail,
  am_name:      'Adham',
  subject:      stakeSubject,
  body_html:    buildStakeholderEmail(pending),
  vendor_count: pending.length,
  vendor_ids:   pending.map(r => r.vendor_key?.split('|')[0] || ''),
  vendor_keys:  pending.map(r => r.vendor_key),
  send_mode:    sendMode,
});

// ── Write output ──────────────────────────────────────────────────────────────
const outFile = join(MCP_DATA_DIR, `pending_drafts_${RUN_DATE}.json`);
writeFileSync(outFile, JSON.stringify({
  run_date:  RUN_DATE,
  test_mode: testMode,
  send_mode: sendMode,
  drafts,
}, null, 2));

console.log(JSON.stringify({
  status:          'SUCCESS',
  run_date:        RUN_DATE,
  test_mode:       testMode,
  send_mode:       sendMode,
  am_drafts:       drafts.filter(d => d.type === 'am_alert').length,
  total_drafts:    drafts.length,
  pending_vendors: pending.length,
  output_file:     `mcp_data/pending_drafts_${RUN_DATE}.json`,
}));
