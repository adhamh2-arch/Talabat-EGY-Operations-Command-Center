/**
 * DataReader.gs — reads the 7 external feeder spreadsheets and aggregates
 * each reporting cluster from the consolidated 19-column table.
 *
 * Grain of a feeder row = vendor x fail_reason. A vendor spans several rows;
 * the "N/A" reason row carries its non-failed net orders, and each real
 * fail-reason row carries that reason's failed orders. So a vendor's totals
 * are the SUM of its rows across all reasons.
 *
 * Self-healing: for every cluster we evaluate both the "Extract 1" (full data)
 * and "Connected Sheet 1" (live, correctly filtered but ~500-row preview) tabs
 * and use whichever yields more correctly-filtered rows, logging a warning when
 * a feeder's Extract looks stale so the owner knows to refresh it.
 */

var __FEEDER_TAB_CACHE = {};

function num_(x) {
  var n = Number(x);
  return isNaN(n) ? 0 : n;
}

function yes_(x) {
  return String(x == null ? '' : x).trim().toLowerCase() === 'yes';
}

// ---------- raw tab reading ----------

function findHeaderRow_(values) {
  var limit = Math.min(values.length, 8);
  for (var i = 0; i < limit; i++) {
    if (values[i] && String(values[i][0]).trim() === FEED_HEADER_KEY) return i;
  }
  return -1;
}

