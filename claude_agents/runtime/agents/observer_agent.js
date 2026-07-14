import url from 'node:url';
import { persistAudit } from '../skills/persist_audit.js';
import { appendToSheet } from '../skills/google_sheets.js';
import { sendEmailReport, buildWeeklyExecutiveEmail } from '../skills/email_report.js';
import { logStep } from '../skills/utils.js';

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    if (!token.startsWith('--')) return acc;
    const [key, rawValue = 'true'] = token.slice(2).split('=');
    acc[key] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
    return acc;
  }, {});
}

function buildExecutiveOverview(monitoring, quality, reporting) {
  const totalEntities = monitoring.reduce((sum, m) => sum + (m.results?.length || 0), 0);
  const totalRevenue = monitoring.reduce((sum, m) => {
    return sum + (m.results || []).reduce((s, r) => s + (r.metrics?.totalRevenue || 0), 0);
  }, 0);

  const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const m of monitoring) {
    for (const r of (m.results || [])) {
      const level = r.metrics?.riskLevel || 'low';
      riskDist[level] = (riskDist[level] || 0) + 1;
    }
  }

  const escalations = [];
  for (const m of monitoring) {
    for (const r of (m.results || [])) {
      if (r.metrics?.needsEscalation || r.metrics?.riskLevel === 'critical') {
        escalations.push({
          entity: r.city || r.entityName,
          agent: m.agent,
          riskScore: r.metrics.riskScore,
          riskLevel: r.metrics.riskLevel,
        });
      }
    }
  }

  const qualityScore = quality?.report?.passed ? 100 : Math.max(0, 100 - (quality?.report?.totalIssuesFound || 0) * 10);

  return {
    totalEntities,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    riskDistribution: riskDist,
    escalations,
    qualityScore,
    qualityIssues: quality?.report?.totalIssuesFound || 0,
    agentEffectiveness: monitoring.map(m => ({
      agent: m.agent,
      entitiesProcessed: m.results?.length || 0,
      escalationCount: (m.results || []).filter(r => r.metrics?.needsEscalation).length,
      status: m.dry_run ? 'dry_run' : 'completed',
    })),
  };
}

function generateRecommendations(overview) {
  const recs = [];

  if (overview.escalations.length > 0) {
    recs.push(`Immediate attention required for ${overview.escalations.length} escalated entities`);
    for (const e of overview.escalations) {
      recs.push(`  - ${e.entity} (${e.agent}): Risk score ${e.riskScore} (${e.riskLevel})`);
    }
  }

  if (overview.qualityScore < 80) {
    recs.push(`Data quality below threshold (${overview.qualityScore}/100). Review ${overview.qualityIssues} issues before acting on monitoring data`);
  }

  const criticalPct = overview.totalEntities > 0
    ? ((overview.riskDistribution.critical || 0) / overview.totalEntities * 100).toFixed(1)
    : 0;
  if (Number(criticalPct) > 20) {
    recs.push(`${criticalPct}% of entities are at critical risk level — consider systemic review`);
  }

  if (recs.length === 0) {
    recs.push('All systems operating within normal parameters. No escalations required.');
  }

  return recs;
}

function generateStubInputs(runDate) {
  function makeMonitoring(agent, cities) {
    return {
      agent,
      dry_run: true,
      results: cities.map(city => ({
        city,
        metrics: {
          orderCount: 10, totalRevenue: 5000, totalQuantity: 25, averageOrderValue: 500,
          riskScore: 30, riskLevel: 'medium', needsEscalation: false,
          findings: [], recommendations: [],
        },
      })),
    };
  }
  return {
    monitoring: [
      makeMonitoring('Alexandria Agent', ['Alexandria']),
      makeMonitoring('ESM Agent', ['Suez', 'Assiut', 'Hurghada']),
      makeMonitoring('Delta Agent', ['Mansoura', 'Tanta', 'Mahalla']),
      {
        agent: 'Special Segment Agent', dry_run: true,
        results: [
          { entityName: 'Premium Foods Cairo', metrics: { orderCount: 8, totalRevenue: 2200, totalQuantity: 8, averageOrderValue: 275, riskScore: 35, riskLevel: 'medium', needsEscalation: false, findings: [], recommendations: [] } },
        ],
      },
    ],
    quality: {
      report: { passed: true, totalIssuesFound: 0, breakdown: {} },
    },
    reporting: {
      portfolio: { entityCount: 8, totalRevenue: 37200, totalOrders: 78, averageOrderValue: 476.92 },
      riskSummary: { low: 0, medium: 8, high: 0, critical: 0 },
    },
  };
}

