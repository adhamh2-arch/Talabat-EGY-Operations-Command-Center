/**
 * Config.gs - talabat EGY Operations Command Center v5.1 (July 2026 restructure)
 * Data lives in 7 EXTERNAL feeder spreadsheets (Looker Connected Sheets), one per
 * agent/cluster; each holds ONE consolidated table.
 * v5.1: feeder now has 3 new columns before net orders (L Chain name, M Chain ID, N Order date).
 */
var SPREADSHEET_ID = '1W_4kxTBPa6OzZYcjf3_1tXRNH1YUwzZXBnZBFcZyFys';
var TRACKER_URL = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit#gid=0';

var FEEDERS = {
  alex:          { sheetId: '18hENIBCIbMLJrJtCC3sJgGkAEUlJ6cHCNYBl6nhHB0E', title: 'Feed - Vendor Daily Performance Alex',           agent: 'Alex Agent' },
  delta:         { sheetId: '1c-PJ9GSnhAXIaLCdqCjk-x2M4Lkxie8574sMgFphjWw', title: 'Feed - Vendor Daily Performance Delta',          agent: 'Delta Agent' },
  esm:           { sheetId: '1fy770Ay452QE1uJXEOvpNKy5ODSZnvNWM_nICYP6QAU', title: 'Feed - Vendor Daily Performance Upper and Canal', agent: 'ESM Agent' },
  key:           { sheetId: '1W2hV0vCLdyOXlhwYFeIoEq0JRmP3MSSWdOyYC0q4gUQ', title: 'Feed - Vendor Daily Performance Key Accounts',   agent: 'Key Agent' },
  cairo_east:    { sheetId: '14lpdsdUnccCDOlu4BddCLgZuBMut4zmPLxL1WjscXKA', title: 'Feed - Vendor Daily Performance Cairo East',     agent: 'Cairo Agent 1' },
  cairo_west:    { sheetId: '1_eD-g5Bm6rBBn6DxFmnDDT7bum0LLdkAH4oXDGmCxtk', title: 'Feed - Vendor Daily Performance Cairo West',     agent: 'Cairo Agent 2' },
  cairo_central: { sheetId: '1Qll2NfDKq3CKp3nLTQuvDpIdQiAenSpTyqWOE-gknIQ', title: 'Feed - Vendor Daily Performance Cairo Central',  agent: 'Cairo Agent 3' }
};

var UPPER_EGYPT_CITIES = ['Hurghada', 'Assiut', 'Minya', 'Beni Suef', 'Suhag', 'Sohag'];
var CANAL_CITIES = ['Port Said', 'Suez', 'Ismailia', 'Damietta New', 'Ras El Bar', 'Damietta'];

var CLUSTERS = {
  alex:          { name: 'Alex',          feeder: 'alex',          target: 0.0070, segment: 'TMP', tlName: 'Rowan Elkersh',       tlEmail: 'rowan.elkersh@talabat.com',  filter: { tl: ['Rowan Elkersh'] } },
  delta:         { name: 'Delta',         feeder: 'delta',         target: 0.0072, segment: 'TMP', tlName: 'Ahmed Elhaddad',      tlEmail: 'ahmed.elhaddad@talabat.com', filter: { tl: ['Ahmed Elhaddad'] } },
  upper_egypt:   { name: 'Upper Egypt',   feeder: 'esm',           target: 0.0078, segment: 'TMP', tlName: 'Ahmed el Gharably',   tlEmail: 'ahmed.el.13@talabat.com',    filter: { cities: UPPER_EGYPT_CITIES } },
  canal:         { name: 'Canal',         feeder: 'esm',           target: 0.0072, segment: 'TMP', tlName: 'Ahmed el Gharably',   tlEmail: 'ahmed.el.13@talabat.com',    filter: { cities: CANAL_CITIES } },
  key_accounts:  { name: 'Key Accounts',  feeder: 'key',           target: 0.0085, segment: 'KEY', tlName: 'Hadeer Bahaa',        tlEmail: 'hadeer.bahaa@talabat.com',   filter: { isKey: true } },
  cairo_east_1:  { name: 'Cairo East 1',  feeder: 'cairo_east',    target: 0.0080, segment: 'TMP', tlName: 'Mostafa Attia',       tlEmail: 'mostafa.ismail@talabat.com', filter: { tl: ['Mostafa Attia'] } },
  cairo_east_2:  { name: 'Cairo East 2',  feeder: 'cairo_east',    target: 0.0080, segment: 'TMP', tlName: 'Nourhan AbdelMoaeen', tlEmail: 'norhane.mohamed@talabat.com',filter: { tl: ['Nourhan AbdelMoaeen'] } },
  cairo_west:    { name: 'Cairo West',    feeder: 'cairo_west',    target: 0.0080, segment: 'TMP', tlName: 'Fayez Bshay',         tlEmail: 'fayez.ossam@talabat.com',    filter: { tl: ['Fayez Bshay'] } },
  cairo_central: { name: 'Cairo Central', feeder: 'cairo_central', target: 0.0078, segment: 'TMP', tlName: 'Ahmed Sheiha',        tlEmail: 'ahmed.sheiha@talabat.com',   filter: { tl: ['Ahmed Sheiha'] } }
};

Object.keys(CLUSTERS).forEach(function(k) {
  CLUSTERS[k].key = k;
  CLUSTERS[k].targetLabel = (CLUSTERS[k].target * 100).toFixed(2) + '%';
});

var SEGMENT_TARGETS = {
  TGO: { label: 'TGO', target: 0.0065, targetLabel: '0.65%' },
  TMP: { label: 'TMP', target: 0.0075, targetLabel: '0.75%' }
};

/**
 * Feeder column indices (0-based). v5.1: 3 columns inserted before net orders:
 *   L(11) chain name, M(12) chain id, N(13) order date. Everything after shifts +3.
 */
var FEED_COLS = {
  vendorId: 0, vendor: 1, city: 2, amName: 3, amEmail: 4, teamLeaderName: 5,
  isTgo: 6, isKey: 7, isFood: 8, zone: 9, failReason: 10,
  chainName: 11, chainId: 12, orderDate: 13,
  netOrders: 14, failedOrders: 15, lostGmv: 16,
  lateDeliveryCases: 17, missingItemCases: 18, qualityCases: 19,
  partialRefund: 20, contactRate: 21
};
var FEED_HEADER_KEY = 'dim_vendor_info_vendor_id';
var FEED_TAB_PREFERENCE = ['Extract 1', 'Connected Sheet 1'];

var SHEET_NAMES = {
  executiveSummary: 'Executive Summary',
  operationalPerformance: 'Operational Performance',
  financialImpact: 'Financial Impact',
  rootCauseAnalysis: 'Root Cause Analysis',
  riskMonitoring: 'Risk Register',
  vendorTracker: 'Vendor Action Tracker',
  qualityReview: 'Quality Review',
  monitoring: 'Monitoring Log',
  auditTrail: 'Audit Trail',
  projectStructure: 'Project Structure'
};

var THEME = {
  primary: '#FF5900', primaryDark: '#B34700', primaryTint: '#FCA06F', primaryBg: '#FFF3E7',
  cream: '#F4EDE3', burgundy: '#411517', lime: '#CFFF00',
  critical: '#D32F2F', high: '#FF5900', medium: '#FFB300', low: '#2E7D32',
  headerText: '#FFFFFF', muted: '#8A7F76'
};

var SEND_AS_EMAIL = 'exp.eg@talabat.com';
var CC_EMAIL = 'exp.eg@talabat.com';
var ALERT_EMAIL = 'adham.h.2@talabat.com';
var EMAIL_SENDER_NAME = 'talabat EGY Expansion Operations';

var SCORING_WEIGHTS = { deviation: 40, vendorFaultCases: 30, orderVolume: 20, financialImpact: 10 };
var TOP_OFFENDERS_LIMIT = 5;
var CRITICAL_MIN_FAILED = 1;

function getCairoDate(offsetDays) {
  var d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return Utilities.formatDate(d, 'Africa/Cairo', 'yyyy-MM-dd');
}
function getCairoMonth() {
  return Utilities.formatDate(new Date(), 'Africa/Cairo', 'MMMM yyyy');
}
function getMtdRange() {
  var now = new Date();
  var start = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'Africa/Cairo', 'yyyy-MM-dd');
  var end = Utilities.formatDate(now, 'Africa/Cairo', 'yyyy-MM-dd');
  var dayNum = parseInt(Utilities.formatDate(now, 'Africa/Cairo', 'dd'), 10);
  return {
    start: start, end: end, days: dayNum,
    label: Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'Africa/Cairo', 'MMM d') +
           ' - ' + Utilities.formatDate(now, 'Africa/Cairo', 'd, yyyy')
  };
}
function normKey_(s) {
  return String(s == null ? '' : s).trim().replace(/\.+$/, '').toLowerCase();
}