function readFeederTab_(feederKey, tabName) {
  var cacheKey = feederKey + '::' + tabName;
  if (__FEEDER_TAB_CACHE.hasOwnProperty(cacheKey)) return __FEEDER_TAB_CACHE[cacheKey];

  var out = { rows: [], tab: tabName, header: -1, exists: false };
  try {
    var ss = SpreadsheetApp.openById(FEEDERS[feederKey].sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (sheet) {
      out.exists = true;
      var values = sheet.getDataRange().getValues();
      var h = findHeaderRow_(values);
      out.header = h;
      if (h >= 0) {
        for (var i = h + 1; i < values.length; i++) {
          var r = values[i];
          if (!r) continue;
          if (String(r[FEED_COLS.vendorId]) === '' && String(r[FEED_COLS.vendor]) === '') continue;
          out.rows.push(r);
        }
      }
    }
  } catch (e) {
    out.error = e.message;
  }
  __FEEDER_TAB_CACHE[cacheKey] = out;
  return out;
}

function parseFeederRow_(r) {
  return {
    vendorId: String(r[FEED_COLS.vendorId] || ''),
    vendor: String(r[FEED_COLS.vendor] || ''),
    city: String(r[FEED_COLS.city] || ''),
    amName: String(r[FEED_COLS.amName] || ''),
    amEmail: String(r[FEED_COLS.amEmail] || '').trim(),
    teamLeaderName: String(r[FEED_COLS.teamLeaderName] || '').trim(),
    isTgo: String(r[FEED_COLS.isTgo] || '').trim(),
    isKey: String(r[FEED_COLS.isKey] || '').trim(),
    isFood: String(r[FEED_COLS.isFood] || '').trim(),
    zone: String(r[FEED_COLS.zone] || ''),
    reason: String(r[FEED_COLS.failReason] || '').trim(),
    netOrders: num_(r[FEED_COLS.netOrders]),
    failedOrders: num_(r[FEED_COLS.failedOrders]),
    lostGmv: num_(r[FEED_COLS.lostGmv]),
    lateDeliveryCases: num_(r[FEED_COLS.lateDeliveryCases]),
    missingItemCases: num_(r[FEED_COLS.missingItemCases]),
    qualityCases: num_(r[FEED_COLS.qualityCases]),
    partialRefund: num_(r[FEED_COLS.partialRefund])
  };
}

function rowMatchesCluster_(p, cluster) {
  var f = cluster.filter || {};
  if (f.isKey && !yes_(p.isKey)) return false;
  if (f.tl && f.tl.length) {
    var tl = normKey_(p.teamLeaderName);
    var hit = false;
    for (var i = 0; i < f.tl.length; i++) { if (normKey_(f.tl[i]) === tl) { hit = true; break; } }
    if (!hit) return false;
  }
  if (f.cities && f.cities.length) {
    var city = normKey_(p.city);
    var chit = false;
    for (var j = 0; j < f.cities.length; j++) { if (normKey_(f.cities[j]) === city) { chit = true; break; } }
    if (!chit) return false;
  }
  return true;
}

// Return the best-matching parsed rows for a cluster + a source descriptor.
function getClusterRows_(cluster) {
  var candidates = [];
  for (var t = 0; t < FEED_TAB_PREFERENCE.length; t++) {
    var tabName = FEED_TAB_PREFERENCE[t];
    var raw = readFeederTab_(cluster.feeder, tabName);
    if (!raw.exists || raw.rows.length === 0) continue;
    var matched = [];
    for (var i = 0; i < raw.rows.length; i++) {
      var p = parseFeederRow_(raw.rows[i]);
      if (rowMatchesCluster_(p, cluster)) matched.push(p);
    }
    candidates.push({ tab: tabName, matched: matched, rawCount: raw.rows.length });
  }
  if (candidates.length === 0) return { rows: [], source: 'none', note: 'no readable tab' };

  // pick the candidate with the most matched rows (most complete)
  candidates.sort(function(a, b) { return b.matched.length - a.matched.length; });
  var best = candidates[0];
  return { rows: best.matched, source: best.tab, candidates: candidates };
}

// ---------- aggregation ----------

function aggregateClusterFromRows_(clusterKey, prows) {
  var cluster = CLUSTERS[clusterKey];
  var vendorsMap = {};
  var citiesMap = {};
  var reasonsMap = {};

  prows.forEach(function(p) {
    var vid = p.vendorId || (p.vendor + '|' + p.city);
    if (!vendorsMap[vid]) {
      vendorsMap[vid] = {
        vendorId: p.vendorId, vendor: p.vendor, city: p.city,
        amName: p.amName, amEmail: p.amEmail, teamLeaderName: p.teamLeaderName,
        isTgo: p.isTgo, isKey: p.isKey, segment: yes_(p.isTgo) ? 'TGO' : 'TMP',
        allOrders: 0, failedOrders: 0, lostGmv: 0,
        lateDeliveryCases: 0, missingItemCases: 0, qualityCases: 0,
        partialRefund: 0, reasons: {}
      };
    }
    var v = vendorsMap[vid];
    v.allOrders += p.netOrders;
    v.failedOrders += p.failedOrders;
    v.lostGmv += p.lostGmv;
    v.lateDeliveryCases += p.lateDeliveryCases;
    v.missingItemCases += p.missingItemCases;
    v.qualityCases += p.qualityCases;
    v.partialRefund += p.partialRefund;
    if (!v.amEmail && p.amEmail) v.amEmail = p.amEmail;

    // city rollup
    var ckey = p.city || 'Unknown';
    if (!citiesMap[ckey]) citiesMap[ckey] = { city: ckey, allOrders: 0, failedOrders: 0, lostGmv: 0, partialRefund: 0 };
    citiesMap[ckey].allOrders += p.netOrders;
    citiesMap[ckey].failedOrders += p.failedOrders;
    citiesMap[ckey].lostGmv += p.lostGmv;
    citiesMap[ckey].partialRefund += p.partialRefund;

    // root-cause: real fail reasons only (net orders of a reason row = failed orders of that reason)
    var reason = p.reason;
    if (reason && reason.toUpperCase() !== 'N/A') {
      if (!reasonsMap[reason]) reasonsMap[reason] = { reason: reason, failedOrders: 0, vendorFaultCases: 0 };
      reasonsMap[reason].failedOrders += p.netOrders;
      reasonsMap[reason].vendorFaultCases += (p.lateDeliveryCases + p.missingItemCases + p.qualityCases);
      v.reasons[reason] = (v.reasons[reason] || 0) + p.netOrders;
    }
  });

  var vendors = Object.keys(vendorsMap).map(function(k) {
    var v = vendorsMap[k];
    v.vendorFaultCases = v.lateDeliveryCases + v.missingItemCases + v.qualityCases;
    v.foodQualityCases = v.qualityCases; // backward-compat alias
    v.failRate = v.allOrders > 0 ? +((v.failedOrders / v.allOrders) * 100).toFixed(2) : 0;
    v.lostGmv = Math.round(v.lostGmv);
    v.partialRefund = Math.round(v.partialRefund);
    // dominant fail reason for this vendor
    v.topReason = ''; v.topReasonFailed = 0;
    Object.keys(v.reasons).forEach(function(rk) {
      if (v.reasons[rk] > v.topReasonFailed) { v.topReasonFailed = v.reasons[rk]; v.topReason = rk; }
    });
    v.rootCause = vendorRootCause_(v);
    return v;
  });

  var cities = Object.keys(citiesMap).map(function(k) {
    var c = citiesMap[k];
    c.vendorFailRate = c.allOrders > 0 ? +((c.failedOrders / c.allOrders) * 100).toFixed(2) : 0;
    c.lostGmv = Math.round(c.lostGmv);
    c.partialRefund = Math.round(c.partialRefund);
    return c;
  }).sort(function(a, b) { return b.failedOrders - a.failedOrders; });

  var failReasons = Object.keys(reasonsMap).map(function(k) { return reasonsMap[k]; })
    .sort(function(a, b) { return b.failedOrders - a.failedOrders; });

  var totals = { allOrders: 0, failedOrders: 0, lostGmv: 0, partialRefund: 0, lateDeliveryCases: 0, missingItemCases: 0, qualityCases: 0 };
  vendors.forEach(function(v) {
    totals.allOrders += v.allOrders;
    totals.failedOrders += v.failedOrders;
    totals.lostGmv += v.lostGmv;
    totals.partialRefund += v.partialRefund;
    totals.lateDeliveryCases += v.lateDeliveryCases;
    totals.missingItemCases += v.missingItemCases;
    totals.qualityCases += v.qualityCases;
  });
  totals.vendorFaultCases = totals.lateDeliveryCases + totals.missingItemCases + totals.qualityCases;
  totals.vendorFailRate = totals.allOrders > 0 ? totals.failedOrders / totals.allOrders : 0;

  return {
    key: clusterKey, name: cluster.name,
    vendors: vendors, cities: cities, failReasons: failReasons, totals: totals
  };
}

// ---------- public entry ----------

function readFeedData() {
  __FEEDER_TAB_CACHE = {}; // fresh read each run
  var byCluster = {};
  var warnings = [];
  var health = [];
  var vendorOffendersFlat = [];
  var failReasonsFlat = [];

  Object.keys(CLUSTERS).forEach(function(ck) {
    var cluster = CLUSTERS[ck];
    var picked = getClusterRows_(cluster);
    var agg = aggregateClusterFromRows_(ck, picked.rows);
    byCluster[ck] = agg;

    health.push({
      cluster: cluster.name, feeder: FEEDERS[cluster.feeder].title,
      source: picked.source, vendorRows: agg.vendors.length,
      allOrders: agg.totals.allOrders, failedOrders: agg.totals.failedOrders
    });

    if (picked.rows.length === 0) {
      warnings.push('⚠ ' + cluster.name + ': 0 rows matched in feeder "' + FEEDERS[cluster.feeder].title +
                    '". Refresh the feeder extract (expected TL/cities: ' + describeFilter_(cluster.filter) + ').');
    } else if (picked.source === 'Connected Sheet 1') {
      warnings.push('ℹ ' + cluster.name + ': using live "Connected Sheet 1" (preview-capped ~500 rows) because "Extract 1" looked stale/empty. Refresh "' + FEEDERS[cluster.feeder].title + '" › Extract for complete data.');
    }

    agg.vendors.forEach(function(v) {
      var flat = {};
      Object.keys(v).forEach(function(kk) { flat[kk] = v[kk]; });
      flat.cluster = ck; flat.clusterName = cluster.name;
      vendorOffendersFlat.push(flat);
    });
    agg.failReasons.forEach(function(r) {
      failReasonsFlat.push({ cluster: ck, clusterName: cluster.name, reason: r.reason, failedOrders: r.failedOrders, vendorFaultCases: r.vendorFaultCases });
    });
  });

  return {
    byCluster: byCluster,
    warnings: warnings,
    health: health,
    vendorOffenders: vendorOffendersFlat, // flat list, cluster-tagged
    failReasons: failReasonsFlat
  };
}

function describeFilter_(f) {
  if (!f) return 'all';
  if (f.isKey) return 'is_key = Yes';
  if (f.tl) return 'TL = ' + f.tl.join(' / ');
  if (f.cities) return 'cities = ' + f.cities.join(', ');
  return 'all';
}

// Simplified, one-line root cause for a vendor (dominant fault type + top fail reason).
function vendorRootCause_(v) {
  var cases = [['late delivery', v.lateDeliveryCases], ['missing items', v.missingItemCases], ['food quality', v.qualityCases]];
  cases.sort(function(a, b) { return b[1] - a[1]; });
  var parts = [];
  if (cases[0][1] > 0) parts.push(cases[0][0] + ' (' + cases[0][1] + ' case' + (cases[0][1] === 1 ? '' : 's') + ')');
  if (v.topReason && v.topReasonFailed > 0) {
    var label = (typeof shortenReasonName_ === 'function') ? shortenReasonName_(v.topReason) : v.topReason;
    parts.push('top reason: ' + label + ' (' + v.topReasonFailed + ' failed)');
  }
  if (parts.length === 0) parts.push('elevated failed orders (' + v.failedOrders + ')');
  return parts.join('; ');
}
