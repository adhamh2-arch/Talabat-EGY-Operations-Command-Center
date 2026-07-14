/**
 * ActionTool.gs — talabat EGY Ops Command Center: Vendor Status Action module (v5.2, July 2026)
 * AF Chain ID | AG Requested Action (auto) | AH Last Seen Status (found) | AI Action Taken (set)
 */

var TCOL = {
  runDate: 1, vendorId: 2, vendorName: 3, city: 4, cluster: 5,
  amName: 6, amEmail: 7, teamLeader: 8, isKeyVip: 9, isTgo: 10, isFood: 11,
  netOrders: 12, netFailedOrders: 13, lostGmv: 14, netFailRate: 15,
  orderQualityCases: 16, lateDeliveryCases: 17, missingItemCases: 18, vendorFaultCases: 19,
  riskScore: 20, riskLevel: 21, appearancesMtd: 22, repeatFlag: 23,
  alertSent: 24, alertDate: 25, escalationSent: 26, escalationDate: 27,
  performanceImproved: 28, actionPlanShared: 29, actionPlanDetails: 30, status: 31,
  chainId: 32, requestedAction: 33, lastSeenStatus: 34, actionTaken: 35
};
var TRACKER_TOTAL_COLS = 35;

var VFR_ACTION_THRESHOLD = 40; // percent (lower bound). Upper bound 100.

var PORTAL_STATUS_BASE = 'https://portal.talabat.com/eg/p/restaurant-management#/restaurants/';

var APPROVED_ACTION = 'Hidden | TOO_MANY_REJECTED_ORDERS';
var RESTORE_ACTION = 'Open';

function requestedActionFormula_() {
  return '=ARRAYFORMULA(IF(LEN($O$2:$O)=0,"",' +
         'IF(($AC$2:$AC="Yes")+($AC$2:$AC="Partial")>0,"' + RESTORE_ACTION + '",' +
         'IF(IFERROR(VALUE(SUBSTITUTE($O$2:$O,"%","")),0)>=' + VFR_ACTION_THRESHOLD + ',"' + APPROVED_ACTION + '",""))))';
}

function buildPortalStatusUrl_(chainId, vendorId) {
  var chain = String(chainId || '').trim();
  var vend = String(vendorId || '').trim();
  if (!chain) chain = vend;
  return PORTAL_STATUS_BASE + chain + '/branches/' + vend + '/status';
}

function parsePct_(s) {
  var n = Number(String(s == null ? '' : s).replace('%', '').trim());
  return isNaN(n) ? 0 : n;
}

function setupActionColumns() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  if (!sheet) throw new Error('Vendor Action Tracker sheet not found');

  if (sheet.getMaxColumns() < TRACKER_TOTAL_COLS) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), TRACKER_TOTAL_COLS - sheet.getMaxColumns());
  }

  var headers = [['Chain ID', 'Requested Action (auto)', 'Last Seen Status (found)', 'Action Taken (set)']];
  sheet.getRange(1, TCOL.chainId, 1, 4).setValues(headers);

  var hdr = sheet.getRange(1, TCOL.chainId, 1, 4);
  hdr.setBackground('#411517').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(10)
     .setHorizontalAlignment('center').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  sheet.setColumnWidth(TCOL.chainId, 90);
  sheet.setColumnWidth(TCOL.requestedAction, 230);
  sheet.setColumnWidth(TCOL.lastSeenStatus, 240);
  sheet.setColumnWidth(TCOL.actionTaken, 240);

  // Strip any stale data validation on AF–AI (an old Status dropdown lingered on AF and
  // rejected Chain ID writes). Chain ID / statuses here are free text, not dropdowns.
  sheet.getRange(2, TCOL.chainId, Math.max(sheet.getMaxRows() - 1, 1), 4).clearDataValidations();

  var lastRow = Math.max(sheet.getLastRow(), 2);
  sheet.getRange(2, TCOL.requestedAction, lastRow - 1, 1).clearContent();
  sheet.getRange(2, TCOL.requestedAction).setFormula(requestedActionFormula_());

  return 'Action columns ready: AF Chain ID (validation cleared) · AG Requested Action (auto formula) · AH Last Seen · AI Action Taken.';
}

function buildChainIdMap_() {
  var map = {};
  Object.keys(FEEDERS).forEach(function(fk) {
    // Scan EVERY tab (not just the first with rows). Some feeders' 'Extract 1' is the old
    // 19-col layout WITHOUT the chain column, while their live 'Connected Sheet 1' (22 cols)
    // carries dim_chain_chain_id. So keep looking until a tab that actually has it.
    for (var t = 0; t < FEED_TAB_PREFERENCE.length; t++) {
      var raw = readFeederTab_(fk, FEED_TAB_PREFERENCE[t]);
      if (!raw.exists || !raw.rows.length || !raw.colMap) continue;
      var cm = raw.colMap;
      if (cm.chainId < 0) continue; // this tab has no chain column; try the next tab
      raw.rows.forEach(function(r) {
        var vid = String(cell_(r, cm.vendorId) || '').trim();
        var cid = String(cell_(r, cm.chainId) || '').trim();
        if (vid && cid && !map[vid]) map[vid] = cid;
      });
      // no break: also merge chain IDs from any other tab that exposes the column
    }
  });
  return map;
}