var LOOKER_DASHBOARD = 'https://talabat.eu.looker.com/dashboards/29204';
function buildDashboardUrl_(clusterKey) {
  var c = CLUSTERS[clusterKey];
  if (!c) return LOOKER_DASHBOARD;
  var f = c.filter || {};
  var p = { 'Local Order Date': 'this month', 'Is Active (Yes / No)': 'Yes' };
  if (f.isKey) {
    p['Is Key VIP Account (Yes / No)'] = 'Yes';
    p['Is Food (Yes / No)'] = 'Yes';
  } else {
    p['Is Food (Yes / No)'] = 'Yes';
    p['Is Key VIP Account (Yes / No)'] = 'No';
    if (f.tl) p['Team Leader Name'] = f.tl.join(',');
    if (f.cities) { p['Vendor City'] = f.cities.join(','); if (c.tlName) p['Team Leader Name'] = c.tlName; }
  }
  var qs = Object.keys(p).map(function(k) { return lookerEnc_(k) + '=' + lookerEnc_(p[k]); }).join('&');
  return LOOKER_DASHBOARD + '?' + qs;
}
function lookerEnc_(s) {
  return encodeURIComponent(String(s)).replace(/%20/g, '+').replace(/%2C/g, ',');
}
/** DataReader.gs - reads the 7 external feeders, aggregates each cluster from the consolidated table.
 *  Uses FEED_COLS (Config.gs) for all offsets, so it auto-follows the v5.1 column shift. */
var __FEEDER_TAB_CACHE = {};
function num_(x) { var n = Number(x); return isNaN(n) ? 0 : n; }
function yes_(x) { return String(x == null ? '' : x).trim().toLowerCase() === 'yes'; }

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
  } catch (e) { out.error = e.message; }
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
    chainName: String(r[FEED_COLS.chainName] || '').trim(),
    chainId: String(r[FEED_COLS.chainId] || '').trim(),
    orderDate: String(r[FEED_COLS.orderDate] || '').trim(),
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
      reasonsMap[reason].failedOrders += p.netOrders;
      reasonsMap[reason].vendorFaultCases += (p.lateDeliveryCases + p.missingItemCases + p.qualityCases);
      v.reasons[reason] = (v.reasons[reason] || 0) + p.netOrders;
    }
  });
  var vendors = Object.keys(vendorsMap).map(function(k) {
    var v = vendorsMap[k];
    v.vendorFaultCases = v.lateDeliveryCases + v.missingItemCases + v.qualityCases;
    v.foodQualityCases = v.qualityCases;
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
  return pa/**
 * ScoringEngine.gs — cluster + vendor risk scoring on the new consolidated data.
 * processAllClusters(feedData) consumes feedData.byCluster (from DataReader).
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
  s += Math.min/**
 * TrackerWriter.gs — v5.1 (31-column live schema).
 * Writes daily offenders into the Vendor Action Tracker (cols A–AE / 1–31).
 * The 4 action columns AF–AI (32–35, Chain ID / Requested Action / Last Portal Status /
 * Action Duration) are OWNED by ActionTool.gs and are never touched here.
 */
var TRACKER_COLS = 31;

function updateVendorTracker(scoredOutput, feedData, emailsSent) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetName = SHEET_NAMES.vendorTracker;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initTrackerSheet_(sheet);
  } else {
    var lastCol = Math.max(sheet.getLastColumn(), TRACKER_COLS);
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    // col 20 (index 19) must be 'Risk Score' in the 31-col schema; else migrate.
    if (String(headerRow[19]) !== 'Risk Score') {
      Logger.log('Migrating tracker to v5.1 schema (31 columns).');
      sheet.clear();
      initTrackerSheet_(sheet);
    }
  }

  var today = getCairoDate(0);

  var existing = sheet.getDataRange().getValues();
  for (var i = 1; i < existing.length; i++) {
    if (String(existing[i][0]) === today) {
      return { rowsAdded: 0, message: 'Skipped — already tracked for ' + today };
    }
  }

  var history = {};
  for (var i = 1; i < existing.length; i++) {
    var vn = String(existing[i][2]);
    if (vn) history[vn] = (history[vn] || 0) + 1;
  }

  var rows = [];
  scoredOutput.clusterResults.forEach(function(cluster) {
    (cluster.topOffenders || []).forEach(function(v) {
      var appearances = (history[v.vendor] || 0) + 1;
      rows.push([
        today,
        v.vendorId || '',
        v.vendor,
        v.city,
        cluster.name,
        v.amName || '',
        v.amEmail || '',
        v.teamLeaderName || '',
        v.isKey || '',
        v.isTgo || '',
        v.isFood || '',
        v.allOrders || 0,
        v.failedOrders,
        v.lostGmv,
        v.failRate + '%',
        v.foodQualityCases || 0,
        v.lateDeliveryCases || 0,
        v.missingItemCases || 0,
        v.vendorFaultCases || 0,
        (v.riskScore != null ? v.riskScore : cluster.riskScore),
        String(v.riskLevel || cluster.riskLevel).toUpperCase(),
        appearances,
        getRepeatFlag_(appearances),
        '', '', '', '', '', '', '',
        'Open'
      ]);
    });
  });

  if (rows.length === 0) {
    return { rowsAdded: 0, message: 'No offenders to track' };
  }

  rows.sort(function(a, b) {
    if (b[21] !== a[21]) return b[21] - a[21];   // appearances desc
    return b[18] - a[18];                         // vendor fault cases desc
  });

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, TRACKER_COLS).setValues(rows);

  formatTrackerRows_(sheet, startRow, rows.length);
  applyTrackerProtection_(sheet);

  return { rowsAdded: rows.length, message: rows.length + ' vendors tracked for ' + today };
}

