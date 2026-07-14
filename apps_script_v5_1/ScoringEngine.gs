/**
 * ScoringEngine.gs — cluster + vendor risk scoring on the new consolidated data.
 * processAllClusters(feedData) consumes feedData.byCluster (from DataReader).
 * v5.1: topOffenders now also carry isKey/isTgo/isFood/chainId for the 31-col tracker + action tool.
 */

function processAllClusters(feedData) {
  var clusterResults = [];

  Object.keys(CLUSTERS).forEach(function(ck) {
    var agg = feedData.byCluster[ck];
    if (agg) clusterResults.push(scoreCluster_(ck, agg));
  });

  // stable, risk-first ordering for dashboards
  clusterResults.sort(function(a, b) { return b.riskScore - a.riskScore; });

  var totalAllOrders = 0, totalFailed = 0, totalLostGmv = 0, totalPartialRefund = 0, totalFaultCases = 0, weightedRate = 0;
  clusterResults.forEach(function(c) {
    totalAllOrders += c.allOrders;
    totalFailed += c.failedOrders;
    totalLostGmv += c.lostGmv;
    totalPartialRefund += c.partialRefund;
    totalFaultCases += c.vendorFaultCases;
    weightedRate += (c.vendorFailRate / 100) * c.allOrders;
  });
  var overallFailRate = totalAllOrders > 0 ? weightedRate / totalAllOrders : 0;

  return {
    date: getCairoDate(0),
    mtdRange: getMtdRange(),
    clusterResults: clusterResults,
    warnings: feedData.warnings || [],
    health: feedData.health || [],
    summary: {
      totalAllOrders: totalAllOrders,
      totalFailed: totalFailed,
      totalLostGmv: Math.round(totalLostGmv),
      totalPartialRefund: Math.round(totalPartialRefund),
      totalVendorFaultCases: totalFaultCases,
      overallFailRate: +(overallFailRate * 100).toFixed(3),
      criticalClusters: clusterResults.filter(function(c) { return c.riskLevel === 'critical'; }).length,
      highRiskClusters: clusterResults.filter(function(c) { return c.riskLevel === 'high'; }).length,
      clustersAboveTarget: clusterResults.filter(function(c) { return c.deviation > 0; }).map(function(c) { return c.name; })
    },
    riskRegister: clusterResults
      .filter(function(c) { return c.riskScore >= 26; })
      .map(function(c) {
        return {
          cluster: c.name, riskScore: c.riskScore, riskLevel: c.riskLevel,
          failRate: c.vendorFailRate + '%', target: c.targetLabel,
          deviation: c.deviation.toFixed(2) + '%', lostGmv: c.lostGmv,
          vendorFaultCases: c.vendorFaultCases,
          topOffender: c.topOffenders.length > 0 ? c.topOffenders[0].vendor : 'N/A'
        };
      })
  };
}

