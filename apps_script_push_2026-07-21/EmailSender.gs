/**
 * EmailSender.gs — routing + delivery for every workflow stage.
 * All mail is sent FROM exp.eg@talabat.com, CC exp.eg@talabat.com.
 * sendDailyCriticalAlerts() is no longer called by dailyRun() — kept for manual/rollback
 * use. The AM "Daily monitoring" email is now sent by sendActionedVendorEmails(), called
 * by the (daily 17:00) portal action agent after it finishes, so it only covers vendors
 * actually set to Hidden that day.
 */

// When set (see runFullTestToMe), every email is redirected to this address
// with a [TEST -> original] subject and no CC. Null in normal operation.
var __TEST_REDIRECT = null;

function sendEmail_(to, content) {
  // TEST-mode switch: __TEST_REDIRECT (runFullTestToMe) still wins; otherwise honor the
  // persistent TEST_MODE flag (Config.isTestMode). When TEST is on, redirect to ALERT_EMAIL.
  var redirect = __TEST_REDIRECT || (isTestMode() ? ALERT_EMAIL : null);
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
      sendEmail_(email, content);
      sent++;
      Logger.log('Sunday wrap sent to ' + g.tlName + ' (' + email + ')');
    } catch (e) {
      errors.push(email + ': ' + e.message);
    }
  });
  return { sent: sent, total: Object.keys(byLeader).length, errors: errors };
}

// ---- MONDAY: escalation -> Team Leaders (only unresolved) ----
function sendMondayEscalations(escalationVendors, mtdRange) {
  var byLeader = {}; // tlEmail -> { tlName, clusterName, vendors:[] }
  escalationVendors.forEach(function(v) {
    var email = (v.teamLeaderEmail || clusterTlEmail_(v.cluster) || '').trim();
    if (!email) return;
    if (!byLeader[email]) byLeader[email] = { tlName: v.teamLeaderName || clusterTlName_(v.cluster) || 'there', clusterName: v.cluster, vendors: [] };
    byLeader[email].vendors.push(v);
  });

  var sent = 0, skipped = 0, errors = [];
  Object.keys(byLeader).forEach(function(email) {
    var g = byLeader[email];
    try {
      var content = buildMondayEscalationEmail(g.tlName, g.clusterName, g.vendors, mtdRange);
      sendEmail_(email, content);
      sent++;
    } catch (e) {
      errors.push(email + ': ' + e.message);
    }
  });
  return { sent: sent, skipped: skipped, total: Object.keys(byLeader).length, errors: errors };
}

