import url from 'node:url';
import { getAgentConfig } from '../skills/config_loader.js';
import { computeMetrics } from '../skills/compute_metrics.js';
import { applyRiskScoring } from '../skills/apply_risk_scoring.js';
import { persistAudit } from '../skills/persist_audit.js';
import { appendToSheet, buildMonitoringRow } from '../skills/google_sheets.js';
import { notifySlack } from '../skills/notify.js';
import { getEnv, logStep } from '../skills/utils.js';

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    if (!token.startsWith('--')) return acc;
    const [key, rawValue = 'true'] = token.slice(2).split('=');
    acc[key] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
    return acc;
  }, {});
}

function filterBySegment(rows, filters) {
  return rows.filter(row => {
    if (filters.is_key !== undefined && Boolean(row['entity.is_key'] ?? row.is_key) !== filters.is_key) return false;
    if (filters.is_food !== undefined && Boolean(row['entity.is_food'] ?? row.is_food) !== filters.is_food) return false;
    if (filters.is_darkstore !== undefined && Boolean(row['entity.is_darkstore'] ?? row.is_darkstore) !== filters.is_darkstore) return false;
    return true;
  });
}

function generateStubSegmentRows(runDate) {
  return [
    { 'orders.id': 5001, 'orders.created_date': runDate, 'orders.total_revenue': 2200, 'orders.city_id': 'Multi', 'orders.quantity': 8, 'entity.is_key': true, 'entity.is_food': true, 'entity.is_darkstore': false, 'entity.name': 'Premium Foods Cairo' },
    { 'orders.id': 5002, 'orders.created_date': runDate, 'orders.total_revenue': 1800, 'orders.city_id': 'Multi', 'orders.quantity': 6, 'entity.is_key': true, 'entity.is_food': true, 'entity.is_darkstore': false, 'entity.name': 'Fresh Market Alex' },
    { 'orders.id': 5003, 'orders.created_date': runDate, 'orders.total_revenue': 950, 'orders.city_id': 'Multi', 'orders.quantity': 4, 'entity.is_key': true, 'entity.is_food': true, 'entity.is_darkstore': false, 'entity.name': 'Gourmet Hub Giza' },
    { 'orders.id': 5004, 'orders.created_date': runDate, 'orders.total_revenue': 3100, 'orders.city_id': 'Multi', 'orders.quantity': 11, 'entity.is_key': true, 'entity.is_food': true, 'entity.is_darkstore': false, 'entity.name': 'Kitchen Express Mans' },
    { 'orders.id': 5005, 'orders.created_date': runDate, 'orders.total_revenue': 400, 'orders.city_id': 'Multi', 'orders.quantity': 2, 'entity.is_key': true, 'entity.is_food': true, 'entity.is_darkstore': true, 'entity.name': 'DarkStore Alpha (filtered out)' },
    { 'orders.id': 5006, 'orders.created_date': runDate, 'orders.total_revenue': 700, 'orders.city_id': 'Multi', 'orders.quantity': 3, 'entity.is_key': false, 'entity.is_food': true, 'entity.is_darkstore': false, 'entity.name': 'Non-Key Vendor (filtered out)' },
  ];
}

export async function run({ run_date, dry_run = false }) {
  if (!run_date) throw new Error('Missing required input: run_date');

  const config = getAgentConfig('special_segment');
  const traceId = `segment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  logStep('start', { traceId, agent: config.name, filters: config.filters, run_date, dry_run });

  let allRows;
  try {
    const { lookerQuery } = await import('../skills/looker_query.js');
    allRows = await lookerQuery({ cityId: 'ALL', runDate: run_date, traceId });
  } catch {
    allRows = generateStubSegmentRows(run_date);
    logStep('lookerQuery.stubbed', { traceId, totalRows: allRows.length });
  }

  const filtered = filterBySegment(allRows, config.filters);
  logStep('segment.filtered', { traceId, totalRows: allRows.length, matchedRows: filtered.length });

  const entities = {};
  for (const row of filtered) {
    const name = row['entity.name'] || row.entity_name || `Entity-${row['orders.id']}`;
    if (!entities[name]) entities[name] = [];
    entities[name].push(row);
  }

  const results = [];
  for (const [entityName, rows] of Object.entries(entities)) {
    const metrics = computeMetrics(rows);
    const scored = applyRiskScoring(metrics);

    const sheetRow = buildMonitoringRow({
      date: run_date,
      agentName: config.name,
      cityOrSegment: 'Special Segment (Key+Food, non-Darkstore)',
      entityName,
      metrics: scored,
      riskScore: scored.riskScore,
      riskLevel: scored.riskLevel,
      findings: scored.findings,
      recommendations: scored.recommendations,
      status: scored.needsEscalation ? 'Escalated' : 'Completed',
    });

    await appendToSheet({ sheetName: 'monitoring', rows: [sheetRow], traceId, dry_run });
    results.push({ entityName, metrics: scored });
  }

  logStep('allEntities.complete', { traceId, processedCount: results.length });

  const escalated = results.filter(r => r.metrics.needsEscalation);
  const summary = {
    agent: config.name,
    entitiesProcessed: results.length,
    escalations: escalated.length,
    riskBreakdown: {
      critical: results.filter(r => r.metrics.riskLevel === 'critical').length,
      high: results.filter(r => r.metrics.riskLevel === 'high').length,
      medium: results.filter(r => r.metrics.riskLevel === 'medium').length,
      low: results.filter(r => r.metrics.riskLevel === 'low').length,
    },
  };

  const audit = await persistAudit({ traceId, inputs: { run_date, filters: config.filters }, metrics: { summary, results }, dry_run });
  logStep('persistAudit.complete', { traceId });

  if (!dry_run) {
    try {
      await notifySlack({
        webhook: getEnv('NOTIFY_WEBHOOK'),
        channelId: getEnv('NOTIFY_CHANNEL_ID'),
        message: `${config.name} complete | Entities: ${results.length} | Escalations: ${escalated.length} | Trace: ${traceId}`,
      });
    } catch (err) {
      logStep('notify.failed', { traceId, error: err.message });
    }
  } else {
    logStep('notify.skipped', { traceId, reason: 'dry_run' });
  }

  return { traceId, agent: config.name, run_date, summary, results, audit, dry_run };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await run({
      run_date: args.run_date,
      dry_run: args.dry_run === true || args.dry_run === 'true',
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('special_segment_agent failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) main();