function initTrackerSheet_(sheet) {
  var headers = [
    'Run Date', 'Vendor ID', 'Vendor Name', 'City', 'Cluster',
    'AM Name', 'AM Email', 'Team Leader', 'Is Key VIP', 'Is TGO', 'Is Food',
    'Net Orders', 'Net Failed Orders', 'Lost GMV (EGP)', 'Net Fail Rate %',
    'Order Quality Cases', 'Late Delivery Cases', 'Missing Item Cases', 'Vendor Fault Cases',
    'Risk Score', 'Risk Level', 'Appearances MTD', 'Repeat Flag',
    'Alert Sent', 'Alert Date', 'Escalation Sent', 'Escalation Date',
    'Performance Improved', 'Action Plan Shared', 'Action Plan Details', 'Status'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var hdr = sheet.getRange(1, 1, 1, headers.length);
  hdr.setBackground(THEME.primary)
     .setFontColor(THEME.headerText)
     .setFontWeight('bold')
     .setFontSize(10)
     .setHorizontalAlignment('center')
     .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // segment flags + case-data + workflow header tints
  sheet.getRange(1, 9, 1, 3).setBackground('#8A5A00');
  sheet.getRange(1, 16, 1, 4).setBackground('#E65100');
  sheet.getRange(1, 24, 1, 8).setBackground('#E65100');

  var widths = [100, 90, 240, 120, 90, 140, 200, 140, 80, 70, 70, 90, 90, 110, 80, 90, 90, 90, 90, 70, 80, 90, 80, 80, 90, 90, 100, 100, 110, 260, 90];
  for (var i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  var yn = SpreadsheetApp.newDataValidation().requireValueInList(['', 'Yes', 'No']).setAllowInvalid(false).build();
  sheet.getRange('X2:X1000').setDataValidation(yn);   // Alert Sent
  sheet.getRange('Z2:Z1000').setDataValidation(yn);   // Escalation Sent

  var improvedRule = SpreadsheetApp.newDataValidation().requireValueInList(['', 'Yes', 'No', 'N/A']).setAllowInvalid(false).build();
  sheet.getRange('AB2:AB1000').setDataValidation(improvedRule);  // Performance Improved

  var actionRule = SpreadsheetApp.newDataValidation().requireValueInList(['', 'Yes', 'No', 'Partial']).setAllowInvalid(false).build();
  sheet.getRange('AC2:AC1000').setDataValidation(actionRule);    // Action Plan Shared

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['Open', 'In Progress', 'Resolved', 'Escalated', 'No Response']).setAllowInvalid(false).build();
  sheet.getRange('AE2:AE1000').setDataValidation(statusRule);    // Status
}

function getRepeatFlag_(count) {
  if (count >= 6) return 'CRITICAL';
  if (count >= 4) return 'HIGH';
  if (count >= 2) return 'MEDIUM';
  return 'NEW';
}

function formatTrackerRows_(sheet, startRow, numRows) {
  var range = sheet.getRange(startRow, 1, numRows, TRACKER_COLS);
  range.setFontSize(9).setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(startRow, 12, numRows, 1).setNumberFormat('#,##0');    // Net Orders
  sheet.getRange(startRow, 13, numRows, 1).setNumberFormat('#,##0');    // Net Failed Orders
  sheet.getRange(startRow, 14, numRows, 1).setNumberFormat('#,##0.00'); // Lost GMV
  sheet.getRange(startRow, 16, numRows, 4).setNumberFormat('#,##0');    // case columns

  sheet.getRange(startRow, 24, numRows, 8).setBackground('#E3F2FD');    // workflow block

  for (var i = 0; i < numRows; i++) {
    var row = startRow + i;
    var vals = sheet.getRange(row, 1, 1, TRACKER_COLS).getValues()[0];

    var flagCell = sheet.getRange(row, 23);  // Repeat Flag
    var flag = vals[22];
    if (flag === 'CRITICAL') {
      flagCell.setBackground(THEME.critical).setFontColor('#FFF').setFontWeight('bold');
      sheet.getRange(row, 1, 1, 23).setBackground('#FFF0F0');
    } else if (flag === 'HIGH') {
      flagCell.setBackground(THEME.high).setFontColor('#FFF').setFontWeight('bold');
      sheet.getRange(row, 1, 1, 23).setBackground('#FFF3E0');
    } else if (flag === 'MEDIUM') {
      flagCell.setBackground(THEME.medium).setFontColor('#000').setFontWeight('bold');
    } else {
      flagCell.setBackground(THEME.low).setFontColor('#FFF');
    }

    var riskCell = sheet.getRange(row, 21);  // Risk Level
    switch (String(vals[20]).toUpperCase()) {
      case 'CRITICAL': riskCell.setBackground(THEME.critical).setFontColor('#FFF'); break;
      case 'HIGH':     riskCell.setBackground(THEME.high).setFontColor('#FFF'); break;
      case 'MEDIUM':   riskCell.setBackground(THEME.medium).setFontColor('#000'); break;
      case 'LOW':      riskCell.setBackground(THEME.low).setFontColor('#FFF'); break;
    }

    var statusCell = sheet.getRange(row, 31);  // Status
    switch (vals[30]) {
      case 'Open':        statusCell.setBackground('#FFCDD2').setFontColor('#B71C1C'); break;
      case 'In Progress': statusCell.setBackground('#FFF9C4').setFontColor('#F57F17'); break;
      case 'Resolved':    statusCell.setBackground('#C8E6C9').setFontColor('#1B5E20'); break;
      case 'Escalated':   statusCell.setBackground('#CE93D8').setFontColor('#4A148C'); break;
      case 'No Response': statusCell.setBackground('#FFCCBC').setFontColor('#BF360C'); break;
    }
  }
}

function applyTrackerProtection_(sheet) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  protections.forEach(function(p) { p.remove(); });

  var protection = sheet.protect()
    .setDescription('Historical data locked — workflow + action columns (X–AI) are editable')
    .setWarningOnly(true);

  var lastRow = Math.max(sheet.getLastRow(), 2);
  protection.setUnprotectedRanges([sheet.getRange('X2:AI' + lastRow)]);
}

function getWeeklyOffenders_(sheet) {
  var today = new Date();
  var dayOfWeek = parseInt(Utilities.formatDate(today, 'Africa/Cairo', 'u'));
  var daysBack = (dayOfWeek >= 2) ? (dayOfWeek - 2) : (dayOfWeek + 5);
  var tuesdayDate = new Date(today);
  tuesdayDate.setDate(today.getDate() - daysBack);
  var tuesdayStr = Utilities.formatDate(tuesdayDate, 'Africa/Cairo', 'yyyy-MM-dd');

  var data = sheet.getDataRange().getValues();
  var offenders = [];
  for (var i = 1; i < data.length; i++) {
    var runDate = String(data[i][0]);
    if (runDate >= tuesdayStr) {
      offenders.push({
        row: i + 1,
        runDate: runDate,
        vendorId: String(data[i][1]),
        vendor: String(data[i][2]),
        city: String(data[i][3]),
        cluster: String(data[i][4]),
        amName: String(data[i][5]),
        amEmail: String(data[i][6]),
        teamLeaderName: String(data[i][7]),
        allOrders: Number(data[i][11]) || 0,
        failedOrders: Number(data[i][12]) || 0,
        lostGmv: Number(data[i][13]) || 0,
        failRate: String(data[i][14]),
        foodQualityCases: Number(data[i][15]) || 0,
        lateDeliveryCases: Number(data[i][16]) || 0,
        missingItemCases: Number(data[i][17]) || 0,
        vendorFaultCases: Number(data[i][18]) || 0,
        riskScore: Number(data[i][19]) || 0,
        riskLevel: String(data[i][20]),
        alertSent: String(data[i][23]),
        escalationSent: String(data[i][25]),
        performanceImproved: String(data[i][27]),
        actionPlanShared: String(data[i][28]),
        status: String(data[i][30])
      });
    }
  }
  return offenders;
}

function markTuesdayAlerts_(sheet, vendorRows) {
  var today = getCairoDate(0);
  vendorRows.forEach(function(v) {
    sheet.getRange(v.row, 24).setValue('Yes');  // Alert Sent
    sheet.getRange(v.row, 25).setValue(today);  // Alert Date
  });
}

function markMondayEscalations_(sheet, vendorRows) {
  var today = getCairoDate(0);
  vendorRows.forEach(function(v) {
    sheet.getRange(v.row, 26).setValue('Yes');       // Escalation Sent
    sheet.getRange(v.row, 27).setValue(today);       // Escalation Date
    sheet.getRange(v.row, 31).setValue('Escalated'); // Status
  });
}

function markSundayReview_(sheet, vendorRows, improved) {
  vendorRows.forEach(function(v) {
    var isImproved = improved[v.vendor] || false;
    sheet.getRange(v.row, 28).setValue(isImproved ? 'Yes' : 'No');  // Performance Improved
  });
}
function updateAllSheets(scoredOutput, feedData) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var steps = [];

  try {
    updateExecutiveSummary_(ss, scoredOutput);
    steps.push('Executive Summary');
  } catch (e) { steps.push('Executive Summary (FAILED: ' + e.message + ')'); }

  try {
    updateOperationalPerformance_(ss, scoredOutput);
    steps.push('Operational Performance');
  } catch (e) { steps.push('Operational Performance (FAILED: ' + e.message + ')'); }

  try {
    updateFinancialImpact_(ss, scoredOutput);
    steps.push('Financial Impact');
  } catch (e) { steps.push('Financial Impact (FAILED: ' + e.message + ')'); }

  try {
    updateRootCauseAnalysis_(ss, scoredOutput, feedData.failReasons);
    steps.push('Root Cause Analysis');
  } catch (e) { steps.push('Root Cause Analysis (FAILED: ' + e.message + ')'); }

  try {
    updateRiskRegister_(ss, scoredOutput);
    steps.push('Risk Register');
  } catch (e) { steps.push('Risk Register (FAILED: ' + e.message + ')'); }

  return steps;
}

function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function clearBelowHeaders_(sheet) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
}

function updateExecutiveSummary_(ss, data) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.executiveSummary);
  var headers = ['Date', 'Cluster', 'Risk Score', 'Risk Level', 'Fail Rate', 'Target', 'Deviation', 'Total Orders', 'Failed Orders', 'Lost GMV (EGP)', 'Vendor Fault Cases', 'Top Offender'];

  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== headers[0]) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }
  clearBelowHeaders_(sheet);

  var rows = data.clusterResults.map(function(c) {
    return [
      data.date, c.name, c.riskScore, c.riskLevel.toUpperCase(),
      c.vendorFailRate + '%', c.targetLabel, c.deviation.toFixed(2) + '%',
      c.allOrders, c.failedOrders, c.lostGmv, c.vendorFaultCases,
      c.topOffenders.length > 0 ? c.topOffenders[0].vendor : 'N/A'
    ];
  });

  var summaryRow = [
    data.date, 'TOTAL', '', '', data.summary.overallFailRate + '%', '',
    '', data.summary.totalAllOrders, data.summary.totalFailed,
    data.summary.totalLostGmv, data.summary.totalVendorFaultCases, ''
  ];
  rows.push(summaryRow);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  applyRiskLevelColors_(sheet, 4, 2, rows.length);
}

