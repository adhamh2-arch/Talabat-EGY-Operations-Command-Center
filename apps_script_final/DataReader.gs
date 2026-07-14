/** DataReader.gs - reads the 7 external feeders, aggregates each cluster from the consolidated table.
 *  v5.1.1: columns are resolved by HEADER NAME per tab (buildColMap_), NOT fixed indexes, because
 *  feeders differ — some have the 3 chain columns (chain name/id + order date), some don't. This
 *  makes net_orders / vendor_net_failed always read the correct column on every feeder. */
var __FEEDER_TAB_CACHE = {};
function num_(x) { var n = Number(x); return isNaN(n) ? 0 : n; }
function yes_(x) { return String(x == null ? '' : x).trim().toLowerCase() === 'yes'; }
function cell_(r, i) { return (i >= 0 && r && i < r.length) ? r[i] : ''; }

/** Map logical fields to column indexes using the feeder's header row (by DB field name). */
function buildColMap_(header) {
  var idx = {};
  for (var i = 0; i < header.length; i++) {
    var name = String(header[i] == null ? '' : header[i]).trim().toLowerCase();
    if (name && !idx.hasOwnProperty(name)) idx[name] = i;
  }
  function pick() {
    for (var j = 0; j < arguments.length; j++) {
      var n = String(arguments[j]).toLowerCase();
      if (idx.hasOwnProperty(n)) return idx[n];
    }
    return -1;
  }
  return {
    vendorId:          pick('dim_vendor_info_vendor_id'),
    vendor:            pick('dim_vendor_info_vendor_name'),
    city:              pick('delivery_location_city_name'),
    amName:            pick('dim_vendor_info_account_manager_name'),
    amEmail:           pick('dim_vendor_info_account_manager_email'),
    teamLeaderName:    pick('dim_vendor_info_team_leader_name'),
    isTgo:             pick('dim_vendor_info_is_tgo'),
    isKey:             pick('dim_vendor_info_is_key_vip_account'),
    isFood:            pick('dim_vendor_info_is_food'),
    zone:              pick('dim_vendor_info_vendor_zone'),
    failReason:        pick('dim_order_fail_reason_talabat_reason'),
    chainName:         pick('dim_chain_chain_name'),
    chainId:           pick('dim_chain_chain_id'),
    orderDate:         pick('fct_order_info_order_date_date'),
    netOrders:         pick('fct_order_info_net_orders_count'),
    failedOrders:      pick('fct_order_info_vendor_net_failed_orders_count'),
    lostGmv:           pick('fct_order_info_lost_gmv_amount_lc'),
    lateDeliveryCases: pick('fct_contact_vf_customer_incoming_cases_late_delivery'),
    missingItemCases:  pick('fct_contact_vf_customer_incoming_cases_missing_items'),
    qualityCases:      pick('fct_contact_vf_customer_incoming_cases_quality'),
    partialRefund:     pick('fct_repayment_partial_refund_amount_lc'),
    contactRate:       pick('fct_contact_customer_contact_rate')
  };
}

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
  var out = { rows: [], tab: tabName, header: -1, exists: false, colMap: null };
  try {
    var ss = SpreadsheetApp.openById(FEEDERS[feederKey].sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (sheet) {
      out.exists = true;
      var values = sheet.getDataRange().getValues();
      var h = findHeaderRow_(values);
      out.header = h;
      if (h >= 0) {
        var cm = buildColMap_(values[h]);
        out.colMap = cm;
        for (var i = h + 1; i < values.length; i++) {
          var r = values[i];
          if (!r) continue;
          if (String(cell_(r, cm.vendorId)) === '' && String(cell_(r, cm.vendor)) === '') continue;
          out.rows.push(r);
        }
      }
    }
  } catch (e) { out.error = e.message; }
  __FEEDER_TAB_CACHE[cacheKey] = out;
  return out;
}

