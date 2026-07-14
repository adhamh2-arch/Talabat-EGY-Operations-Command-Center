/**
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
// Cloud cutover (July 2026): move DAILY + MONDAY to Apps Script triggers (Google's
// servers — no laptop, no approvals). SUNDAY weekly stays in Cowork (the Looker WoW
// analysis, which Apps Script can't produce). Tuesday leader report left off — the
// Cowork Tuesday task handles the portal actions. Re-add tuesdayReport / sundayReport
// lines here if you later want them on cloud too (keep TEST mode on for Sunday so it
// doesn't compete with the Cowork Looker weekly to Team Leaders).
function setupWeeklyTriggers() {
  removeAllTriggers();
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(9).nearMinute(0).inTimezone('Africa/Cairo').create();
  ScriptApp.newTrigger('mondayEscalation').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).nearMinute(0).inTimezone('Africa/Cairo').create();
  Logger.log('Triggers set: dailyRun 09:00 daily · mondayEscalation 10:00 Mon (Africa/Cairo). Sunday weekly stays in Cowork (Looker).');
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
    .addItem('🎯 Take Action — prep offenders (40–100% VFR)', 'prepareTakeAction')
    .addSeparator()
    .addItem('🧪 Email mode — show current', 'showEmailMode')
    .addItem('      ↳ Switch to TEST (emails to me only)', 'enableTestMode')
    .addItem('      ↳ GO LIVE (emails to real recipients)', 'disableTestMode')
    .addSeparator()
    .addItem('⏰ Enable All Triggers', 'setupWeeklyTriggers')
    .addItem('⏹ Disable All Triggers', 'removeAllTriggers')
    .addToUi();
}

function manualTuesdayReport() { confirmAndRun_('Send Tuesday Leader Report?', 'Performance overview + action shortlist will be emailed to Team Leaders.', 'tuesdayReport'); }
function manualSundayReport() { confirmAndRun_('Send Sunday Weekly Report?', 'MTD wrap + operations analysis will be emailed to Team Leaders.', 'sundayReport'); }
function manualMondayEscalation() { confirmAndRun_('Send Monday Escalation?', 'Escalation notices will be emailed for unresolved vendors.', 'mondayEscalation'); }

function confirmAndRun_(title, msg, fnName) {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert(title, msg + '\n\nFrom: ' + SEND_AS_EMAIL + '  ·  CC: ' + CC_EMAIL + '\n\nProceed?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) { ui.alert('Cancelled', 'Nothing was sent.', ui.ButtonSet.OK); return; }
  this[fnName]();
  ui.alert('Done', 'Processed. Check the Monitoring Log for details.', ui.ButtonSet.OK);
}

function checkFeederHealth() {
  var feedData = readFeedData();
  var lines = (feedData.health || []).map(function(h) {
    return h.cluster + ': ' + h.vendorRows + ' vendors, ' + h.failedOrders + ' failed  [via ' + h.source + ']';
  });
  var warns = (feedData.warnings || []).join('\n');
  SpreadsheetApp.getUi().alert('Feeder Health — ' + getCairoDate(0),
    lines.join('\n') + (warns ? '\n\n— Notes —\n' + warns : ''), SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================ email-mode switch (added July 2026) ============================
function showEmailMode() {
  SpreadsheetApp.getUi().alert('Email mode',
    isTestMode() ? 'TEST mode is ON — all emails go to ' + ALERT_EMAIL + ' only.'
                 : 'LIVE mode — emails go to real recipients (AMs / Team Leaders).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
function enableTestMode() {
  setTestMode_(true);
  SpreadsheetApp.getUi().alert('TEST mode ON',
    'All emails will now go to ' + ALERT_EMAIL + ' only.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
function disableTestMode() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Go LIVE?',
    'Emails will be sent to REAL recipients (Account Managers + Team Leaders) from ' +
    SEND_AS_EMAIL + '. Continue?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) { ui.alert('Cancelled', 'Still in TEST mode.', ui.ButtonSet.OK); return; }
  setTestMode_(false);
  ui.alert('LIVE mode', 'Emails will now go to real recipients.', ui.ButtonSet.OK);
}
