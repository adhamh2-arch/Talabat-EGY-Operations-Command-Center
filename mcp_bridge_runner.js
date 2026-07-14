import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_DATA_DIR = join(__dirname, 'mcp_data');
const CONFIG_PATH = join(__dirname, 'config', 'agents.config.json');

// ─── helpers ──────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
const RUN_DATE = process.argv[2] || '2026-06-12';

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
const clusterFile = join(MCP_DATA_DIR, `cluster_data_${RUN_DATE}.json`);

if (!existsSync(clusterFile)) {
  console.error(JSON.stringify({ status: 'ERROR', message: `No cluster data file found: cluster_data_${RUN_DATE}.json` }));
  process.exit(1);
}

const raw = JSON.parse(readFileSync(clusterFile, 'utf-8'));
const todayCities = raw.today.city_performance;
const yesterdayCities = raw.yesterday.city_performance;
const topOffenders = raw.top_offenders;

function aggregateCluster(clusterKey) {
  const clusterDef = config.clusters[clusterKey];
  const cities = todayCities.filter(c => c.cluster === clusterKey);
  const yCities = yesterdayCities.filter(c => c.cluster === clusterKey);

  const allOrders = cities.reduce((s, c) => s + c.all_orders, 0);
  const failedOrders = cities.reduce((s, c) => s + c.failed_orders, 0);
  const successfulOrders = cities.reduce((s, c) => s + c.successful_orders, 0);
  const gmv = cities.reduce((s, c) => s + c.gmv_lc, 0);
  const lostGmv = cities.reduce((s, c) => s + c.lost_gmv_lc, 0);
  const partialRefund = cities.reduce((s, c) => s + c.partial_refund_lc, 0);
  const partialRefundOrders = cities.reduce((s, c) => s + c.partial_refund_orders, 0);
  const vendorFailRate = allOrders > 0
    ? cities.reduce((s, c) => s + c.vendor_fail_rate * c.all_orders, 0) / allOrders
    : 0;

  const yFailedOrders = yCities.reduce((s, c) => s + c.failed_orders, 0);
  const yLostGmv = yCities.reduce((s, c) => s + c.lost_gmv_lc, 0);
  const yAllOrders = yCities.reduce((s, c) => s + c.all_orders, 0);
  const yFailRate = yAllOrders > 0
    ? yCities.reduce((s, c) => s + (c.vendor_fail_rate || 0) * c.all_orders, 0) / yAllOrders
    : 0;

  const target = clusterDef.target;
  const deviation = vendorFailRate - target;
  const deviationPct = target > 0 ? (deviation / target) * 100 : 0;

  // ── 4-factor risk formula ─────────────────────────────────────────────────
  // Aggregate vendor_fault_cases (late + missing + quality) from city rows
  const vendorFaultCases = cities.reduce((s, c) => s + (c.vendor_fault_cases || 0), 0);

  // Factor 1 — Target Deviation   (max 40 pts)
  const targetDeviationSubScore = deviation > 0
    ? Math.min(40, deviationPct * 0.8)
    : 0;

  // Factor 2 — Vendor Fault Cases  (max 30 pts)
  const vendorFaultSubScore = Math.min(30, (vendorFaultCases / 500) * 6);

  // Factor 3 — Order Volume         (max 20 pts)
  const orderVolumeSubScore = Math.min(20, (allOrders / 10_000) * 4);

  // Factor 4 — Financial Impact     (max 10 pts)
  const financialSubScore = Math.min(10, (lostGmv + partialRefund) / 20_000);

  let riskScore = Math.min(100, Math.round(
    targetDeviationSubScore + vendorFaultSubScore + orderVolumeSubScore + financialSubScore
  ));

  let riskLevel = 'low';
  if (riskScore >= 76) riskLevel = 'critical';
  else if (riskScore >= 51) riskLevel = 'high';
  else if (riskScore >= 26) riskLevel = 'medium';

  const dodFailedOrders = yFailedOrders > 0 ? ((failedOrders - yFailedOrders) / yFailedOrders * 100) : 0;
  const dodLostGmv = yLostGmv > 0 ? ((lostGmv - yLostGmv) / yLostGmv * 100) : 0;
  const dodFailRate = yFailRate > 0 ? ((vendorFailRate - yFailRate) / yFailRate * 100) : 0;

  return {
    cluster: clusterKey,
    name: clusterDef.name,
    agent: clusterDef.agent,
    target,
    targetLabel: clusterDef.targetLabel,
    allOrders,
    failedOrders,
    successfulOrders,
    gmv: Math.round(gmv),
    lostGmv: Math.round(lostGmv),
    vendorFailRate: +(vendorFailRate * 100).toFixed(4),
    partialRefund: Math.round(partialRefund),
    partialRefundOrders,
    vendorFaultCases,
    deviation: +(deviation * 100).toFixed(4),
    deviationPct: +deviationPct.toFixed(1),
    riskScore,
    riskLevel,
    riskFactors: {
      targetDeviationPts: +targetDeviationSubScore.toFixed(1),
      vendorFaultPts:     +vendorFaultSubScore.toFixed(1),
      orderVolumePts:     +orderVolumeSubScore.toFixed(1),
      financialPts:       +financialSubScore.toFixed(1),
    },
    dod: {
      failedOrders: +dodFailedOrders.toFixed(1),
      lostGmv: +dodLostGmv.toFixed(1),
      failRate: +dodFailRate.toFixed(1),
    },
    cities: cities.map(c => ({
      city: c.city,
      allOrders: c.all_orders,
      failedOrders: c.failed_orders,
      gmv: Math.round(c.gmv_lc),
      lostGmv: Math.round(c.lost_gmv_lc),
      vendorFailRate: +(c.vendor_fail_rate * 100).toFixed(4),
      partialRefund: Math.round(c.partial_refund_lc),
    })),
    topOffenders: (topOffenders[clusterKey] || []).slice(0, 10).map(v => ({
      vendor_id:           v.vendor_id || '',
      vendor:              v.vendor || v.vendor_name || '',
      city:                v.city,
      am_name:             v.am_name || '',
      am_email:            v.am_email || '',
      is_key_vip:          v.is_key_vip || false,
      net_orders:          v.net_orders || v.all_orders || 0,
      vendor_net_failed:   v.vendor_net_failed || v.failed_orders || 0,
      failedOrders:        v.failed_orders || v.vendor_net_failed || 0,
      lostGmv:             Math.round(v.lost_gmv_lc || 0),
      failRate:            +(( v.vendor_fail_rate || v.fail_rate || 0) * 100).toFixed(4),
      late_delivery_cases: v.late_delivery_cases || 0,
      missing_items_cases: v.missing_items_cases || 0,
      order_quality_cases: v.order_quality_cases || 0,
      vendor_fault_cases:  v.vendor_fault_cases || 0,
      talabat_reason:      v.talabat_reason || '',
      partial_refund_lc:   Math.round(v.partial_refund_lc || 0),
    })),
  };
}