// ---- ACTIONED VENDORS: fired by the (daily) portal action agent, NOT dailyRun ----
// Only vendors the action agent actually set to Hidden today get emailed to their AM —
// reuses the exact same "Daily monitoring" template as before (buildDailyCriticalEmail),
// same theme, same subject pattern. dailyRun() no longer sends this email itself; the
// Cowork/Chrome action agent calls this function once it has finished today's portal
// updates, so "we have already actioned the offenders below" is literally true.
function sendActionedVendorEmails() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  if (!sheet) return { sent: 0, groups: 0, vendors: 0, errors: ['No Vendor Action Tracker sheet'] };

  var last = sheet.getLastRow();
  if (last < 2) return { sent: 0, groups: 0, vendors: 0, errors: [] };

  var today = getCairoDate(0);
  var data = sheet.getRange(2, 1, last - 1, 35).getValues(); // A..AI

  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var rowDate = (r[0] instanceof Date) ? Utilities.formatDate(r[0], 'Africa/Cairo', 'yyyy-MM-dd') : String(r[0]).trim();
    if (rowDate !== today) break; // newest-first: today's block is always at the top
    var actionTaken = String(r[34] || ''); // AI (col 35)
    if (actionTaken.indexOf('Set Hidden') !== 0) continue; // only the real corrective action counts — not "No action"/"Left active"/"Restored"/"Skipped"
    rows.push({
      sheetRow: i + 2,
      vendorId: String(r[1] || '').trim(),  // Vendor ID (col B) — needed for the per-vendor Action Plan form link
      runDate: today,                        // this row's Run Date, for the same link
      vendor: String(r[2] || ''),
      city: String(r[3] || ''),
      clusterName: String(r[4] || ''),
      amName: String(r[5] || ''),
      amEmail: String(r[6] || '').trim(),
      allOrders: Number(r[11]) || 0,
      failedOrders: Number(r[12]) || 0,
      lostGmv: Number(r[13]) || 0,
      failRate: String(r[14] || '').replace('%', ''),
      vendorFaultCases: Number(r[18]) || 0,
      // Tracker only stores case-type counts, not the original free-text fail reason,
      // so this is a category label ("Late delivery (3 cases)"), not the exact reason
      // string the old ScoringEngine-fed email showed.
      rootCause: deriveRootCause_(Number(r[16]) || 0, Number(r[17]) || 0, Number(r[15]) || 0, Number(r[18]) || 0)
    });
  }

  if (rows.length === 0) return { sent: 0, groups: 0, vendors: 0, errors: [] };

  var groups = {};
  rows.forEach(function(v) {
    if (!v.amEmail) return;
    if (!groups[v.amEmail]) groups[v.amEmail] = { amName: v.amName || 'there', vendors: [] };
    groups[v.amEmail].vendors.push(v);
  });

  var mtd = getMtdRange();
  var sent = 0, errors = [], actionedRows = [];
  Object.keys(groups).forEach(function(email) {
    var g = groups[email];
    try {
      var content = buildDailyCriticalEmail(g.amName, g.vendors, mtd);
      sendEmail_(email, content);
      sent++;
      g.vendors.forEach(function(v) { actionedRows.push({ row: v.sheetRow }); });
      Logger.log('Actioned-vendor email sent to ' + g.amName + ' (' + email + '), ' + g.vendors.length + ' vendor(s)');
    } catch (e) {
      errors.push(email + ': ' + e.message);
    }
  });

  if (actionedRows.length) {
    try { markTuesdayAlerts_(sheet, actionedRows); } catch (me) { errors.push('markAlert: ' + me.message); }
  }

  try {
    appendMonitoringLog_(ss, { status: errors.length ? 'PARTIAL' : 'SUCCESS', durationSeconds: 0, clustersProcessed: 0, emailsSent: sent, errors: errors });
  } catch (le) { Logger.log('Monitoring log append failed: ' + le.message); }

  return { sent: sent, groups: Object.keys(groups).length, vendors: rows.length, errors: errors };
}

function deriveRootCause_(lateDeliveryCases, missingItemCases, qualityCases, vendorFaultCases) {
  var cases = [['Late delivery', lateDeliveryCases], ['Missing items', missingItemCases], ['Food quality', qualityCases]];
  cases.sort(function(a, b) { return b[1] - a[1]; });
  if (cases[0][1] > 0) return cases[0][0] + ' (' + cases[0][1] + ' case' + (cases[0][1] === 1 ? '' : 's') + ')';
  return vendorFaultCases > 0 ? 'Vendor fault case' : '—';
}

// ---- internal failure alert ----
function sendAlertEmail(subject, body) {
  try {
    GmailApp.sendEmail(ALERT_EMAIL, subject, body, { from: SEND_AS_EMAIL, name: 'talabat EGY Ops — Alert' });
  } catch (e) {
    Logger.log('Failed to send alert email: ' + e.message);
  }
}

// ---- helpers ----
function groupClustersByLeader_(clusterResults) {
  var byLeader = {};
  clusterResults.forEach(function(c) {
    var email = (c.tlEmail || '').trim();
    if (!email) return;
    if (!byLeader[email]) byLeader[email] = { tlName: c.tlName, clusters: [] };
    byLeader[email].clusters.push(c);
  });
  // order each leader's clusters by risk desc for a clean read
  Object.keys(byLeader).forEach(function(e) {
    byLeader[e].clusters.sort(function(a, b) { return b.riskScore - a.riskScore; });
  });
  return byLeader;
}

function clusterTlEmail_(clusterNameOrKey) {
  var c = CLUSTERS[clusterNameOrKey];
  if (c) return c.tlEmail;
  var found = null;
  Object.keys(CLUSTERS).forEach(function(k) { if (CLUSTERS[k].name === clusterNameOrKey) found = CLUSTERS[k].tlEmail; });
  return found;
}
function clusterTlName_(clusterNameOrKey) {
  var c = CLUSTERS[clusterNameOrKey];
  if (c) return c.tlName;
  var found = null;
  Object.keys(CLUSTERS).forEach(function(k) { if (CLUSTERS[k].name === clusterNameOrKey) found = CLUSTERS[k].tlName; });
  return found;
}
