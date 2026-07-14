import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics } from '../../claude_agents/runtime/skills/compute_metrics.js';
import { applyRiskScoring, classifyRiskLevel, analyzeRootCause } from '../../claude_agents/runtime/skills/apply_risk_scoring.js';

const sampleRows = [
  { 'orders.total_revenue': '100.00', 'orders.quantity': '2' },
  { 'orders.total_revenue': '200.00', 'orders.quantity': '3' },
];

test('computeMetrics calculates totals and average order value', () => {
  const metrics = computeMetrics(sampleRows);
  assert.equal(metrics.orderCount, 2);
  assert.equal(metrics.totalRevenue, 300);
  assert.equal(metrics.totalQuantity, 5);
  assert.equal(metrics.averageOrderValue, 150);
});

test('applyRiskScoring returns 4 risk levels and root-cause analysis', () => {
  const metrics = { orderCount: 2, totalRevenue: 300, averageOrderValue: 150, totalQuantity: 5 };
  const scored = applyRiskScoring(metrics);

  assert.ok(['low', 'medium', 'high', 'critical'].includes(scored.riskLevel));
  assert.ok(scored.riskScore >= 0 && scored.riskScore <= 100);
  assert.ok(Array.isArray(scored.findings));
  assert.ok(Array.isArray(scored.recommendations));
  assert.equal(typeof scored.needsReview, 'boolean');
  assert.equal(typeof scored.needsEscalation, 'boolean');
  assert.ok(scored.riskComponents);
});

test('classifyRiskLevel maps scores to 4 levels', () => {
  assert.equal(classifyRiskLevel(10), 'low');
  assert.equal(classifyRiskLevel(30), 'medium');
  assert.equal(classifyRiskLevel(60), 'high');
  assert.equal(classifyRiskLevel(85), 'critical');
});

test('analyzeRootCause detects low order volume', () => {
  const { findings } = analyzeRootCause({ orderCount: 3, totalRevenue: 5000, averageOrderValue: 500, totalQuantity: 10 });
  assert.ok(findings.some(f => f.includes('Low order volume')));
});

test('analyzeRootCause detects low revenue', () => {
  const { findings } = analyzeRootCause({ orderCount: 20, totalRevenue: 100, averageOrderValue: 5, totalQuantity: 40 });
  assert.ok(findings.some(f => f.includes('Below revenue target')));
});

test('computeMetrics handles empty rows', () => {
  const metrics = computeMetrics([]);
  assert.equal(metrics.orderCount, 0);
  assert.equal(metrics.totalRevenue, 0);
  assert.equal(metrics.averageOrderValue, 0);
});

test('applyRiskScoring produces higher scores for worse metrics', () => {
  const good = applyRiskScoring({ orderCount: 50, totalRevenue: 50000, averageOrderValue: 1000, totalQuantity: 200 });
  const bad = applyRiskScoring({ orderCount: 1, totalRevenue: 50, averageOrderValue: 50, totalQuantity: 1 });
  assert.ok(bad.riskScore > good.riskScore);
});