const clusterResults = Object.keys(config.clusters)
  .filter(k => k !== 'key_accounts')
  .map(k => aggregateCluster(k));

const keyAccountsOffenders = (topOffenders.key_accounts || []).slice(0, 10).map(v => ({
  vendor_id:           v.vendor_id || '',
  vendor:              v.vendor || v.vendor_name || '',
  city:                v.city,
  am_name:             v.am_name || '',
  am_email:            v.am_email || '',
  is_key_vip:          v.is_key_vip || false,
  net_orders:          v.net_orders || v.all_orders || 0,
  vendor_net_failed:   v.vendor_net_failed || v.failed_orders || 0,
  failedOrders:        v.failed_orders || v.vendor_net_failed || 0,
  lostGmv:             Math.round(v.lost_gmv_lc || 0),
  failRate:            +((v.vendor_fail_rate || v.fail_rate || 0) * 100).toFixed(4),
  late_delivery_cases: v.late_delivery_cases || 0,
  missing_items_cases: v.missing_items_cases || 0,
  order_quality_cases: v.order_quality_cases || 0,
  vendor_fault_cases:  v.vendor_fault_cases || 0,
  talabat_reason:      v.talabat_reason || '',
  partial_refund_lc:   Math.round(v.partial_refund_lc || 0),
}));

const totalAllOrders = clusterResults.reduce((s, c) => s + c.allOrders, 0);
const totalFailed = clusterResults.reduce((s, c) => s + c.failedOrders, 0);
const totalLostGmv = clusterResults.reduce((s, c) => s + c.lostGmv, 0);
const totalGmv = clusterResults.reduce((s, c) => s + c.gmv, 0);
const totalPartialRefund = clusterResults.reduce((s, c) => s + c.partialRefund, 0);
const overallFailRate = totalAllOrders > 0
  ? +(clusterResults.reduce((s, c) => s + c.vendorFailRate * c.allOrders, 0) / totalAllOrders).toFixed(4)
  : 0;

const criticalClusters = clusterResults.filter(c => c.riskLevel === 'critical');
const highClusters = clusterResults.filter(c => c.riskLevel === 'high');
const aboveTarget = clusterResults.filter(c => c.deviation > 0);

const output = {
  date: RUN_DATE,
  clusterResults,
  keyAccounts: {
    target: config.clusters.key_accounts.target,
    targetLabel: config.clusters.key_accounts.targetLabel,
    topOffenders: keyAccountsOffenders,
  },
  segmentTargets: config.segmentTargets,
  summary: {
    totalAllOrders,
    totalFailed,
    totalLostGmv,
    totalGmv,
    totalPartialRefund,
    overallFailRate,
    criticalClusters: criticalClusters.length,
    highRiskClusters: highClusters.length,
    clustersAboveTarget: aboveTarget.map(c => c.name),
  },
  riskRegister: clusterResults
    .filter(c => c.riskScore >= 26)
    .map(c => ({
      cluster: c.name,
      riskScore: c.riskScore,
      riskLevel: c.riskLevel,
      failRate: c.vendorFailRate + '%',
      target: c.targetLabel,
      deviation: c.deviation.toFixed(2) + '%',
      lostGmv: c.lostGmv,
      topOffender: c.topOffenders[0]?.vendor || 'N/A',
    })),
};

writeFileSync(join(MCP_DATA_DIR, `scored_output_${RUN_DATE}.json`), JSON.stringify(output, null, 2));

console.log(JSON.stringify({
  status: 'SUCCESS',
  run_date: RUN_DATE,
  clusters_processed: clusterResults.length,
  key_accounts_vendors: keyAccountsOffenders.length,
  overall_fail_rate: overallFailRate + '%',
  total_failed_orders: totalFailed,
  total_lost_gmv: totalLostGmv,
  clusters_above_target: aboveTarget.map(c => `${c.name} (${c.vendorFailRate}% vs ${c.targetLabel})`),
  risk_distribution: {
    critical: criticalClusters.length,
    high: highClusters.length,
    medium: clusterResults.filter(c => c.riskLevel === 'medium').length,
    low: clusterResults.filter(c => c.riskLevel === 'low').length,
  },
}));