function scoreCluster_(clusterKey, agg) {
  var def = CLUSTERS[clusterKey];
  var t = agg.totals;

  var allOrders = t.allOrders;
  var failedOrders = t.failedOrders;
  var vendorFailRate = t.vendorFailRate; // fraction
  var target = def.target;
  var deviation = vendorFailRate - target;
  var deviationPct = target > 0 ? (deviation / target) * 100 : 0;

  // ---- cluster risk score (0-100) ----
  var riskScore = 0;
  if (deviation > 0) riskScore += Math.min(SCORING_WEIGHTS.deviation, deviationPct * 0.8);
  riskScore += Math.min(SCORING_WEIGHTS.vendorFaultCases, (t.vendorFaultCases / 500) * SCORING_WEIGHTS.vendorFaultCases);
  riskScore += Math.min(SCORING_WEIGHTS.orderVolume, (allOrders / 10000) * SCORING_WEIGHTS.orderVolume);
  riskScore += Math.min(SCORING_WEIGHTS.financialImpact, (t.lostGmv + t.partialRefund) / 20000);
  riskScore = Math.min(100, Math.round(riskScore));
  var riskLevel = classifyRiskLevel_(riskScore);

  // ---- per-vendor risk scoring + top offenders ----
  var scoredVendors = agg.vendors.map(function(v) {
    v.riskScore = scoreVendor_(v, target);
    v.riskLevel = classifyRiskLevel_(v.riskScore);
    return v;
  });

  var offenders = scoredVendors.filter(function(v) {
    return v.failedOrders > 0 || v.vendorFaultCases > 0;
  }).sort(function(a, b) {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return b.failedOrders - a.failedOrders;
  });

  var topOffenders = offenders.slice(0, TOP_OFFENDERS_LIMIT).map(function(v) {
    return {
      vendorId: v.vendorId, vendor: v.vendor, city: v.city,
      allOrders: v.allOrders, failedOrders: v.failedOrders,
      failRate: v.failRate, lostGmv: v.lostGmv, partialRefund: v.partialRefund,
      amName: v.amName, amEmail: v.amEmail, teamLeaderName: v.teamLeaderName,
      teamLeaderEmail: def.tlEmail,
      segment: v.segment,
      isKey: v.isKey, isTgo: v.isTgo, isFood: v.isFood, chainId: v.chainId,
      lateDeliveryCases: v.lateDeliveryCases, missingItemCases: v.missingItemCases,
      foodQualityCases: v.qualityCases, qualityCases: v.qualityCases,
      vendorFaultCases: v.vendorFaultCases,
      topReason: v.topReason, rootCause: v.rootCause,
      riskScore: v.riskScore, riskLevel: v.riskLevel
    };
  });

  var cityDetails = agg.cities.map(function(c) {
    return {
      city: c.city, allOrders: c.allOrders, failedOrders: c.failedOrders,
      vendorFailRate: c.vendorFailRate, lostGmv: c.lostGmv, partialRefund: c.partialRefund
    };
  });

  return {
    cluster: clusterKey, key: clusterKey, name: def.name,
    segment: def.segment,
    tlName: def.tlName, tlEmail: def.tlEmail,
    target: target, targetLabel: def.targetLabel,
    allOrders: allOrders, failedOrders: failedOrders, successfulOrders: allOrders - failedOrders,
    lostGmv: Math.round(t.lostGmv), partialRefund: Math.round(t.partialRefund),
    financialImpact: Math.round(t.lostGmv + t.partialRefund),
    vendorFailRate: +(vendorFailRate * 100).toFixed(3),
    deviation: +(deviation * 100).toFixed(3),
    deviationPct: +deviationPct.toFixed(1),
    vendorFaultCases: t.vendorFaultCases,
    lateDeliveryCases: t.lateDeliveryCases, missingItemCases: t.missingItemCases,
    qualityCases: t.qualityCases, foodQualityCases: t.qualityCases,
    riskScore: riskScore, riskLevel: riskLevel,
    vendorCount: agg.vendors.length,
    offenderCount: offenders.length,
    cities: cityDetails,
    topOffenders: topOffenders,
    failReasons: agg.failReasons.slice(0, 12)
  };
}

function scoreVendor_(v, target) {
  var rate = v.allOrders > 0 ? v.failedOrders / v.allOrders : 0;
  var relDev = target > 0 ? Math.max(0, (rate - target) / target) : 0;
  var s = 0;
  s += Math.min(35, relDev * 18);                                  // severity over target
  s += Math.min(30, v.failedOrders / 2);                           // absolute failed volume
  s += Math.min(20, v.vendorFaultCases * 1.5);                     // vendor-fault case load
  s += Math.min(15, (v.lostGmv + v.partialRefund) / 3000);         // financial impact
  return Math.min(100, Math.round(s));
}

function classifyRiskLevel_(score) {
  if (score >= 76) return 'critical';
  if (score >= 51) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}
