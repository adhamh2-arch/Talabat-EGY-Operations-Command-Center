import url from 'node:url';
import { persistAudit } from '../skills/persist_audit.js';
import { appendToSheet } from '../skills/google_sheets.js';
import { sendEmailReport, buildDailySummaryEmail } from '../skills/email_report.js';
import { logStep } from '../skills/utils.js';

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    if (!token.startsWith('--')) return acc;
    const [key, rawValue = 'true'] = token.slice(2).split('=');
    acc[key] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
    return acc;
  }, {});
}

function aggregateAgentOutputs(agentOutputs) {
  let totalRevenue = 0, totalOrders = 0, totalQuantity = 0;
  const allResults = [];
  const riskSummary = { low: 0, medium: 0, high: 0, critical: 0 };
  const criticalIssues = [];
  const agentSummaries = [];

  for (const output of agentOutputs) {
    const entities = output.results || [];
    let issuesFound = 0;

    for (const entity of entities) {
      const m = entity.metrics;
      totalRevenue += m.totalRevenue || 0;
      totalOrders += m.orderCount || 0;
      totalQuantity += m.totalQuantity || 0;
      riskSummary[m.riskLevel] = (riskSummary[m.riskLevel] || 0) + 1;

      if (m.findings?.length > 0) issuesFound += m.findings.length;

      if (m.riskLevel === 'critical' || m.needsEscalation) {
        criticalIssues.push({
          entity: entity.city || entity.entityName,
          agent: output.agent,
          riskScore: m.riskScore,
          riskLevel: m.riskLevel,
          finding: m.findings?.join('; ') || 'Elevated risk score',
        });
      }

      allResults.push({ ...entity, agent: output.agent });
    }

    agentSummaries.push({
      name: output.agent,
      entitiesProcessed: entities.length,
      issuesFound,
      status: output.summary?.escalations > 0 ? 'Escalations present' : 'Normal',
    });
  }

  const entityCount = allResults.length;
  return {
    portfolio: {
      entityCount,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      totalQuantity,
      averageOrderValue: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
    },
    riskSummary,
    criticalIssues,
    agentSummaries,
    allResults,
  };
}

function generateStubAgentOutputs(runDate) {
  function makeResults(agent, cities) {
    return {
      agent,
      run_date: runDate,
      summary: { citiesProcessed: cities.length, escalations: 0 },
      results: cities.map(city => {
        const hash = Array.from(city).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
        const base = Math.abs(hash % 500);
        return {
          city,
          metrics: {
            orderCount: 5 + (base % 20),
            totalRevenue: 2000 + base * 10,
            totalQuantity: 15 + (base % 30),
            averageOrderValue: 200 + (base % 300),
            riskScore: 20 + (base % 60),
            riskLevel: (20 + (base % 60)) >= 76 ? 'critical' : (20 + (base % 60)) >= 51 ? 'high' : (20 + (base % 60)) >= 26 ? 'medium' : 'low',
            needsEscalation: (20 + (base % 60)) >= 75,
            findings: base % 3 === 0 ? [`Below revenue target for ${city}`] : [],
            recommendations: base % 3 === 0 ? ['Review operational capacity'] : [],
          },
        };
      }),
    };
  }

  return [
    makeResults('Alexandria Agent', ['Alexandria']),
    makeResults('ESM Agent', ['Suez', 'Assiut', 'Hurghada']),
    makeResults('Delta Agent', ['Mansoura', 'Tanta', 'Mahalla']),
    {
      agent: 'Special Segment Agent',
      run_date: runDate,
      summary: { entitiesProcessed: 3, escalations: 0 },
      results: [
        { entityName: 'Premium Foods Cairo', metrics: { orderCount: 8, totalRevenue: 2200, totalQuantity: 8, averageOrderValue: 275, riskScore: 35, riskLevel: 'medium', needsEscalation: false, findings: [], recommendations: [] } },
        { entityName: 'Fresh Market Alex', metrics: { orderCount: 6, totalRevenue: 1800, totalQuantity: 6, averageOrderValue: 300, riskScore: 40, riskLevel: 'medium', needsEscalation: false, findings: [], recommendations: [] } },
        { entityName: 'Gourmet Hub Giza', metrics: { orderCount: 4, totalRevenue: 950, totalQuantity: 4, averageOrderValue: 237.5, riskScore: 52, riskLevel: 'high', needsEscalation: false, findings: ['Low order volume'], recommendations: ['Monitor closely'] } },
      ],
    },
  ];
}

export async function run({ run_date, agent_outputs, dry_run = false }) {
  if (!run_date) throw new Error('Missing required input: run_date');

  const traceId = `report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  logStep('start', { traceId, run_date, dry_run });

  const outputs = agent_outputs || generateStubAgentOutputs(run_date);
  logStep('inputs.loaded', { traceId, agentCount: outputs.length });

  const aggregated = aggregateAgentOutputs(outputs);
  logStep('aggregation.complete', { traceId, entityCount: aggregated.portfolio.entityCount, riskSummary: aggregated.riskSummary });

  const summaryRows = aggregated.agentSummaries.map(a => ({
    'Date': run_date,
    'Agent Name': 'Reporting Agent',
    'City / Segment': a.name,
    'Entity Name': 'Summary',
    'Order Count': a.entitiesProcessed,
    'Total Revenue': '',
    'Avg Order Value': '',
    'Total Quantity': '',
    'Risk Score': '',
    'Risk Level': '',
    'Findings': `Issues: ${a.issuesFound}`,
    'Recommended Actions': '',
    'Status': a.status,
    'Timestamp': new Date().toISOString(),
  }));

  await appendToSheet({ sheetName: 'executiveSummary', rows: summaryRows, traceId, dry_run });
  logStep('sheets.updated', { traceId });

  const { subject, body } = buildDailySummaryEmail({
    date: run_date,
    portfolio: aggregated.portfolio,
    riskSummary: aggregated.riskSummary,
    criticalIssues: aggregated.criticalIssues,
    agentSummaries: aggregated.agentSummaries,
  });

  const emailResult = await sendEmailReport({ subject, body, traceId, dry_run });
  logStep('email.complete', { traceId, sent: emailResult.sent });

  const audit = await persistAudit({
    traceId,
    inputs: { run_date },
    metrics: { portfolio: aggregated.portfolio, riskSummary: aggregated.riskSummary, criticalCount: aggregated.criticalIssues.length },
    dry_run,
  });

  return {
    traceId,
    run_date,
    portfolio: aggregated.portfolio,
    riskSummary: aggregated.riskSummary,
    criticalIssues: aggregated.criticalIssues,
    agentSummaries: aggregated.agentSummaries,
    emailResult,
    audit,
    dry_run,
  };
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
    console.error('reporting_agent failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) main();
