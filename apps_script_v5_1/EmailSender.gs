/**
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
