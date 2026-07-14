import url from 'node:url';
import { lookerQuery } from '../skills/looker_query.js';
import { computeMetrics } from '../skills/compute_metrics.js';
import { applyRiskScoring } from '../skills/apply_risk_scoring.js';
import { persistAudit } from '../skills/persist_audit.js';
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

function validateInputs({ city_id, run_date }) {
  if (!city_id) throw new Error('Missing required input: city_id');
  if (!run_date) throw new Error('Missing required input: run_date');
}

function buildSlackMessage({ riskLevel, riskScore, metrics }, traceId) {
  return `City Agent run complete\n` +
    `Trace: ${traceId}\n` +
    `Risk level: ${riskLevel} (${riskScore})\n` +
    `Order count: ${metrics.orderCount}\n` +
    `Total revenue: ${formatCurrency(metrics.totalRevenue)}\n` +
    `Average order value: ${formatCurrency(metrics.averageOrderValue)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export async function run({ city_id, run_date, dry_run = false }) {
  validateInputs({ city_id, run_date });
  const traceId = `city-agent-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  logStep('start', { traceId, city_id, run_date, dry_run });

  const rows = await lookerQuery({ cityId: city_id, runDate: run_date, traceId });
  logStep('lookerQuery.complete', { traceId, rowCount: rows.length });

  const metrics = computeMetrics(rows);
  logStep('computeMetrics.complete', { traceId, metrics });

  const scored = applyRiskScoring(metrics);
  logStep('applyRiskScoring.complete', { traceId, scored });

  const audit = await persistAudit({ traceId, inputs: { city_id, run_date }, metrics: scored, dry_run });
  logStep('persistAudit.complete', { traceId, auditId: audit.traceId ?? traceId });

  if (!dry_run) {
    const notification = await notifySlack({
      webhook: getEnv('NOTIFY_WEBHOOK'),
      channelId: getEnv('NOTIFY_CHANNEL_ID'),
      message: buildSlackMessage(scored, traceId),
    });
    logStep('notify.complete', { traceId, notification });
  } else {
    logStep('notify.skipped', { traceId, reason: 'dry_run' });
  }

  return { traceId, inputs: { city_id, run_date }, metrics: scored, audit, dry_run };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await run({
      city_id: args.city_id,
      run_date: args.run_date,
      dry_run: args.dry_run === true || args.dry_run === 'true',
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('city_agent failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) {
  main();
}
