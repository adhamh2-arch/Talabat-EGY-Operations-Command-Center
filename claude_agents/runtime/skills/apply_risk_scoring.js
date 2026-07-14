import { getRiskConfig, getPerformanceConfig } from './config_loader.js';

export function classifyRiskLevel(score) {
  let config;
  try { config = getRiskConfig(); } catch { config = null; }

  if (config?.thresholds) {
    const t = config.thresholds;
    if (score >= t.critical.min) return 'critical';
    if (score >= t.high.min) return 'high';
    if (score >= t.medium.min) return 'medium';
    return 'low';
  }
  if (score >= 76) return 'critical';
  if (score >= 51) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}

export function analyzeRootCause(metrics) {
  const findings = [];
  const recommendations = [];

  let perfConfig;
  try { perfConfig = getPerformanceConfig(); } catch { perfConfig = null; }
  const minOrders = perfConfig?.thresholds?.minDailyOrders ?? 10;
  const minRevenue = perfConfig?.thresholds?.minDailyRevenue ?? 500;
  const minAOV = perfConfig?.thresholds?.minAverageOrderValue ?? 100;

  if (metrics.orderCount < minOrders) {
    findings.push(`Low order volume: ${metrics.orderCount} orders (threshold: ${minOrders})`);
    recommendations.push('Investigate demand drivers; consider promotional campaigns or operational review');
  }

  if (metrics.totalRevenue < minRevenue) {
    findings.push(`Below revenue target: $${metrics.totalRevenue} (threshold: $${minRevenue})`);
    recommendations.push('Review pricing strategy and order mix; check for service disruptions');
  }

  if (metrics.averageOrderValue < minAOV) {
    findings.push(`Low average order value: $${metrics.averageOrderValue} (threshold: $${minAOV})`);
    recommendations.push('Analyze basket composition; consider upselling or bundling strategies');
  }

  if (metrics.totalQuantity > 0 && metrics.orderCount > 0) {
    const avgQty = metrics.totalQuantity / metrics.orderCount;
    if (avgQty < 1.5) {
      findings.push(`Low items per order: ${avgQty.toFixed(1)}`);
      recommendations.push('Encourage multi-item orders through cross-selling');
    }
  }

  return { findings, recommendations };
}

export function applyRiskScoring(metrics) {
  let riskConfig;
  try { riskConfig = getRiskConfig(); } catch { riskConfig = null; }

  const w = riskConfig?.weights || {
    revenueWeight: 0.30,
    orderVelocityWeight: 0.25,
    averageValueWeight: 0.20,
    quantityWeight: 0.15,
    freshnessWeight: 0.10,
  };

  const revenueComponent = Math.max(0, Math.min(100, 100 - Math.round(metrics.totalRevenue / 500)));
  const orderComponent = Math.max(0, Math.min(100, 100 - Math.round(metrics.orderCount / 5)));
  const aovComponent = metrics.averageOrderValue < 200 ? Math.min(100, Math.round((200 - metrics.averageOrderValue) / 2)) : 0;
  const quantityComponent = Math.max(0, Math.min(100, 100 - Math.round((metrics.totalQuantity || 0) / 3)));
  const freshnessComponent = 0;

  const rawScore =
    revenueComponent * w.revenueWeight +
    orderComponent * w.orderVelocityWeight +
    aovComponent * w.averageValueWeight +
    quantityComponent * w.quantityWeight +
    freshnessComponent * w.freshnessWeight;

  const score = Math.round(Math.min(100, Math.max(0, rawScore)));
  const riskLevel = classifyRiskLevel(score);
  const { findings, recommendations } = analyzeRootCause(metrics);

  const escalationThreshold = riskConfig?.escalationThreshold ?? 75;
  const reviewThreshold = riskConfig?.reviewThreshold ?? 50;

  return {
    ...metrics,
    riskScore: score,
    riskLevel,
    needsReview: score >= reviewThreshold,
    needsEscalation: score >= escalationThreshold,
    findings,
    recommendations,
    riskComponents: {
      revenue: revenueComponent,
      orderVelocity: orderComponent,
      averageValue: aovComponent,
      quantity: quantityComponent,
    },
  };
}
