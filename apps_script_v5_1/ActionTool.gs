/**
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

/** Build a { vendorId -> chainId } map by scanning all 7 feeders.
 *  Uses each tab's header-based colMap (from DataReader.readFeederTab_) so it works whether or
 *  not a feeder has the chain-id column. Feeders lacking dim_chain_chain_id simply contribute none. */
function buildChainIdMap_() {
  var map = {};
  Object.keys(FEEDERS).forEach(function(fk) {
    for (var t = 0; t < FEED_TAB_PREFERENCE.length; t++) {
      var raw = readFeederTab_(fk, FEED_TAB_PREFERENCE[t]);
      if (!raw.exists || !raw.rows.length || !raw.colMap) continue;
      var cm = raw.colMap;
      if (cm.chainId >= 0) {
        raw.rows.forEach(function(r) {
          var vid = String(cell_(r, cm.vendorId) || '').trim();
          var cid = String(cell_(r, cm.chainId) || '').trim();
          if (vid && cid && !map[vid]) map[vid] = cid;
        });
      }
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