function parseFeederRow_(r, cm) {
  return {
    vendorId: String(cell_(r, cm.vendorId) || ''),
    vendor: String(cell_(r, cm.vendor) || ''),
    city: String(cell_(r, cm.city) || ''),
    amName: String(cell_(r, cm.amName) || ''),
    amEmail: String(cell_(r, cm.amEmail) || '').trim(),
    teamLeaderName: String(cell_(r, cm.teamLeaderName) || '').trim(),
    isTgo: String(cell_(r, cm.isTgo) || '').trim(),
    isKey: String(cell_(r, cm.isKey) || '').trim(),
    isFood: String(cell_(r, cm.isFood) || '').trim(),
    zone: String(cell_(r, cm.zone) || ''),
    reason: String(cell_(r, cm.failReason) || '').trim(),
    chainName: String(cell_(r, cm.chainName) || '').trim(),
    chainId: String(cell_(r, cm.chainId) || '').trim(),
    orderDate: String(cell_(r, cm.orderDate) || '').trim(),
    netOrders: num_(cell_(r, cm.netOrders)),
    failedOrders: num_(cell_(r, cm.failedOrders)),
    lostGmv: num_(cell_(r, cm.lostGmv)),
    lateDeliveryCases: num_(cell_(r, cm.lateDeliveryCases)),
    missingItemCases: num_(cell_(r, cm.missingItemCases)),
    qualityCases: num_(cell_(r, cm.qualityCases)),
    partialRefund: num_(cell_(r, cm.partialRefund))
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

function getClusterRows_(cluster) {
  var candidates = [];
  for (var t = 0; t < FEED_TAB_PREFERENCE.length; t++) {
    var tabName = FEED_TAB_PREFERENCE[t];
    var raw = readFeederTab_(cluster.feeder, tabName);
    if (!raw.exists || raw.rows.length === 0 || !raw.colMap) continue;
    if (raw.colMap.netOrders < 0 || raw.colMap.failedOrders < 0) continue; // guard: required cols must exist
    var matched = [];
    for (var i = 0; i < raw.rows.length; i++) {
      var p = parseFeederRow_(raw.rows[i], raw.colMap);
      if (rowMatchesCluster_(p, cluster)) matched.push(p);
    }
    candidates.push({ tab: tabName, matched: matched, rawCount: raw.rows.length });
  }
  if (candidates.length === 0) return { rows: [], source: 'none', note: 'no readable tab' };
  candidates.sort(function(a, b) { return b.matched.length - a.matched.length; });
  var best = candidates[0];
  return { rows: best.matched, source: best.tab, candidates: candidates };
}

function aggregateClusterFromRows_(clusterKey, prows) {
  var cluster = CLUSTERS[clusterKey];
  var vendorsMap = {}, citiesMap = {}, reasonsMap = {};
  prows.forEach(function(p) {
    var vid = p.vendorId || (p.vendor + '|' + p.city);
    if (!vendorsMap[vid]) {
      vendorsMap[vid] = {
        vendorId: p.vendorId, vendor: p.vendor, city: p.city,
        amName: p.amName, amEmail: p.amEmail, teamLeaderName: p.teamLeaderName,
        isTgo: p.isTgo, isKey: p.isKey, isFood: p.isFood, segment: yes_(p.isTgo) ? 'TGO' : 'TMP',
        chainName: p.chainName, chainId: p.chainId,
        allOrders: 0, failedOrders: 0, lostGmv: 0,
        lateDeliveryCases: 0, missingItemCases: 0, qualityCases: 0,
        partialRefund: 0, reasons: {}
      };
    }
    var v = vendorsMap[vid];
    if (!v.chainId && p.chainId) v.chainId = p.chainId;
    if (!v.chainName && p.chainName) v.chainName = p.chainName;
    // allOrders = total net orders (denominator); failedOrders = VENDOR net failed (numerator).
    v.allOrders += p.netOrders; v.failedOrders += p.failedOrders; v.lostGmv += p.lostGmv;
    v.lateDeliveryCases += p.lateDeliveryCases; v.missingItemCases += p.missingItemCases;
    v.qualityCases += p.qualityCases; v.partialRefund += p.partialRefund;
    if (!v.amEmail && p.amEmail) v.amEmail = p.amEmail;
    var ckey = p.city || 'Unknown';
    if (!citiesMap[ckey]) citiesMap[ckey] = { city: ckey, allOrders: 0, failedOrders: 0, lostGmv: 0, partialRefund: 0 };
    citiesMap[ckey].allOrders += p.netOrders; citiesMap[ckey].failedOrders += p.failedOrders;
    citiesMap[ckey].lostGmv += p.lostGmv; citiesMap[ckey].partialRefund += p.partialRefund;
    var reason = p.reason;
    if (reason && reason.toUpperCase() !== 'N/A') {
      if (!reasonsMap[reason]) reasonsMap[reason] = { reason: reason, failedOrders: 0, vendorFaultCases: 0 };
      // count vendor-failed orders per reason (numerator driver), not gross orders
      reasonsMap[reason].failedOrders += p.failedOrders;
      reasonsMap[reason].vendorFaultCases += (p.lateDeliveryCases + p.missingItemCases + p.qualityCases);
      v.reasons[reason] = (v.reasons[reason] || 0) + p.failedOrders;
    }
  });
  var vendors = Object.keys(vendorsMap).map(function(k) {
    var v = vendorsMap[k];
    v.vendorFaultCases = v.lateDeliveryCases + v.missingItemCases + v.qualityCases;
    v.foodQualityCases = v.qualityCases;
    // Vendor Fail Rate % = vendor net failed orders / net orders * 100
    v.failRate = v.allOrders > 0 ? +((v.failedOrders / v.allOrders) * 100).toFixed(2) : 0;
    v.lostGmv = Math.round(v.lostGmv);
    v.partialRefund = Math.round(v.partialRefund);
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
    c.lostGmv = Math.round(c.lostGmv); c.partialRefund = Math.round(c.partialRefund);
    return c;
  }).sort(function(a, b) { return b.failedOrders - a.failedOrders; });
  var failReasons = Object.keys(reasonsMap).map(function(k) { return reasonsMap[k]; })
    .sort(function(a, b) { return b.failedOrders - a.failedOrders; });
  var totals = { allOrders: 0, failedOrders: 0, lostGmv: 0, partialRefund: 0, lateDeliveryCases: 0, missingItemCases: 0, qualityCases: 0 };
  vendors.forEach(function(v) {
    totals.allOrders += v.allOrders; totals.failedOrders += v.failedOrders; totals.lostGmv += v.lostGmv;
    totals.partialRefund += v.partialRefund; totals.lateDeliveryCases += v.lateDeliveryCases;
    totals.missingItemCases += v.missingItemCases; totals.qualityCases += v.qualityCases;
  });
  totals.vendorFaultCases = totals.lateDeliveryCases + totals.missingItemCases + totals.qualityCases;
  totals.vendorFailRate = totals.allOrders > 0 ? totals.failedOrders / totals.allOrders : 0;
  return { key: clusterKey, name: cluster.name, vendors: vendors, cities: cities, failReasons: failReasons, totals: totals };
}

function readFeedData() {
  __FEEDER_TAB_CACHE = {};
  var byCluster = {}, warnings = [], health = [], vendorOffendersFlat = [], failReasonsFlat = [];
  Object.keys(CLUSTERS).forEach(function(ck) {
    var cluster = CLUSTERS[ck];
    var picked = getClusterRows_(cluster);
    var agg = aggregateClusterFromRows_(ck, picked.rows);
    byCluster[ck] = agg;
    health.push({ cluster: cluster.name, feeder: FEEDERS[cluster.feeder].title, source: picked.source, vendorRows: agg.vendors.length, allOrders: agg.totals.allOrders, failedOrders: agg.totals.failedOrders });
    if (picked.rows.length === 0) {
      warnings.push('[!] ' + cluster.name + ': 0 rows matched in feeder [' + FEEDERS[cluster.feeder].title + ']. Refresh the feeder extract (expected ' + describeFilter_(cluster.filter) + ').');
    } else if (picked.source === 'Connected Sheet 1') {
      warnings.push('[i] ' + cluster.name + ': using live [Connected Sheet 1] (preview-capped ~500 rows) because [Extract 1] looked stale/empty. Refresh [' + FEEDERS[cluster.feeder].title + '] Extract for complete data.');
    }
    agg.vendors.forEach(function(v) {
      var flat = {}; Object.keys(v).forEach(function(kk) { flat[kk] = v[kk]; });
      flat.cluster = ck; flat.clusterName = cluster.name; vendorOffendersFlat.push(flat);
    });
    agg.failReasons.forEach(function(r) {
      failReasonsFlat.push({ cluster: ck, clusterName: cluster.name, reason: r.reason, failedOrders: r.failedOrders, vendorFaultCases: r.vendorFaultCases });
    });
  });
  return { byCluster: byCluster, warnings: warnings, health: health, vendorOffenders: vendorOffendersFlat, failReasons: failReasonsFlat };
}

function describeFilter_(f) {
  if (!f) return 'all';
  if (f.isKey) return 'is_key = Yes';
  if (f.tl) return 'TL = ' + f.tl.join(' / ');
  if (f.cities) return 'cities = ' + f.cities.join(', ');
  return 'all';
}

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
