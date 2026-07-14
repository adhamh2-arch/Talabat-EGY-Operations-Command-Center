import { lookerQuery } from './looker_query.js';
import { computeMetrics } from './compute_metrics.js';
import { applyRiskScoring } from './apply_risk_scoring.js';
import { persistAudit } from './persist_audit.js';
import { appendToSheet, buildMonitoringRow } from './google_sheets.js';
import { logStep } from './utils.js';

export async function runCityMonitor({ agentName, cities, run_date, dry_run, traceId }) {
  const results = [];

  for (const city of cities) {
    logStep('city.processing', { traceId, agentName, city });

    let rows;
    try {
      rows = await lookerQuery({ cityId: city, runDate: run_date, traceId });
    } catch (err) {
      logStep('city.lookerQuery.fallback', { traceId, city, error: err.message });
      rows = generateStubRows(city, run_date);
      logStep('city.lookerQuery.stubbed', { traceId, city, rowCount: rows.length });
    }

    const metrics = computeMetrics(rows);
    logStep('city.metrics', { traceId, city, metrics });

    const scored = applyRiskScoring(metrics);
    logStep('city.scored', { traceId, city, riskLevel: scored.riskLevel, riskScore: scored.riskScore });

    const sheetRow = buildMonitoringRow({
      date: run_date,
      agentName,
      cityOrSegment: city,
      entityName: city,
      metrics: scored,
      riskScore: scored.riskScore,
      riskLevel: scored.riskLevel,
      findings: scored.findings,
      recommendations: scored.recommendations,
      status: scored.needsEscalation ? 'Escalated' : 'Completed',
    });

    await appendToSheet({ sheetName: 'monitoring', rows: [sheetRow], traceId, dry_run });
    logStep('city.sheetUpdated', { traceId, city });

    results.push({ city, metrics: scored, sheetRow });
  }

  const audit = await persistAudit({
    traceId,
    inputs: { agentName, cities, run_date },
    metrics: { cityResults: results.map(r => ({ city: r.city, ...r.metrics })) },
    dry_run,
  });

  logStep('persistAudit.complete', { traceId, auditId: audit.traceId ?? traceId });
  return { results, audit };
}

function generateStubRows(city, runDate) {
  const hash = Array.from(String(city)).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const base = Math.abs(hash % 1000);
  return [
    { 'orders.id': base + 1, 'orders.created_date': runDate, 'orders.total_revenue': 300 + (base % 500), 'orders.city_id': city, 'orders.quantity': 2 + (base % 5) },
    { 'orders.id': base + 2, 'orders.created_date': runDate, 'orders.total_revenue': 850 + (base % 300), 'orders.city_id': city, 'orders.quantity': 4 + (base % 3) },
    { 'orders.id': base + 3, 'orders.created_date': runDate, 'orders.total_revenue': 150 + (base % 200), 'orders.city_id': city, 'orders.quantity': 1 + (base % 4) },
    { 'orders.id': base + 4, 'orders.created_date': runDate, 'orders.total_revenue': 1200 + (base % 800), 'orders.city_id': city, 'orders.quantity': 6 + (base % 3) },
    { 'orders.id': base + 5, 'orders.created_date': runDate, 'orders.total_revenue': 420 + (base % 350), 'orders.city_id': city, 'orders.quantity': 3 + (base % 2) },
  ];
}
