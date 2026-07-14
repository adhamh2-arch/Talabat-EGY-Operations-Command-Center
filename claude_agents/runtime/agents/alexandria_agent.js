import url from 'node:url';
import { getAgentConfig } from '../skills/config_loader.js';
import { runCityMonitor } from '../skills/city_monitor_base.js';
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

export async function run({ run_date, dry_run = false }) {
  if (!run_date) throw new Error('Missing required input: run_date');

  const config = getAgentConfig('alexandria');
  const traceId = `alex-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  logStep('start', { traceId, agent: config.name, cities: config.cities, run_date, dry_run });

  const { results, audit } = await runCityMonitor({
    agentName: config.name,
    cities: config.cities,
    run_date,
    dry_run,
    traceId,
  });

  const escalated = results.filter(r => r.metrics.needsEscalation);
  const summary = {
    agent: config.name,
    citiesProcessed: results.length,
    escalations: escalated.length,
    riskBreakdown: {
      critical: results.filter(r => r.metrics.riskLevel === 'critical').length,
      high: results.filter(r => r.metrics.riskLevel === 'high').length,
      medium: results.filter(r => r.metrics.riskLevel === 'medium').length,
      low: results.filter(r => r.metrics.riskLevel === 'low').length,
    },
  };

  logStep('summary', { traceId, summary });

  if (!dry_run) {
    try {
      await notifySlack({
        webhook: getEnv('NOTIFY_WEBHOOK'),
        channelId: getEnv('NOTIFY_CHANNEL_ID'),
        message: `${config.name} complete | Cities: ${results.length} | Escalations: ${escalated.length} | Trace: ${traceId}`,
      });
      logStep('notify.complete', { traceId });
    } catch (err) {
      logStep('notify.failed', { traceId, error: err.message });
    }
  } else {
    logStep('notify.skipped', { traceId, reason: 'dry_run' });
  }

  return { traceId, agent: config.name, run_date, summary, results: results.map(r => ({ city: r.city, metrics: r.metrics })), audit, dry_run };
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
    console.error('alexandria_agent failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) main();
