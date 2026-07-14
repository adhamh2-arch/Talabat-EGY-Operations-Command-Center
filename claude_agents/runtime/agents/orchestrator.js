import url from 'node:url';
import { logStep } from '../skills/utils.js';

import { run as runAlexandria } from './alexandria_agent.js';
import { run as runEsm } from './esm_agent.js';
import { run as runDelta } from './delta_agent.js';
import { run as runSpecialSegment } from './special_segment_agent.js';
import { run as runQuality } from './quality_agent.js';
import { run as runReporting } from './reporting_agent.js';
import { run as runObserver } from './observer_agent.js';

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    if (!token.startsWith('--')) return acc;
    const [key, rawValue = 'true'] = token.slice(2).split('=');
    acc[key] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
    return acc;
  }, {});
}

export async function runDailyCycle({ run_date, dry_run = false }) {
  const traceId = `orch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  logStep('orchestrator.start', { traceId, run_date, dry_run, cycle: 'daily' });

  // Phase 1: Monitoring Agents (parallel)
  logStep('phase.1.monitoring.start', { traceId });
  const [alexResult, esmResult, deltaResult, segmentResult] = await Promise.all([
    runAlexandria({ run_date, dry_run }).catch(err => ({ agent: 'Alexandria Agent', error: err.message })),
    runEsm({ run_date, dry_run }).catch(err => ({ agent: 'ESM Agent', error: err.message })),
    runDelta({ run_date, dry_run }).catch(err => ({ agent: 'Delta Agent', error: err.message })),
    runSpecialSegment({ run_date, dry_run }).catch(err => ({ agent: 'Special Segment Agent', error: err.message })),
  ]);
  logStep('phase.1.monitoring.complete', { traceId });

  const monitoringOutputs = [alexResult, esmResult, deltaResult, segmentResult];
  const monitoringErrors = monitoringOutputs.filter(r => r.error);
  if (monitoringErrors.length > 0) {
    logStep('phase.1.errors', { traceId, errors: monitoringErrors });
  }

  // Phase 2: Quality Validation
  logStep('phase.2.quality.start', { traceId });
  const qualityResult = await runQuality({
    run_date,
    agent_outputs: monitoringOutputs.filter(r => !r.error),
    dry_run,
  }).catch(err => ({ error: err.message }));
  logStep('phase.2.quality.complete', { traceId });

  // Phase 3: Reporting
  logStep('phase.3.reporting.start', { traceId });
  const reportingResult = await runReporting({
    run_date,
    agent_outputs: monitoringOutputs.filter(r => !r.error),
    dry_run,
  }).catch(err => ({ error: err.message }));
  logStep('phase.3.reporting.complete', { traceId });

  // Phase 4: Observer Review
  logStep('phase.4.observer.start', { traceId });
  const observerResult = await runObserver({
    run_date,
    mode: 'daily',
    monitoring_outputs: monitoringOutputs.filter(r => !r.error),
    quality_output: qualityResult.error ? undefined : qualityResult,
    reporting_output: reportingResult.error ? undefined : reportingResult,
    dry_run,
  }).catch(err => ({ error: err.message }));
  logStep('phase.4.observer.complete', { traceId });

  const summary = {
    traceId,
    run_date,
    cycle: 'daily',
    phases: {
      monitoring: {
        completed: monitoringOutputs.filter(r => !r.error).length,
        failed: monitoringErrors.length,
        agents: monitoringOutputs.map(r => r.agent || 'unknown'),
      },
      quality: { completed: !qualityResult.error, passed: qualityResult.report?.passed },
      reporting: { completed: !reportingResult.error },
      observer: { completed: !observerResult.error },
    },
    dry_run,
  };

  logStep('orchestrator.complete', { traceId, summary });

  return {
    traceId,
    summary,
    monitoring: monitoringOutputs,
    quality: qualityResult,
    reporting: reportingResult,
    observer: observerResult,
  };
}

export async function runWeeklyCycle({ run_date, dry_run = false }) {
  const traceId = `orch-weekly-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  logStep('orchestrator.weekly.start', { traceId, run_date, dry_run });

  const observerResult = await runObserver({
    run_date,
    mode: 'weekly',
    dry_run,
  }).catch(err => ({ error: err.message }));

  logStep('orchestrator.weekly.complete', { traceId });

  return { traceId, run_date, cycle: 'weekly', observer: observerResult, dry_run };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const cycle = args.cycle || 'daily';
    const run_date = args.run_date;
    const dry_run = args.dry_run === true || args.dry_run === 'true';

    if (!run_date) throw new Error('Missing required input: run_date');

    let result;
    if (cycle === 'weekly') {
      result = await runWeeklyCycle({ run_date, dry_run });
    } else {
      result = await runDailyCycle({ run_date, dry_run });
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('orchestrator failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) main();
