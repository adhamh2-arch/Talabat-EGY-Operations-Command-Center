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
