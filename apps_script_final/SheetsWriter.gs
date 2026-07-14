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
