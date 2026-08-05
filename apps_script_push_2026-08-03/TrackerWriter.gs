var TRACKER_COLS = 31;
var TRACKER_WRITE_COLS = 32;
function updateVendorTracker(scoredOutput, feedData, emailsSent) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetName = SHEET_NAMES.vendorTracker;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { sheet = ss.insertSheet(sheetName); initTrackerSheet_(sheet); }
  else {
    var lastCol = Math.max(sheet.getLastColumn(), TRACKER_COLS);
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (String(headerRow[19]) !== 'Risk Score') { Logger.log('Migrating tracker to v5.1 schema (31 columns).'); sheet.clear(); initTrackerSheet_(sheet); }
  }
  try { sheet.getRange(2, 32, Math.max(sheet.getMaxRows() - 1, 1), 4).clearDataValidations(); } catch (e) {}
  var today = getCairoDate(0);
  var existing = sheet.getDataRange().getValues();
  function rowDateStr_(v) { return (v instanceof Date) ? Utilities.formatDate(v, 'Africa/Cairo', 'yyyy-MM-dd') : String(v).trim(); }
  var todaysPlans = {};
  for (var p = 1; p < existing.length; p++) { if (rowDateStr_(existing[p][0]) !== today) continue; var pvid = String(existing[p][1] || '').trim(); if (!pvid) continue; todaysPlans[pvid] = { ac: existing[p][28], ad: existing[p][29] }; }
  for (var d = existing.length - 1; d >= 1; d--) { if (rowDateStr_(existing[d][0]) === today) sheet.deleteRow(d + 1); }
  existing = sheet.getDataRange().getValues();
  var history = {};
  for (var i = 1; i < existing.length; i++) { var vn = String(existing[i][2]); if (vn) history[vn] = (history[vn] || 0) + 1; }
  var rows = [];
  scoredOutput.clusterResults.forEach(function(cluster) {
    (cluster.topOffenders || []).forEach(function(v) {
      var appearances = (history[v.vendor] || 0) + 1;
      var prior = todaysPlans[String(v.vendorId || '').trim()];
      var acVal = (prior && prior.ac) ? prior.ac : 'No';
      var adVal = (prior && prior.ad) ? prior.ad : '';
      rows.push([today, v.vendorId || '', v.vendor, v.city, cluster.name, v.amName || '', v.amEmail || '', v.teamLeaderName || '', v.isKey || '', v.isTgo || '', v.isFood || '', v.allOrders || 0, v.failedOrders, v.lostGmv, v.failRate + '%', v.foodQualityCases || 0, v.lateDeliveryCases || 0, v.missingItemCases || 0, v.vendorFaultCases || 0, (v.riskScore != null ? v.riskScore : cluster.riskScore), String(v.riskLevel || cluster.riskLevel).toUpperCase(), appearances, getRepeatFlag_(appearances), '', '', '', '', '', acVal, adVal, 'Open', v.chainId || '']);
    });
  });
  if (rows.length === 0) return { rowsAdded: 0, message: 'No offenders to track' };
  rows.sort(function(a, b) { if (b[21] !== a[21]) return b[21] - a[21]; return b[18] - a[18]; });
  if (sheet.getMaxColumns() < TRACKER_WRITE_COLS) { sheet.insertColumnsAfter(sheet.getMaxColumns(), TRACKER_WRITE_COLS - sheet.getMaxColumns()); }
  var startRow = 2;
  sheet.insertRowsBefore(2, rows.length);
  sheet.getRange(startRow, 1, rows.length, TRACKER_WRITE_COLS).setValues(rows);
  formatTrackerRows_(sheet, startRow, rows.length);
  applyTrackerProtection_(sheet);
  // AG "Requested Action (auto)" holds an ARRAYFORMULA anchored at row 2 (see ActionTool.gs).
  // insertRowsBefore(2, N) above just pushed that formula cell down by N rows, so it no longer
  // covers the rows we just wrote — re-plant it at row 2 now, every run, or new offenders show
  // a permanently blank action column (see action-formula-anchor-shift-bug memory).
  try { if (typeof reanchorRequestedAction_ === 'function') reanchorRequestedAction_(); } catch (ae) { Logger.log('reanchorRequestedAction_ failed: ' + ae.message); }
  return { rowsAdded: rows.length, message: rows.length + ' vendors tracked for ' + today };
}
function initTrackerSheet_(sheet) {
  var headers = ['Run Date', 'Vendor ID', 'Vendor Name', 'City', 'Cluster', 'AM Name', 'AM Email', 'Team Leader', 'Is Key VIP', 'Is TGO', 'Is Food', 'Net Orders', 'Net Failed Orders', 'Lost GMV (EGP)', 'Net Fail Rate %', 'Order Quality Cases', 'Late Delivery Cases', 'Missing Item Cases', 'Vendor Fault Cases', 'Risk Score', 'Risk Level', 'Appearances MTD', 'Repeat Flag', 'Alert Sent', 'Alert Date', 'Escalation Sent', 'Escalation Date', 'Performance Improved', 'Action Plan Shared', 'Action Plan Details', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var hdr = sheet.getRange(1, 1, 1, headers.length);
  hdr.setBackground(THEME.primary).setFontColor(THEME.headerText).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.getRange(1, 9, 1, 3).setBackground('#8A5A00');
  sheet.getRange(1, 16, 1, 4).setBackground('#E65100');
  sheet.getRange(1, 24, 1, 8).setBackground('#E65100');
  var widths = [100, 90, 240, 120, 90, 140, 200, 140, 80, 70, 70, 90, 90, 110, 80, 90, 90, 90, 90, 70, 80, 90, 80, 80, 90, 90, 100, 100, 110, 260, 90];
  for (var i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  var yn = SpreadsheetApp.newDataValidation().requireValueInList(['', 'Yes', 'No']).setAllowInvalid(false).build();
  sheet.getRange('X2:X1000').setDataValidation(yn);
  sheet.getRange('Z2:Z1000').setDataValidation(yn);
  var improvedRule = SpreadsheetApp.newDataValidation().requireValueInList(['', 'Yes', 'No', 'N/A']).setAllowInvalid(false).build();
  sheet.getRange('AB2:AB1000').setDataValidation(improvedRule);
  var actionRule = SpreadsheetApp.newDataValidation().requireValueInList(['', 'Yes', 'No', 'Partial']).setAllowInvalid(false).build();
  sheet.getRange('AC2:AC1000').setDataValidation(actionRule);
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['Open', 'In Progress', 'Resolved', 'Escalated', 'No Response']).setAllowInvalid(false).build();
  sheet.getRange('AE2:AE1000').setDataValidation(statusRule);
}
function getRepeatFlag_(count) { if (count >= 6) return 'CRITICAL'; if (count >= 4) return 'HIGH'; if (count >= 2) return 'MEDIUM'; return 'NEW'; }
function formatTrackerRows_(sheet, startRow, numRows) {
  var range = sheet.getRange(startRow, 1, numRows, TRACKER_COLS);
  range.setFontSize(9).setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow, 12, numRows, 1).setNumberFormat('#,##0');
  sheet.getRange(startRow, 13, numRows, 1).setNumberFormat('#,##0');
  sheet.getRange(startRow, 14, numRows, 1).setNumberFormat('#,##0.00');
  sheet.getRange(startRow, 16, numRows, 4).setNumberFormat('#,##0');
  sheet.getRange(startRow, 24, numRows, 8).setBackground('#E3F2FD');
  for (var i = 0; i < numRows; i++) {
    var row = startRow + i;
    var vals = sheet.getRange(row, 1, 1, TRACKER_COLS).getValues()[0];
    var flagCell = sheet.getRange(row, 23);
    var flag = vals[22];
    if (flag === 'CRITICAL') { flagCell.setBackground(THEME.critical).setFontColor('#FFF').setFontWeight('bold'); sheet.getRange(row, 1, 1, 23).setBackground('#FFF0F0'); }
    else if (flag === 'HIGH') { flagCell.setBackground(THEME.high).setFontColor('#FFF').setFontWeight('bold'); sheet.getRange(row, 1, 1, 23).setBackground('#FFF3E0'); }
    else if (flag === 'MEDIUM') { flagCell.setBackground(THEME.medium).setFontColor('#000').setFontWeight('bold'); }
    else { flagCell.setBackground(THEME.low).setFontColor('#FFF'); }
    var riskCell = sheet.getRange(row, 21);
    switch (String(vals[20]).toUpperCase()) {
      case 'CRITICAL': riskCell.setBackground(THEME.critical).setFontColor('#FFF'); break;
      case 'HIGH': riskCell.setBackground(THEME.high).setFontColor('#FFF'); break;
      case 'MEDIUM': riskCell.setBackground(THEME.medium).setFontColor('#000'); break;
      case 'LOW': riskCell.setBackground(THEME.low).setFontColor('#FFF'); break;
    }
    var statusCell = sheet.getRange(row, 31);
    switch (vals[30]) {
      case 'Open': statusCell.setBackground('#FFCDD2').setFontColor('#B71C1C'); break;
      case 'In Progress': statusCell.setBackground('#FFF9C4').setFontColor('#F57F17'); break;
      case 'Resolved': statusCell.setBackground('#C8E6C9').setFontColor('#1B5E20'); break;
      case 'Escalated': statusCell.setBackground('#CE93D8').setFontColor('#4A148C'); break;
      case 'No Response': statusCell.setBackground('#FFCCBC').setFontColor('#BF360C'); break;
    }
  }
}
function applyTrackerProtection_(sheet) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  protections.forEach(function(p) { p.remove(); });
  var protection = sheet.protect().setDescription('Historical data locked - workflow + action columns (X-AI) are editable').setWarningOnly(true);
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
      offenders.push({ row: i + 1, runDate: runDate, vendorId: String(data[i][1]), vendor: String(data[i][2]), city: String(data[i][3]), cluster: String(data[i][4]), amName: String(data[i][5]), amEmail: String(data[i][6]), teamLeaderName: String(data[i][7]), allOrders: Number(data[i][11]) || 0, failedOrders: Number(data[i][12]) || 0, lostGmv: Number(data[i][13]) || 0, failRate: String(data[i][14]), foodQualityCases: Number(data[i][15]) || 0, lateDeliveryCases: Number(data[i][16]) || 0, missingItemCases: Number(data[i][17]) || 0, vendorFaultCases: Number(data[i][18]) || 0, riskScore: Number(data[i][19]) || 0, riskLevel: String(data[i][20]), alertSent: String(data[i][23]), escalationSent: String(data[i][25]), performanceImproved: String(data[i][27]), actionPlanShared: String(data[i][28]), status: String(data[i][30]), chainId: String(data[i][31] || '') });
    }
  }
  return offenders;
}
function markTuesdayAlerts_(sheet, vendorRows) { var today = getCairoDate(0); vendorRows.forEach(function(v) { sheet.getRange(v.row, 24).setValue('Yes'); sheet.getRange(v.row, 25).setValue(today); }); }
function markMondayEscalations_(sheet, vendorRows) { var today = getCairoDate(0); vendorRows.forEach(function(v) { sheet.getRange(v.row, 26).setValue('Yes'); sheet.getRange(v.row, 27).setValue(today); sheet.getRange(v.row, 31).setValue('Escalated'); }); }
function markSundayReview_(sheet, vendorRows, improved) { vendorRows.forEach(function(v) { var isImproved = improved[v.vendor] || false; sheet.getRange(v.row, 28).setValue(isImproved ? 'Yes' : 'No'); }); }
