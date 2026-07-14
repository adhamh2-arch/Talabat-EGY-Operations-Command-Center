import url from 'node:url';
import { computeMetrics } from '../skills/compute_metrics.js';
import { applyRiskScoring } from '../skills/apply_risk_scoring.js';
import { persistAudit } from '../skills/persist_audit.js';
import { appendToSheet } from '../skills/google_sheets.js';
import { logStep } from '../skills/utils.js';

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    if (!token.startsWith('--')) return acc;
    const [key, rawValue = 'true'] = token.slice(2).split('=');
    acc[key] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
    return acc;
  }, {});
}

function validateDataAccuracy(results) {
  const issues = [];
  for (const entity of results) {
    const m = entity.metrics;
    if (m.orderCount > 0 && m.totalRevenue === 0) {
      issues.push({ entity: entity.city || entity.entityName, check: 'data_accuracy', issue: 'Orders present but zero revenue' });
    }
    if (m.orderCount === 0 && m.totalRevenue > 0) {
      issues.push({ entity: entity.city || entity.entityName, check: 'data_accuracy', issue: 'Revenue present but zero orders' });
    }
    if (m.averageOrderValue < 0) {
      issues.push({ entity: entity.city || entity.entityName, check: 'data_accuracy', issue: 'Negative average order value' });
    }
    if (m.totalRevenue < 0) {
      issues.push({ entity: entity.city || entity.entityName, check: 'data_accuracy', issue: 'Negative total revenue' });
    }
  }
  return issues;
}

function validateRiskCalculations(results) {
  const issues = [];
  for (const entity of results) {
    const m = entity.metrics;
    const recalculated = applyRiskScoring(computeMetrics([
      { 'orders.total_revenue': String(m.totalRevenue), 'orders.quantity': String(m.totalQuantity) },
    ]));

    if (m.riskScore !== undefined && m.riskLevel !== undefined) {
      const expectedLevel = recalculated.riskLevel;
      if (m.riskLevel !== expectedLevel && Math.abs(m.riskScore - recalculated.riskScore) > 5) {
        issues.push({
          entity: entity.city || entity.entityName,
          check: 'risk_calculation',
          issue: `Risk level mismatch: reported ${m.riskLevel} (${m.riskScore}) vs recalculated ${expectedLevel} (${recalculated.riskScore})`,
        });
      }
    }
  }
  return issues;
}

function validateRecommendationQuality(results) {
  const issues = [];
  for (const entity of results) {
    const m = entity.metrics;
    if (m.riskScore >= 50 && (!m.recommendations || m.recommendations.length === 0)) {
      issues.push({
        entity: entity.city || entity.entityName,
        check: 'recommendation_quality',
        issue: `High risk score (${m.riskScore}) but no recommendations provided`,
      });
    }
    if (m.findings?.length > 0 && (!m.recommendations || m.recommendations.length === 0)) {
      issues.push({
        entity: entity.city || entity.entityName,
        check: 'recommendation_quality',
        issue: 'Findings present but no recommendations',
      });
    }
  }
  return issues;
}

function validateCompleteness(agentOutputs) {
  const issues = [];
  const expectedAgents = ['Alexandria Agent', 'ESM Agent', 'Delta Agent', 'Special Segment Agent'];
  const foundAgents = agentOutputs.map(a => a.agent);

  for (const expected of expectedAgents) {
    if (!foundAgents.includes(expected)) {
      issues.push({ entity: expected, check: 'completeness', issue: `Missing agent output: ${expected}` });
    }
  }

  for (const output of agentOutputs) {
    if (!output.results || output.results.length === 0) {
      issues.push({ entity: output.agent, check: 'completeness', issue: 'Agent produced no results' });
    }
  }
  return issues;
}

function checkDuplicates(allResults) {
  const seen = new Map();
  const dupes = [];
  for (const r of allResults) {
    const key = `${r.city || r.entityName}|${r.agent}`;
    if (seen.has(key)) {
      dupes.push({ entity: r.city || r.entityName, check: 'duplicates', issue: `Duplicate entry from ${r.agent}` });
    }
    seen.set(key, true);
  }
  return dupes;
}

