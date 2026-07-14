/**
 * Config.gs - talabat EGY Operations Command Center
 * v5.0 (July 2026 restructure)
 *
 * Data now lives in 7 EXTERNAL feeder spreadsheets (Looker Connected Sheets),
 * one per agent/cluster. Each feeder holds ONE consolidated 19-column table
 * (grain = vendor x fail_reason) that replaces the old 3 in-sheet Data Feed tabs.
 * The main spreadsheet's "Project Structure" tab lists the feeder links.
 */

// ---- Main command-center spreadsheet (dashboards, tracker, logs) ----
var SPREADSHEET_ID = '1W_4kxTBPa6OzZYcjf3_1tXRNH1YUwzZXBnZBFcZyFys';
var TRACKER_URL = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit#gid=0';

// ---- External feeder spreadsheets (one per working agent) ----
var FEEDERS = {
  alex:          { sheetId: '18hENIBCIbMLJrJtCC3sJgGkAEUlJ6cHCNYBl6nhHB0E', title: 'Feed - Vendor Daily Performance Alex',           agent: 'Alex Agent' },
  delta:         { sheetId: '1c-PJ9GSnhAXIaLCdqCjk-x2M4Lkxie8574sMgFphjWw', title: 'Feed - Vendor Daily Performance Delta',          agent: 'Delta Agent' },
  esm:           { sheetId: '1fy770Ay452QE1uJXEOvpNKy5ODSZnvNWM_nICYP6QAU', title: 'Feed - Vendor Daily Performance Upper and Canal', agent: 'ESM Agent' },
  key:           { sheetId: '1W2hV0vCLdyOXlhwYFeIoEq0JRmP3MSSWdOyYC0q4gUQ', title: 'Feed - Vendor Daily Performance Key Accounts',   agent: 'Key Agent' },
  cairo_east:    { sheetId: '14lpdsdUnccCDOlu4BddCLgZuBMut4zmPLxL1WjscXKA', title: 'Feed - Vendor Daily Performance Cairo East',     agent: 'Cairo Agent 1' },
  cairo_west:    { sheetId: '1_eD-g5Bm6rBBn6DxFmnDDT7bum0LLdkAH4oXDGmCxtk', title: 'Feed - Vendor Daily Performance Cairo West',     agent: 'Cairo Agent 2' },
  cairo_central: { sheetId: '1Qll2NfDKq3CKp3nLTQuvDpIdQiAenSpTyqWOE-gknIQ', title: 'Feed - Vendor Daily Performance Cairo Central',  agent: 'Cairo Agent 3' }
};

// ---- City groupings used to split the ESM (Upper & Canal) feeder ----
var UPPER_EGYPT_CITIES = ['Hurghada', 'Assiut', 'Minya', 'Beni Suef', 'Suhag', 'Sohag'];
var CANAL_CITIES = ['Port Said', 'Suez', 'Ismailia', 'Damietta New', 'Ras El Bar', 'Damietta'];

/**
 * Reporting clusters (9). One per feeder, except:
 *   - ESM feeder splits by city into Upper Egypt + Canal
 *   - Cairo East feeder splits by team leader into East 1 (Mostafa) + East 2 (Nourhan)
 *
 * filter: how to select this cluster's rows out of its feeder table.
 *   tl:     array of team_leader_name values to keep
 *   cities: array of city names to keep (case-insensitive, trailing dots ignored)
 *   isKey:  true  => keep only is_key_vip_account = Yes
 */
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

// Build human-readable target labels once.
Object.keys(CLUSTERS).forEach(function(k) {
  CLUSTERS[k].key = k;
  CLUSTERS[k].targetLabel = (CLUSTERS[k].target * 100).toFixed(2) + '%';
});

// Segment reference targets (informational, shown in reports).
var SEGMENT_TARGETS = {
  TGO: { label: 'TGO', target: 0.0065, targetLabel: '0.65%' },
  TMP: { label: 'TMP', target: 0.0075, targetLabel: '0.75%' }
};

// ---- Consolidated feeder column layout (0-based) ----
var FEED_COLS = {
  vendorId: 0, vendor: 1, city: 2, amName: 3, amEmail: 4, teamLeaderName: 5,
  isTgo: 6, isKey: 7, isFood: 8, zone: 9, failReason: 10,
  netOrders: 11, failedOrders: 12, lostGmv: 13,
  lateDeliveryCases: 14, missingItemCases: 15, qualityCases: 16,
  partialRefund: 17, contactRate: 18
};
var FEED_HEADER_KEY = 'dim_vendor_info_vendor_id';       // used to auto-locate the header row
var FEED_TAB_PREFERENCE = ['Extract 1', 'Connected Sheet 1']; // read order

// ---- Command-center dashboard tabs ----
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

// ---- talabat brand theme (from the talabat slide design system) ----
var THEME = {
  primary: '#FF5900',      // Warm Orange - primary brand
  primaryDark: '#B34700',
  primaryTint: '#FCA06F',
  primaryBg: '#FFF3E7',    // warm light orange wash for panels
  cream: '#F4EDE3',        // Warm Cream - default surface
  burgundy: '#411517',     // Dark Burgundy - body text / dark surfaces
  lime: '#CFFF00',         // Electric Lime - accent on dark/orange only
  critical: '#D32F2F',
  high: '#FF5900',
  medium: '#FFB300',
  low: '#2E7D32',
  headerText: '#FFFFFF',
  muted: '#8A7F76'
};

// ---- Email routing ----
var SEND_AS_EMAIL = 'exp.eg@talabat.com';   // FROM
var CC_EMAIL = 'exp.eg@talabat.com';        // CC on every send
var ALERT_EMAIL = 'adham.h.2@talabat.com';  // internal failure alerts
var EMAIL_SENDER_NAME = 'talabat EGY Expansion Operations';

// ---- Risk scoring weights (max 100) ----
var SCORING_WEIGHTS = { deviation: 40, vendorFaultCases: 30, orderVolume: 20, financialImpact: 10 };

var TOP_OFFENDERS_LIMIT = 5;    // top offenders surfaced per cluster
var CRITICAL_MIN_FAILED = 1;    // min failed orders for a vendor to be email-worthy

// ---- Date helpers (Africa/Cairo) ----
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

// Normalise a city/name string for tolerant matching (trim, lower, drop trailing dots).
function normKey_(s) {
  return String(s == null ? '' : s).trim().replace(/\.+$/, '').toLowerCase();
}

// ---- Clusters Daily Report V2 (Looker) — source for weekly/MTD leader reports ----
var LOOKER_DASHBOARD = 'https://talabat.eu.looker.com/dashboards/29204';

// Build a dashboard link pre-filtered for one cluster (TL / city / is-key), always
// scoped to Is Active = Yes and Local Order Date = this month.
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
  var qs = Object.keys(p).map(function(k) {
    return lookerEnc_(k) + '=' + lookerEnc_(p[k]);
  }).join('&');
  return LOOKER_DASHBOARD + '?' + qs;
}

function lookerEnc_(s) {
  return encodeURIComponent(String(s)).replace(/%20/g, '+').replace(/%2C/g, ',');
}