function refreshChainIds() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var last = sheet.getLastRow();
  if (last < 2) return 'No data rows.';
  __FEEDER_TAB_CACHE = {};
  var map = buildChainIdMap_();
  sheet.getRange(2, TCOL.chainId, last - 1, 1).clearDataValidations(); // drop stale AF dropdown so writes stick
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
  return 'Chain IDs filled: ' + filled + ' | still missing (not in feeders): ' + missing;
}

function getNeedActionQueue() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var last = sheet.getLastRow();
  var out = [];
  if (last < 2) return out;
  var data = sheet.getRange(2, 1, last - 1, TRACKER_TOTAL_COLS).getValues();
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var vfr = parsePct_(r[TCOL.netFailRate - 1]);
    if (vfr < VFR_ACTION_THRESHOLD || vfr > 100) continue;
    var requested = String(r[TCOL.requestedAction - 1] || '').trim();
    out.push({
      row: i + 2,
      vendorId: String(r[TCOL.vendorId - 1] || '').trim(),
      chainId: String(r[TCOL.chainId - 1] || '').trim(),
      vendor: String(r[TCOL.vendorName - 1] || ''),
      city: String(r[TCOL.city - 1] || ''),
      riskLevel: String(r[TCOL.riskLevel - 1] || '').toUpperCase(),
      vfr: vfr,
      actionPlanShared: String(r[TCOL.actionPlanShared - 1] || ''),
      requestedAction: requested,
      executable: requested.indexOf('Hidden') === 0,
      deferred: requested === RESTORE_ACTION,
      lastSeenStatus: String(r[TCOL.lastSeenStatus - 1] || ''),
      actionTaken: String(r[TCOL.actionTaken - 1] || ''),
      url: buildPortalStatusUrl_(r[TCOL.chainId - 1], r[TCOL.vendorId - 1])
    });
  }
  return out;
}

function logNeedActionQueue() {
  var q = getNeedActionQueue();
  Logger.log('40–100% VFR offenders: ' + q.length);
  q.forEach(function(v) {
    Logger.log([v.row, v.vendorId, v.chainId, v.riskLevel, v.vfr + '%',
      v.executable ? 'ACT:' + v.requestedAction : (v.deferred ? 'DEFER (action plan shared)' : 'no action'),
      v.url].join(' | '));
  });
  return q.length + ' offenders (see logs).';
}

function prepareTakeAction() {
  var ui = SpreadsheetApp.getUi();
  var q = getNeedActionQueue();
  if (q.length === 0) { ui.alert('Take Action', 'No vendors in the 40–100% VFR queue right now.', ui.ButtonSet.OK); return; }
  var act = q.filter(function(v) { return v.executable; });
  var defer = q.filter(function(v) { return v.deferred; });
  var links = act.map(function(v) { return '• ' + v.vendor + '  (' + v.vfr + '%)  ->  ' + v.url; });
  Logger.log('prepareTakeAction — to act: ' + act.length + ', deferred: ' + defer.length + '\n' + links.join('\n'));
  ui.alert('Take Action — ' + q.length + ' offender(s) in queue',
    'To ACT this cycle (Hidden | TOO_MANY_REJECTED_ORDERS): ' + act.length + '\n' +
    'DEFERRED — Action Plan shared, keep Open, act next cycle: ' + defer.length + '\n\n' +
    'Run the Chrome action agent to apply on the portal. Portal links are in the execution log (View > Logs).\n\n' +
    'Approved actions only: ' + APPROVED_ACTION + ' , or ' + RESTORE_ACTION + ' to restore.',
    ui.ButtonSet.OK);
  return q.length + ' offenders (' + act.length + ' to act, ' + defer.length + ' deferred).';
}

function logPortalAction(vendorId, foundStatus, setStatus) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var last = sheet.getLastRow();
  var ids = sheet.getRange(2, TCOL.vendorId, last - 1, 1).getValues();
  var stamp = getCairoDate(0) + ' ' + Utilities.formatDate(new Date(), 'Africa/Cairo', 'HH:mm');
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).trim() === String(vendorId).trim()) {
      var row = i + 2;
      if (foundStatus != null) sheet.getRange(row, TCOL.lastSeenStatus).setValue(foundStatus + ' @ ' + stamp);
      if (setStatus != null) sheet.getRange(row, TCOL.actionTaken).setValue(setStatus + ' @ ' + stamp);
      return 'Logged row ' + row + ': found=' + foundStatus + ' set=' + setStatus;
    }
  }
  return 'Vendor ID ' + vendorId + ' not found.';
}

function setupActionModule() {
  var a = setupActionColumns();
  var b = refreshChainIds();
  return a + '\n' + b;
}