function checkInconsistencies(allResults) {
  const issues = [];
  const byEntity = {};
  for (const r of allResults) {
    const key = r.city || r.entityName;
    if (!byEntity[key]) byEntity[key] = [];
    byEntity[key].push(r);
  }

  for (const [entity, entries] of Object.entries(byEntity)) {
    if (entries.length > 1) {
      const revenues = entries.map(e => e.metrics.totalRevenue);
      const max = Math.max(...revenues);
      const min = Math.min(...revenues);
      if (max > 0 && (max - min) / max > 0.5) {
        issues.push({ entity, check: 'inconsistency', issue: `Revenue varies widely across reports: $${min} - $${max}` });
      }
    }
  }
  return issues;
}

function generateStubAgentOutputs(runDate) {
  function makeResults(agent, cities) {
    return {
      agent,
      results: cities.map(city => ({
        city,
        metrics: {
          orderCount: 5, totalRevenue: 3000, totalQuantity: 15, averageOrderValue: 600,
          riskScore: 35, riskLevel: 'medium', needsEscalation: false,
          findings: city === 'Suez' ? ['Low order volume'] : [],
          recommendations: city === 'Suez' ? ['Investigate demand'] : [],
        },
      })),
    };
  }
  return [
    makeResults('Alexandria Agent', ['Alexandria']),
    makeResults('ESM Agent', ['Suez', 'Assiut', 'Hurghada']),
    makeResults('Delta Agent', ['Mansoura', 'Tanta', 'Mahalla']),
    {
      agent: 'Special Segment Agent',
      results: [
        { entityName: 'Premium Foods Cairo', metrics: { orderCount: 8, totalRevenue: 2200, totalQuantity: 8, averageOrderValue: 275, riskScore: 35, riskLevel: 'medium', needsEscalation: false, findings: [], recommendations: [] } },
      ],
    },
  ];
}

export async function run({ run_date, agent_outputs, reporting_output, dry_run = false }) {
  if (!run_date) throw new Error('Missing required input: run_date');

  const traceId = `qa-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  logStep('start', { traceId, run_date, dry_run });

  const outputs = agent_outputs || generateStubAgentOutputs(run_date);
  logStep('inputs.loaded', { traceId, agentCount: outputs.length });

  const allResults = [];
  for (const output of outputs) {
    for (const r of (output.results || [])) {
      allResults.push({ ...r, agent: output.agent });
    }
  }

  const completeness = validateCompleteness(outputs);
  const dataAccuracy = validateDataAccuracy(allResults);
  const riskValidation = validateRiskCalculations(allResults);
  const recommendationQuality = validateRecommendationQuality(allResults);
  const duplicates = checkDuplicates(allResults);
  const inconsistencies = checkInconsistencies(allResults);

  const allIssues = [...completeness, ...dataAccuracy, ...riskValidation, ...recommendationQuality, ...duplicates, ...inconsistencies];

  const report = {
    run_date,
    totalEntitiesReviewed: allResults.length,
    totalIssuesFound: allIssues.length,
    passed: allIssues.length === 0,
    breakdown: {
      completeness: completeness.length,
      dataAccuracy: dataAccuracy.length,
      riskCalculation: riskValidation.length,
      recommendationQuality: recommendationQuality.length,
      duplicates: duplicates.length,
      inconsistencies: inconsistencies.length,
    },
    issues: allIssues,
  };

  logStep('validation.complete', { traceId, passed: report.passed, totalIssues: report.totalIssuesFound, breakdown: report.breakdown });

  const sheetRows = allIssues.map(issue => ({
    'Date': run_date,
    'Agent Name': 'Quality Agent',
    'City / Segment': issue.entity,
    'Entity Name': issue.check,
    'Order Count': '', 'Total Revenue': '', 'Avg Order Value': '', 'Total Quantity': '',
    'Risk Score': '', 'Risk Level': '',
    'Findings': issue.issue,
    'Recommended Actions': 'Review and correct',
    'Status': 'Quality Issue',
    'Timestamp': new Date().toISOString(),
  }));

  if (sheetRows.length > 0) {
    await appendToSheet({ sheetName: 'qualityReview', rows: sheetRows, traceId, dry_run });
  }

  const audit = await persistAudit({ traceId, inputs: { run_date }, metrics: report, dry_run });
  logStep('persistAudit.complete', { traceId });

  return { traceId, run_date, report, audit, dry_run };
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
    console.error('quality_agent failed:', error.message);
    process.exit(1);
  }
}

const currentFile = url.pathToFileURL(process.argv[1]).href;
if (import.meta.url === currentFile) main();