export async function run({ run_date, mode = 'daily', monitoring_outputs, quality_output, reporting_output, dry_run = false }) {
  if (!run_date) throw new Error('Missing required input: run_date');

  const traceId = `observer-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  logStep('start', { traceId, run_date, mode, dry_run });

  const stub = generateStubInputs(run_date);
  const monitoring = monitoring_outputs || stub.monitoring;
  const quality = quality_output || stub.quality;
  const reporting = reporting_output || stub.reporting;

  const overview = buildExecutiveOverview(monitoring, quality, reporting);
  logStep('overview.built', { traceId, totalEntities: overview.totalEntities, qualityScore: overview.qualityScore });

  const recommendations = generateRecommendations(overview);
  logStep('recommendations.generated', { traceId, count: recommendations.length });

  const totalEntities = overview.totalEntities;
  const riskDistribution = Object.entries(overview.riskDistribution).map(([level, count]) => ({
    level,
    count,
    percent: totalEntities > 0 ? Number((count / totalEntities * 100).toFixed(1)) : 0,
  }));

  const executiveReport = {
    date: run_date,
    mode,
    overview,
    riskDistribution,
    recommendations,
    dataQuality: {
      score: overview.qualityScore,
      issues: overview.qualityIssues,
      assessment: overview.qualityScore >= 90 ? 'Good' : overview.qualityScore >= 70 ? 'Acceptable' : 'Needs Review',
    },
    agentEffectiveness: overview.agentEffectiveness,
  };

  logStep('executiveReport.assembled', { traceId, mode });

  const sheetRows = [{
    'Date': run_date,
    'Agent Name': 'Observer Agent',
    'City / Segment': 'System-wide',
    'Entity Name': `${mode} Executive Report`,
    'Order Count': overview.totalEntities,
    'Total Revenue': overview.totalRevenue,
    'Avg Order Value': '',
    'Total Quantity': '',
    'Risk Score': overview.qualityScore,
    'Risk Level': overview.qualityScore >= 90 ? 'Good' : 'Review',
    'Findings': `Escalations: ${overview.escalations.length}, Quality issues: ${overview.qualityIssues}`,
    'Recommended Actions': recommendations[0] || '',
    'Status': 'Completed',
    'Timestamp': new Date().toISOString(),
  }];

  await appendToSheet({ sheetName: 'executiveSummary', rows: sheetRows, traceId, dry_run });

  if (mode === 'weekly') {
    const weekEnd = new Date(run_date);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const { subject, body } = buildWeeklyExecutiveEmail({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: run_date,
      trends: [
        { metric: 'Total Revenue', current: `$${overview.totalRevenue}`, previous: 'N/A', change: 'N/A' },
        { metric: 'Entities Monitored', current: overview.totalEntities, previous: 'N/A', change: 'N/A' },
        { metric: 'Quality Score', current: `${overview.qualityScore}/100`, previous: 'N/A', change: 'N/A' },
      ],
      riskDistribution,
      escalations: overview.escalations.map(e => `${e.entity} (${e.agent}): ${e.riskLevel}, score ${e.riskScore}`),
      recommendations,
    });

    await sendEmailReport({ subject, body, traceId, dry_run });
    logStep('weeklyEmail.sent', { traceId });
  }

  const audit = await persistAudit({ traceId, inputs: { run_date, mode }, metrics: executiveReport, dry_run });
  logStep('persistAudit.complete', { traceId });

  return { traceId, run_date, mode, executiveReport, audit, dry_run };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await run({
      run_date: args.run_date,
      mode: args.mode || 'daily',
      dry_run: args.dry_run === true || args.dry_run === 'true',
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('observer_agent failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) main();