function updateOperationalPerformance_(ss, data) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.operationalPerformance);
  var headers = ['Date', 'Cluster', 'City', 'All Orders', 'Failed Orders', 'Fail Rate', 'Lost GMV (EGP)', 'Partial Refund (EGP)'];

  if (sheet.getLastRow() === 0 || String(sheet.getRange(1, 7).getValue()) !== headers[6]) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }
  clearBelowHeaders_(sheet);

  var rows = [];
  data.clusterResults.forEach(function(cluster) {
    cluster.cities.forEach(function(city) {
      rows.push([
        data.date, cluster.name, city.city, city.allOrders, city.failedOrders,
        city.vendorFailRate + '%', city.lostGmv, city.partialRefund
      ]);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function updateFinancialImpact_(ss, data) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.financialImpact);
  var headers = ['Date', 'Cluster', 'Risk Level', 'Lost GMV (EGP)', 'Purchase Refund (EGP)', 'Total Financial Impact', 'Failed Orders', 'Vendor Fault Cases', 'Top Offender', 'Offender Lost GMV'];

  if (sheet.getLastRow() === 0 || String(sheet.getRange(1, 5).getValue()) !== 'Purchase Refund (EGP)') {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }
  clearBelowHeaders_(sheet);

  var rows = data.clusterResults.map(function(c) {
    var top = c.topOffenders.length > 0 ? c.topOffenders[0] : null;
    return [
      data.date, c.name, c.riskLevel.toUpperCase(), c.lostGmv, c.partialRefund,
      c.lostGmv + c.partialRefund, c.failedOrders, c.vendorFaultCases,
      top ? top.vendor : 'N/A', top ? top.lostGmv : 0
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  applyRiskLevelColors_(sheet, 3, 2, rows.length);
}

function updateRootCauseAnalysis_(ss, data, failReasons) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.rootCauseAnalysis);
  var headers = ['Date', 'Cluster', 'Fail Reason', 'Failed Orders', '% of Cluster Fails'];

  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== headers[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }
  clearBelowHeaders_(sheet);

  // failReasons is the flat, cluster-tagged list from DataReader
  var clusterTotalFails = {};
  data.clusterResults.forEach(function(c) { clusterTotalFails[c.name] = c.failedOrders; });

  var entries = (failReasons || []).map(function(r) {
    return { clusterName: r.clusterName || (CLUSTERS[r.cluster] ? CLUSTERS[r.cluster].name : r.cluster), reason: r.reason, failedOrders: r.failedOrders };
  });
  entries.sort(function(a, b) { return b.failedOrders - a.failedOrders; });

  var rows = entries.slice(0, 150).map(function(e) {
    var totalFails = clusterTotalFails[e.clusterName] || 0;
    var share = totalFails > 0 ? +((e.failedOrders / totalFails) * 100).toFixed(1) + '%' : '—';
    return [data.date, e.clusterName, shortenReasonName_(e.reason), e.failedOrders, share];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function updateRiskRegister_(ss, data) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.riskMonitoring);
  var headers = ['Date', 'Cluster', 'Risk Score', 'Risk Level', 'Fail Rate', 'Target', 'Deviation', 'Lost GMV (EGP)', 'Top Offender'];

  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== headers[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }
  clearBelowHeaders_(sheet);

  var rows = data.riskRegister.map(function(r) {
    return [data.date, r.cluster, r.riskScore, r.riskLevel.toUpperCase(), r.failRate, r.target, r.deviation, r.lostGmv, r.topOffender];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  applyRiskLevelColors_(sheet, 4, 2, rows.length);
}

function appendMonitoringLog_(ss, runLog) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.monitoring);
  var headers = ['Timestamp', 'Status', 'Duration (s)', 'Clusters Processed', 'Emails Sent', 'Errors'];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }

  sheet.appendRow([
    new Date(), runLog.status, runLog.durationSeconds,
    runLog.clustersProcessed || 0, runLog.emailsSent || 0,
    (runLog.errors || []).join('; ')
  ]);
}

function appendAuditTrail_(ss, runLog) {
  var sheet = getOrCreateSheet_(ss, SHEET_NAMES.auditTrail);
  var headers = ['Timestamp', 'Run Date', 'Status', 'Duration', 'Steps Completed', 'Total Orders', 'Total Failed', 'Risk Summary'];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold');
  }

  sheet.appendRow([
    new Date(), runLog.runDate, runLog.status, runLog.durationSeconds + 's',
    (runLog.steps || []).join(', '),
    runLog.totalOrders || 0, runLog.totalFailed || 0,
    runLog.riskSummary || ''
  ]);
}

function applyRiskLevelColors_(sheet, col, startRow, numRows) {
  for (var i = 0; i < numRows; i++) {
    var cell = sheet.getRange(startRow + i, col);
    var val = String(cell.getValue()).toUpperCase();
    if (val === 'CRITICAL') { cell.setBackground('#FFCDD2').setFontColor(THEME.critical); }
    else if (val === 'HIGH') { cell.setBackground('#FFE0B2').setFontColor(THEME.high); }
    else if (val === 'MEDIUM') { cell.setBackground('#FFF9C4').setFontColor('#F57F17'); }
    else if (val === 'LOW') { cell.setBackground('#C8E6C9').setFontColor(THEME.low); }
  }
}
                                                                                                                                                                 /**
 * EmailBuilder.gs — talabat-branded, human-toned emails.
 *
 * One shared visual shell (talabat theme) used by every stage:
 *   buildDailyCriticalEmail   -> to the Account Manager (daily top offenders by risk)
 *   buildTuesdayLeaderReport  -> to the Team Leader (weekly overview + vendors up for action)
 *   buildSundayWeeklyReport   -> to the Team Leader (MTD wrap + operations analysis)
 *   buildMondayEscalationEmail-> to the Team Leader (only vendors with no response/plan)
 *
 * Copy is written to read like a person wrote it — no "automated message" tags.
 * Every email carries the Action Tracker link.
 */

var EMAIL_FONT = "'Poppins','Segoe UI',Helvetica,Arial,sans-serif";

// ---------------- shared shell ----------------

function emailShell_(opts) {
  // opts: { subtitle, headline, preheader, bodyHtml, footerNote }
  var pre = opts.preheader || '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + THEME.cream + ';">' +
    '<span style="display:none!important;opacity:0;color:' + THEME.cream + ';height:0;width:0;overflow:hidden;">' + pre + '</span>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + THEME.cream + ';padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(65,21,23,0.08);">' +

    // brand header
    '<tr><td style="background:' + THEME.primary + ';padding:26px 34px 22px 34px;">' +
    '<div style="font-family:' + EMAIL_FONT + ';font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">talabat</div>' +
    '<div style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.lime + ';font-weight:600;margin-top:6px;">' + esc_(opts.subtitle || 'EGY Expansion Operations') + '</div>' +
    (opts.headline ? '<div style="font-family:' + EMAIL_FONT + ';font-size:20px;color:#ffffff;font-weight:700;margin-top:12px;line-height:1.3;">' + esc_(opts.headline) + '</div>' : '') +
    '</td></tr>' +

    // body
    '<tr><td style="padding:28px 34px 30px 34px;font-family:' + EMAIL_FONT + ';color:' + THEME.burgundy + ';">' +
    opts.bodyHtml +
    '</td></tr>' +

    // footer
    '<tr><td style="background:' + THEME.burgundy + ';padding:20px 34px;font-family:' + EMAIL_FONT + ';">' +
    '<div style="color:#ffffff;font-size:13px;font-weight:700;">talabat</div>' +
    '<div style="color:#D9C9C0;font-size:11px;line-height:1.7;margin-top:6px;">' +
    'EGY Expansion Operations' + (opts.footerNote ? ' &nbsp;·&nbsp; ' + esc_(opts.footerNote) : '') + '<br>' +
    'Questions? Reach the team at <a href="mailto:' + SEND_AS_EMAIL + '" style="color:' + THEME.lime + ';text-decoration:none;">' + SEND_AS_EMAIL + '</a>' +
    '</div></td></tr>' +

    '</table></td></tr></table></body></html>';
}

function ctaButton_(label, url, dark) {
  var bg = dark ? THEME.burgundy : THEME.primary;
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px 0;"><tr>' +
    '<td style="border-radius:8px;background:' + bg + ';">' +
    '<a href="' + url + '" style="display:inline-block;padding:13px 30px;font-family:' + EMAIL_FONT + ';font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">' + esc_(label) + ' &rarr;</a>' +
    '</td></tr></table>';
}

function trackerButton_() { return ctaButton_('Open the Action Tracker', TRACKER_URL); }

// Per-cluster links into the filtered Clusters Daily Report V2 dashboard.
function dashboardLinksBlock_(clusters) {
  var links = clusters.map(function(c) {
    var url = (typeof buildDashboardUrl_ === 'function') ? buildDashboardUrl_(c.cluster || c.key) : LOOKER_DASHBOARD;
    return '<a href="' + url + '" style="display:inline-block;margin:0 8px 8px 0;padding:9px 16px;font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:700;color:' + THEME.primary + ';background:' + THEME.primaryBg + ';border:1px solid ' + THEME.primaryTint + ';border-radius:8px;text-decoration:none;">' + esc_(c.name) + ' dashboard &rarr;</a>';
  }).join('');
  return '<p style="font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';margin:18px 0 8px 0;">Open the live Clusters Daily Report V2 (MTD, pre-filtered for your area):</p>' + links;
}

function sectionTitle_(txt) {
  return '<div style="font-family:' + EMAIL_FONT + ';font-size:13px;font-weight:700;color:' + THEME.primary +
    ';text-transform:uppercase;letter-spacing:0.6px;margin:26px 0 12px 0;padding-bottom:7px;border-bottom:2px solid ' + THEME.primaryBg + ';">' + esc_(txt) + '</div>';
}

function statCards_(cards) {
  // cards: [{value, label, color}]
  var tds = cards.map(function(c) {
    return '<td style="width:' + Math.floor(100 / cards.length) + '%;text-align:center;padding:14px 6px;background:' + THEME.cream + ';border-radius:10px;">' +
      '<div style="font-family:' + EMAIL_FONT + ';font-size:24px;font-weight:800;color:' + (c.color || THEME.burgundy) + ';">' + esc_(c.value) + '</div>' +
      '<div style="font-family:' + EMAIL_FONT + ';font-size:10px;font-weight:600;color:' + THEME.muted + ';text-transform:uppercase;letter-spacing:0.4px;margin-top:5px;">' + esc_(c.label) + '</div>' +
      '</td>';
  }).join('<td style="width:10px;"></td>');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + tds + '</tr></table>';
}

function vendorTable_(vendors, opts) {
  opts = opts || {};
  var showRisk = opts.showRisk !== false;
  var head = ['Vendor', 'City', 'Orders', 'Failed', 'Fail %', 'Fault Cases', 'Lost GMV'];
  if (showRisk) head.push('Risk');
  var th = head.map(function(h, i) {
    var align = i >= 2 ? 'right' : 'left';
    return '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:' + align + ';font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">' + h + '</th>';
  }).join('');

  var rows = vendors.map(function(v, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var risk = showRisk ? '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;text-align:right;">' + riskBadge_(v.riskLevel, v.riskScore) + '</td>' : '';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(v.vendor) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.city) + '</td>' +
      td_(formatNumber_(v.allOrders)) +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(v.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';">' + v.failRate + '%</td>' +
      td_(formatNumber_(v.vendorFaultCases || 0)) +
      td_(formatNumber_(Math.round(v.lostGmv || 0))) +
      risk +
      '</tr>';
  }).join('');

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr>' + th + '</tr>' + rows + '</table>';
}

function reasonTable_(reasons, clusterFails) {
  if (!reasons || reasons.length === 0) return '<p style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.muted + ';">No fail-reason data available.</p>';
  var rows = reasons.slice(0, 7).map(function(r, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var share = clusterFails > 0 ? ((r.failedOrders / clusterFails) * 100).toFixed(0) + '%' : '—';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';">' + esc_(shortenReasonName_(r.reason)) + '</td>' +
      td_(formatNumber_(r.failedOrders)) +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.muted + ';">' + share + '</td>' +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Fail Reason</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Share</th></tr>' +
    rows + '</table>';
}

function cityTable_(cities) {
  if (!cities || cities.length === 0) return '';
  var rows = cities.slice(0, 10).map(function(c, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(c.city) + '</td>' +
      td_(formatNumber_(c.allOrders)) +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(c.failedOrders) + '</td>' +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;">' + c.vendorFailRate + '%</td>' +
      td_(formatNumber_(c.lostGmv)) +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">City</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Orders</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Fail %</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Lost GMV</th></tr>' +
    rows + '</table>';
}

function ratePill_(rate, target) {
  var over = rate > target * 100 + 1e-9;
  var bg = over ? '#FCE4E4' : '#E4F3E7';
  var fg = over ? THEME.critical : THEME.low;
  var arrow = over ? '&#9650;' : '&#9660;';
  return '<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:' + bg + ';color:' + fg + ';font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:700;">' + arrow + ' ' + rate + '% vs ' + (target * 100).toFixed(2) + '%</span>';
}

// ---------------- 1) DAILY CRITICAL -> AM ----------------

function buildDailyCriticalEmail(amName, vendors, mtdRange) {
  var first = firstName_(amName);
  var tot = totals_(vendors);
  var count = vendors.length;

  var clusterSet = {};
  vendors.forEach(function(v) { if (v.clusterName) clusterSet[v.clusterName] = true; });
  var clusterNames = Object.keys(clusterSet);
  var clusterLabel = clusterNames.length === 1 ? clusterNames[0] : (clusterNames.length + ' clusters');
  var showCluster = clusterNames.length > 1;

  var body =
    para_('Hi ' + esc_(first) + ',') +
    para_('As part of today’s daily monitoring we reviewed your vendors and have <b>already actioned the offenders below</b>. Each one is listed with the main driver behind its failed orders so you have the full picture.') +

    sectionTitle_('Today at a glance') +
    statCards_([
      { value: formatNumber_(count), label: 'Vendors Actioned', color: THEME.primary },
      { value: formatNumber_(tot.failedOrders), label: 'Failed Orders', color: THEME.critical },
      { value: formatNumber_(tot.faultCases), label: 'Vendor Fault Cases', color: THEME.critical },
      { value: formatNumber_(tot.lostGmv), label: 'Lost GMV (EGP)', color: THEME.primary }
    ]) +

    sectionTitle_('Action taken on the following offenders') +
    '<p style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.muted + ';margin:0 0 12px 0;">Actioned today &mdash; each with the root cause behind its failed orders.</p>' +
    actionsTable_(vendors, showCluster) +

    sectionTitle_('What happens next') +
    '<ul style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.burgundy + ';line-height:1.8;margin:0;padding-left:18px;">' +
    '<li>Each vendor above is logged in the Action Tracker and flagged for follow-up.</li>' +
    '<li>Please align with the vendor on the root cause and add any action plan in the tracker.</li>' +
    '<li>Repeat offenders roll up into the leader’s Tuesday review.</li>' +
    '</ul>' +

    trackerButton_() +
    para_('Thanks a lot &mdash; shout if any of these need a second look.') +
    signoff_();

  return {
    subject: 'Daily monitoring: action taken on ' + count + ' vendor' + (count === 1 ? '' : 's') + ' — ' + getCairoMonth(),
    htmlBody: emailShell_({
      subtitle: clusterLabel + ' · Daily Monitoring',
      headline: 'Today’s actions on flagged vendors',
      preheader: count + ' vendors actioned today with root cause.',
      bodyHtml: body,
      footerNote: 'MTD ' + mtdRange.label
    })
  };
}

// Daily "actions taken" table with a simplified root-cause column.
function actionsTable_(vendors, showCluster) {
  var head = ['Vendor', 'City'];
  if (showCluster) head.push('Cluster');
  head = head.concat(['Failed', 'Fail %', 'Root cause']);
  var th = head.map(function(h) {
    var align = (h === 'Failed' || h === 'Fail %') ? 'right' : 'left';
    return '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:' + align + ';font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">' + h + '</th>';
  }).join('');
  var rows = vendors.map(function(v, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var clusterCell = showCluster ? '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.clusterName || '') + '</td>' : '';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(v.vendor) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.city) + '</td>' +
      clusterCell +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(v.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';">' + v.failRate + '%</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';">' + esc_(v.rootCause || '&mdash;') + '</td>' +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;"><tr>' + th + '</tr>' + rows + '</table>';
}

// ---------------- 2) TUESDAY -> TEAM LEADER ----------------

function buildTuesdayLeaderReport(tlName, clusters, mtdRange) {
  var first = firstName_(tlName);
  var allOffenders = [];
  clusters.forEach(function(c) { (c.topOffenders || []).forEach(function(v) { v._cluster = c.name; allOffenders.push(v); }); });
  allOffenders.sort(function(a, b) { return (b.riskScore - a.riskScore) || (b.failedOrders - a.failedOrders); });
  var shortlist = allOffenders.slice(0, 10);

  var overview = clusters.map(function(c) {
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:600;color:' + THEME.burgundy + ';">' + esc_(c.name) + '</td>' +
      td_(formatNumber_(c.allOrders)) +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(c.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;">' + ratePill_(c.vendorFailRat/**
 * EmailSender.gs — routing + delivery for every workflow stage.
 * All mail is sent FROM exp.eg@talabat.com, CC exp.eg@talabat.com.
 */

// When set (see runFullTestToMe), every email is redirected to this address
// with a [TEST -> original] subject and no CC. Null in normal operation.
var __TEST_REDIRECT = null;

function sendEmail_(to, content) {
  var redirect = __TEST_REDIRECT;
  var actualTo = redirect || to;
  var subject = redirect ? ('[TEST -> ' + to + '] ' + content.subject) : content.subject;
  var opts = { htmlBody: content.htmlBody, from: SEND_AS_EMAIL, name: EMAIL_SENDER_NAME };
  if (!redirect) opts.cc = CC_EMAIL;
  GmailApp.sendEmail(actualTo, subject, '', opts);
}

// ---- DAILY: critical offenders -> Account Managers ----
function sendDailyCriticalAlerts(scoredOutput) {
  var mtd = scoredOutput.mtdRange;
  var groups = {}; // amEmail -> {amName, amEmail, vendors:[]}

  scoredOutput.clusterResults.forEach(function(cluster) {
    (cluster.topOffenders || []).forEach(function(v) {
      var email = (v.amEmail || '').trim();
      if (!email || email === 'undefined') return;
      if (!groups[email]) groups[email] = { amName: v.amName || 'there', amEmail: email, vendors: [] };
      // tag each offender with its cluster for the AM-grouped view
      v.clusterName = cluster.name;
      v.targetLabel = cluster.targetLabel;
      groups[email].vendors.push(v);
    });
  });

  var sent = 0, skipped = 0, errors = [];
  Object.keys(groups).forEach(function(email) {
    var g = groups[email];
    if (g.vendors.length === 0) { skipped++; return; }
    try {
      var content = buildDailyCriticalEmail(g.amName, g.vendors, mtd);
      sendEmail_(g.amEmail, content);
      sent++;
      Logger.log('Daily actions email sent to ' + g.amName + ' (' + g.amEmail + '), ' + g.vendors.length + ' vendors');
    } catch (e) {
      errors.push(g.amEmail + ': ' + e.message);
    }
  });
  return { sent: sent, skipped: skipped, groups: Object.keys(groups).length, errors: errors };
}

// ---- TUESDAY: weekly overview + action shortlist -> Team Leaders ----
function sendTuesdayLeaderReports(scoredOutput) {
  var byLeader = groupClustersByLeader_(scoredOutput.clusterResults);
  var sent = 0, errors = [];
  Object.keys(byLeader).forEach(function(email) {
    var g = byLeader[email];
    try {
      var content = buildTuesdayLeaderReport(g.tlName, g.clusters, scoredOutput.mtdRange);
      sendEmail_(email, content);
      sent++;
      Logger.log('Tuesday report sent to ' + g.tlName + ' (' + email + ') — ' + g.clusters.length + ' cluster(s)');
    } catch (e) {
      errors.push(email + ': ' + e.message);
    }
  });
  return { sent: sent, total: Object.keys(byLeader).length, errors: errors };
}

// ---- SUNDAY: MTD wrap + operations analysis -> Team Leaders ----
function sendSundayWeeklyReports(scoredOutput) {
  var byLeader = groupClustersByLeader_(scoredOutput.clusterResults);
  var sent = 0, errors = [];
  Object.keys(byLeader).forEach(function(email) {
    var g = byLeader[email];
    try {
      var content = buildSundayWeeklyReport(g.tlName, g.clusters, scoredOutput.mtdRange);
      s/**
 * Main.gs — orchestration for the automated weekly workflow.
 *
 *  DAILY   (dailyRun)        read feeders -> ops/root-cause/risk analysis ->
 *                            update tracker with offenders -> critical email to AMs
 *  TUESDAY (tuesdayReport)   leader performance overview + vendors up for Monday action
 *  SUNDAY  (sundayReport)    MTD wrap + operations analysis to leaders; review improvements
 *  MONDAY  (mondayEscalation)check responses, escalate unresolved vendors, update tracker
 */

// ============================ DAILY ============================
function dailyRun() {
  var startTime = new Date();
  var runLog = { runDate: getCairoDate(0), status: 'RUNNING', steps: [], errors: [], emailsSent: 0, clustersProcessed: 0, totalOrders: 0, totalFailed: 0, riskSummary: '' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  try {
    Logger.log('=== Daily Run: ' + startTime.toISOString() + ' ===');

    var feedData = readFeedData();
    runLog.steps.push('Feeders Read');
    (feedData.warnings || []).forEach(function(w) { Logger.log(w); });

    var totalRows = 0;
    (feedData.health || []).forEach(function(h) { totalRows += h.vendorRows; });
    if (totalRows === 0) throw new Error('All feeders returned 0 vendor rows — check feeder access / IMPORTRANGE / extract refresh.');

    var scoredOutput = processAllClusters(feedData);
    runLog.steps.push('Scored (v5.0)');
    runLog.clustersProcessed = scoredOutput.clusterResults.length;
    runLog.totalOrders = scoredOutput.summary.totalAllOrders;
    runLog.totalFailed = scoredOutput.summary.totalFailed;

    var sheetSteps = updateAllSheets(scoredOutput, feedData);
    runLog.steps.push('Dashboards: ' + sheetSteps.join(', '));

    var trackerResult = updateVendorTracker(scoredOutput, feedData, false);
    runLog.steps.push('Tracker: ' + trackerResult.message);

    // v5.1: keep the action-tool Chain ID column populated for the Tuesday portal agent
    try { if (typeof refreshChainIds === 'function') { refreshChainIds(); runLog.steps.push('Chain IDs refreshed'); } }
    catch (ce) { runLog.errors.push('refreshChainIds: ' + ce.message); }

    var mail = sendDailyCriticalAlerts(scoredOutput);
    runLog.emailsSent = mail.sent;
    runLog.steps.push('Daily critical emails: ' + mail.sent + ' sent, ' + mail.skipped + ' skipped');
    if (mail.errors.length) runLog.errors = runLog.errors.concat(mail.errors);

    runLog.riskSummary = scoredOutput.clusterResults.map(function(c) { return c.name + ':' + c.riskLevel + '(' + c.riskScore + ')'; }).join(', ');
    if (feedData.warnings && feedData.warnings.length) runLog.errors = runLog.errors.concat(feedData.warnings);
    runLog.status = 'SUCCESS';

    // proactively flag empty/stale feeders to the ops owner
    var empty = (feedData.health || []).filter(function(h) { return h.vendorRows === 0; });
    if (empty.length) {
      sendAlertEmail('Command Center — ' + empty.length + ' feeder(s) need a refresh (' + getCairoDate(0) + ')',
        'These clusters returned no rows today:\n\n' + empty.map(function(h) { return '• ' + h.cluster + '  (' + h.feeder + ')'; }).join('\n') +
        '\n\nPlease refresh the feeder extract(s). Full health:\n' + (feedData.health || []).map(function(h) { return h.cluster + ': ' + h.vendorRows + ' vendors via ' + h.source; }).join('\n'));
    }

  } catch (e) {
    runLog.status = 'FAILED';
    runLog.errors.push(e.message);
    Logger.log('FATAL: ' + e.message + '\n' + e.stack);
    sendAlertEmail('Command Center daily run FAILED — ' + getCairoDate(0), 'Error: ' + e.message + '\n\nSteps: ' + runLog.steps.join(', '));
  }

  finishRun_(ss, runLog, startTime);
  return runLog;
}

// ============================ TUESDAY ============================
function tuesdayReport() {
  Logger.log('=== Tuesday Leader Report ===');
  try {
    var feedData = readFeedData();
    var scoredOutput = processAllClusters(feedData);

    var result = sendTuesdayLeaderReports(scoredOutput);
    Logger.log('Tuesday reports: ' + result.sent + '/' + result.total);

    // mark today's shortlisted offenders as alerted in the tracker
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
    if (sheet) {
      var offenders = getWeeklyOffenders_(sheet);
      var today = offenders.filter(function(v) { return v.runDate === getCairoDate(0); });
      if (today.length) markTuesdayAlerts_(sheet, today);
    }
    if (result.errors.length) Logger.log('Errors: ' + result.errors.join('; '));
  } catch (e) {
    Logger.log('Tuesday report FAILED: ' + e.message);
    sendAlertEmail('Command Center Tuesday report FAILED — ' + getCairoDate(0), 'Error: ' + e.message);
  }
}

// ============================ SUNDAY ============================
function sundayReport() {
  Logger.log('=== Sunday Weekly Report ===');
  try {
    var feedData = readFeedData();
    var scoredOutput = processAllClusters(feedData);

    var result = sendSundayWeeklyReports(scoredOutput);
    Logger.log('Sunday wraps: ' + result.sent + '/' + result.total);

    // review improvements vs earliest tracked snapshot this week
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
    if (sheet) {
      var offenders = getWeeklyOffenders_(sheet);
      var alerted = offenders.filter(function(v) { return v.alertSent === 'Yes'; });
      if (alerted.length) {
        var current = {};
        scoredOutput.clusterResults.forEach(function(c) { (c.topOffenders || []).forEach(function(v) { current[v.vendor] = v; }); });
        var byName = {};
        alerted.forEach(function(v) { (byName[v.vendor] = byName[v.vendor] || []).push(v); });
        var improved = {};
        Object.keys(byName).forEach(function(name) {
          var earliest = byName[name][0];
          var now = current[name];
          if (!now) { improved[name] = true; return; }
          improved[name] = (now.failedOrders < earliest.failedOrders) || (now.vendorFaultCases < earliest.vendorFaultCases);
        });
        markSundayReview_(sheet, alerted, improved);
      }
    }
    if (result.errors.length) Logger.log('Errors: ' + result.errors.join('; '));
  } catch (e) {
    Logger.log('Sunday report FAILED: ' + e.message);
    sendAlertEmail('Command Center Sunday report FAILED — ' + getCairoDate(0), 'Error: ' + e.message);
  }
}

// ============================ MONDAY ============================
function mondayEscalation() {
  Logger.log('=== Monday Escalation ===');
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
    if (!sheet) { Logger.log('No tracker sheet.'); return; }

    var offenders = getWeeklyOffenders_(sheet);
    var escalationList = offenders.filter(function(v) {
      return v.alertSent === 'Yes' && v.performanceImproved !== 'Yes' && v.actionPlanShared !== 'Yes' && v.actionPlanShared !== 'Partial';
    });
    if (escalationList.length === 0) { Logger.log('Nothing to escalate — all improved or have plans.'); return; }

    var result = sendMondayEscalations(escalationList, getMtdRange());
    Logger.log('Escalations: ' + result.sent + ' sent, ' + result.skipped + ' skipped');
    if (result.sent > 0) markMondayEscalations_(sheet, escalationList);
    if (result.errors.length) Logger.log('Errors: ' + result.errors.join('; '));
  } catch (e) {
    Logger.log('Monday escalation FAILED: ' + e.message);
    sendAlertEmail('Command Center Monday escalation FAILED — ' + getCairoDate(0), 'Error: ' + e.message);
  }
}

// ============================ shared ============================
function finishRun_(ss, runLog, startTime) {
  runLog.durationSeconds = Math.round((new Date() - startTime) / 1000);
  try {
    appendMonitoringLog_(ss, runLog);
    appendAuditTrail_(ss, runLog);
  } catch (logErr) {
    Logger.log('Log write failed: ' + logErr.message);
  }
  Logger.log('=== Done: ' + runLog.status + ' in ' + runLog.durationSeconds + 's ===');
}

// ============================ test harness ============================
// Runs the daily + weekly routines but redirects EVERY email to ALERT_EMAIL
// (adham.h.2@talabat.com) with a [TEST -> original] subject. No real
// recipient receives anything. Use to validate the full pipeline end to end.
function runFullTestToMe() {
  __TEST_REDIRECT = ALERT_EMAIL;
  var result = {};
  try {
    var feedData = readFeedData();
    var scoredOutput = processAllClusters(feedData);
    result.daily = sendDailyCriticalAlerts(scoredOutput);
    result.tuesday = sendTuesdayLeaderReports(scoredOutput);
    result.sunday = sendSundayWeeklyReports(scoredOutput);
    result.totalSent = (result.daily.sent || 0) + (result.tuesday.sent || 0) + (result.sunday.sent || 0);
    Logger.log('runFullTestToMe: ' + JSON.stringify(result));
  } catch (e) {
    result.error = e.message;
    Logger.log('runFullTestToMe FAILED: ' + e.message + '\n' + e.stack);
  } finally {
    __TEST_REDIRECT = null;
  }
  return result;
}

// ============================ triggers ============================
function setupWeeklyTriggers() {
  removeAllTriggers();
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(9).nearMinute(0).inTimezone('Africa/Cairo').create();
  ScriptApp.newTrigger('tuesdayReport').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(10).nearMinute(0).inTimezone('Africa/Cairo').create();
  ScriptApp.newTrigger('sundayReport').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(10).nearMinute(0).inTimezone('Africa/Cairo').create();
  ScriptApp.newTrigger('mondayEscalation').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).nearMinute(0).inTimezone('Africa/Cairo').create();
  Logger.log('Triggers set: dailyRun 09:00 daily · tuesdayReport 10:00 Tue · sundayReport 10:00 Sun · mondayEscalation 10:00 Mon (Africa/Cairo)');
}

function removeAllTriggers() {
  var t = ScriptApp.getProjectTriggers();
  t.forEach(function(x) { ScriptApp.deleteTrigger(x); });
  Logger.log('Removed ' + t.length + ' trigger(s)');
}

// ============================ menu ============================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🟠 Command Center')
    .addItem('▶ Run Daily Pipeline Now', 'dailyRun')
    .addSeparator()
    .addItem('📧 Send Tuesday Leader Report', 'manualTuesdayReport')
    .addItem('📝 Send Sunday Weekly Report', 'manualSundayReport')
    .addItem('🚨 Send Monday Escalation', 'manualMondayEscalation')
    .addSeparator()
    .addItem('🩺 Check Feeder Health', 'checkFeederHealth')
    .addSeparator()
    .addItem('⏰ Enable All Triggers', 'setupWeeklyTriggers')
    .addItem('⏹ Disable All Triggers', 'removeAllTriggers')
    .addT/**
 * ActionTool.gs — talabat EGY Ops Command Center: Vendor Status Action module (v5.1, July 2026)
 *
 * Purpose: turn the Vendor Action Tracker into the monitor + action dashboard for the
 * weekly (Tuesday) portal status-update workflow driven by the Chrome action agent.
 *
 * What this file adds:
 *   1) 4 new tracker columns (AF Chain ID, AG Requested Action, AH Last Portal Status, AI Action Duration)
 *   2) Chain ID back-fill from the 7 feeders (by Vendor ID)
 *   3) A need-action query (Risk Level CRITICAL/HIGH AND VFR >= threshold)
 *   4) A logging helper the agent calls after each portal update
 *
 * NOTE: this is a STANDALONE script (not container-bound), so it exposes callable
 * functions (run via the Apps Script editor / run_script_function / triggers) rather
 * than an onOpen spreadsheet menu.
 */

// ---- Tracker column map (1-based). Live 31-col schema + 4 new action columns. ----
var TCOL = {
  runDate: 1, vendorId: 2, vendorName: 3, city: 4, cluster: 5,
  amName: 6, amEmail: 7, teamLeader: 8, isKeyVip: 9, isTgo: 10, isFood: 11,
  netOrders: 12, netFailedOrders: 13, lostGmv: 14, netFailRate: 15,
  orderQualityCases: 16, lateDeliveryCases: 17, missingItemCases: 18, vendorFaultCases: 19,
  riskScore: 20, riskLevel: 21, appearancesMtd: 22, repeatFlag: 23,
  alertSent: 24, alertDate: 25, escalationSent: 26, escalationDate: 27,
  performanceImproved: 28, actionPlanShared: 29, actionPlanDetails: 30, status: 31,
  // --- new action columns ---
  chainId: 32, requestedAction: 33, lastPortalStatus: 34, actionDuration: 35
};
var TRACKER_TOTAL_COLS = 35;

// Need-action rule (from Adham, July 2026): Risk Level CRITICAL/HIGH AND VFR >= 40%.
var VFR_ACTION_THRESHOLD = 40; // percent. Tune here.
var NEED_ACTION_RISK_LEVELS = ['CRITICAL', 'HIGH'];

var PORTAL_STATUS_BASE = 'https://portal.talabat.com/eg/p/restaurant-management#/restaurants/';

// Valid portal option vocab (for reference / validation of Requested Action).
var PORTAL_STATUSES = ['Busy', 'Closed', 'Hidden'];
var PORTAL_REASONS = ['Courier Delayed at pickup', 'No drivers', 'Kitchen is too busy',
  'Updating menu', 'Technical issue', 'Too Many Rejected Orders', 'Bad weather',
  'Prayer', 'Lockdown', 'Closed', 'Other'];
var DEFAULT_TIME_PERIOD = '15 mins';

/** Build the portal branch-status URL. restaurants/=Chain ID, branches/=Vendor ID. */
function buildPortalStatusUrl_(chainId, vendorId) {
  var chain = String(chainId || '').trim();
  var vend = String(vendorId || '').trim();
  if (!chain) chain = vend; // fallback to the 500002/500002 pattern when Chain ID unknown
  return PORTAL_STATUS_BASE + chain + '/branches/' + vend + '/status';
}

function parsePct_(s) {
  var n = Number(String(s == null ? '' : s).replace('%', '').trim());
  return isNaN(n) ? 0 : n;
}

/** STEP 1 — create/repair the 4 action columns, headers, formatting. Safe to re-run. */
function setupActionColumns() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  if (!sheet) throw new Error('Vendor Action Tracker sheet not found');

  if (sheet.getMaxColumns() < TRACKER_TOTAL_COLS) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), TRACKER_TOTAL_COLS - sheet.getMaxColumns());
  }

  var headers = [['Chain ID',
                  'Requested Action (Status | Reason | Duration)',
                  'Last Portal Status (found/set)',
                  'Action Duration']];
  sheet.getRange(1, TCOL.chainId, 1, 4).setValues(headers);

  var hdr = sheet.getRange(1, TCOL.chainId, 1, 4);
  hdr.setBackground('#411517')     // burgundy — distinguishes the action block
     .setFontColor('#FFFFFF')
     .setFontWeight('bold')
     .setFontSize(10)
     .setHorizontalAlignment('center')
     .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  sheet.setColumnWidth(TCOL.chainId, 90);
  sheet.setColumnWidth(TCOL.requestedAction, 240);
  sheet.setColumnWidth(TCOL.lastPortalStatus, 240);
  sheet.setColumnWidth(TCOL.actionDuration, 100);

  // Light helper validation: Action Duration dropdown (time periods are effectively 15 mins).
  var durRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['', '15 mins', '30 mins', '45 mins', '60 mins'], true)
    .setAllowInvalid(true).build();
  sheet.getRange(2, TCOL.actionDuration, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(durRule);

  return 'Action columns ready (AF Chain ID, AG Requested Action, AH Last Portal Status, AI Action Duration).';
}

/** Build a { vendorId -> chainId } map by scanning all 7 feeders (uses live FEED_COLS + FEEDERS). */
function buildChainIdMap_() {
  var map = {};
  Object.keys(FEEDERS).forEach(function(fk) {
    for (var t = 0; t < FEED_TAB_PREFERENCE.length; t++) {
      var raw = readFeederTab_(fk, FEED_TAB_PREFERENCE[t]);
      if (!raw.exists || !raw.rows.length) continue;
      raw.rows.forEach(function(r) {
        var vid = String(r[FEED_COLS.vendorId] || '').trim();
        var cid = String(r[FEED_COLS.chainId] || '').trim();
        if (vid && cid && !map[vid]) map[vid] = cid;
      });
      break; // first tab that has rows wins
    }
  });
  return map;
}

/** STEP 2 — fill the Chain ID column for any row that has a Vendor ID but no Chain ID. */
function refreshChainIds() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var last = sheet.getLastRow();
  if (last < 2) return 'No data rows.';
  __FEEDER_TAB_CACHE = {};
  var map = buildChainIdMap_();
  var ids = sheet.getRange(2, TCOL.vendorId, last - 1, 1).getValues();
  var chains = sheet.getRange(2, TCOL.chainId, last - 1, 1).getValues();
  var filled = 0, missing = 0;
  for (var i = 0; i < ids.length; i++) {
    var vid = String(ids[i][0] || '').trim();
    if (!vid) continue;
    if (String(chains[i][0] || '').trim()) continue;
    if (map[vid]) { chains[i][0] = map[vid]; filled++; }
    else missing++;
  }
  sheet.getRange(2, TCOL.chainId, last - 1, 1).setValues(chains);
  return 'Chain IDs filled: ' + filled + ' | still missing (not found in feeders): ' + missing;
}

/**
 * STEP 3 — return the need-action queue for the Chrome agent.
 * Rule: Risk Level in {CRITICAL, HIGH} AND VFR (Net Fail Rate %) >= VFR_ACTION_THRESHOLD.
 * Only rows with a non-empty Requested Action are marked executable (safety gate).
 */
function getNeedActionQueue() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var last = sheet.getLastRow();
  var out = [];
  if (last < 2) return out;
  var data = sheet.getRange(2, 1, last - 1, TRACKER_TOTAL_COLS).getValues();
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var risk = String(r[TCOL.riskLevel - 1] || '').toUpperCase();
    var vfr = parsePct_(r[TCOL.netFailRate - 1]);
    if (NEED_ACTION_RISK_LEVELS.indexOf(risk) === -1) continue;
    if (vfr < VFR_ACTION_THRESHOLD) continue;
    var requested = String(r[TCOL.requestedAction - 1] || '').trim();
    out.push({
      row: i + 2,
      vendorId: String(r[TCOL.vendorId - 1] || '').trim(),
      chainId: String(r[TCOL.chainId - 1] || '').trim(),
      vendor: String(r[TCOL.vendorName - 1] || ''),
      city: String(r[TCOL.city - 1] || ''),
      riskLevel: risk,
      vfr: vfr,
      requestedAction: requested,
      executable: requested.length > 0,
      lastPortalStatus: String(r[TCOL.lastPortalStatus - 1] || ''),
      url: buildPortalStatusUrl_(r[TCOL.chainId - 1], r[TCOL.vendorId - 1])
    });
  }
  return out;
}

/** Convenience: log the queue to Stackdriver (for manual runs / debugging). */
function logNeedActionQueue() {
  var q = getNeedActionQueue();
  Logger.log('Need-action vendors: ' + q.length);
  q.forEach(function(v) {
    Logger.log([v.row, v.vendorId, v.chainId, v.riskLevel, v.vfr + '%',
      v.executable ? 'EXEC:' + v.requestedAction : 'AWAITING Requested Action', v.url].join(' | '));
  });
  return q.length + ' need-action vendors (see logs).';
}

/**
 * STEP 4 — logging helper the agent calls after each portal update.
 * statusText e.g. 'Set Busy (No drivers)' or 'Found permanent Busy — skipped'.
 */
function logPortalAction(vendorId, statusText, duration) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var last = sheet.getLastRow();
  var ids = sheet.getRange(2, TCOL.vendorId, last - 1, 1).getValues();
  var stamp = getCairoDate(0) + ' ' + Utilities.formatDate(new Date(), 'Africa/Cairo', 'HH:mm');
  for (var i = ids.length - 1; i >= 0; i--) { // last matching row (most recent run)
    if (String(ids[i][0]).trim() === String(vendorId).trim()) {
      var row = i + 2;
      sheet.getRange(row, TCOL.lastPortalStatus).setValue(statusText + ' @ ' + stamp);
      if (duration) sheet.getRange(row, TCOL.actionDuration).setValue(duration);
      return 'Logged row ' + row + ': ' + statusText;
    }
  }
  return 'Vendor ID ' + vendorId + ' not found.';
}

/** One-shot setup: create columns + back-fill Chain IDs. Run once after deploy. */
function setupActionModule() {
  var a = setupActionColumns();
  var b = refreshChainIds();
  return a + '\n' + b;
}
      