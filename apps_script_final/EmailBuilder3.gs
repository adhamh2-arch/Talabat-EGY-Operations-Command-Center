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
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;">' + ratePill_(c.vendorFailRate, c.target) + '</td>' +
      td_(formatNumber_(c.lostGmv)) +
      '</tr>';
  }).join('');

  var body =
    para_('Hi ' + esc_(first) + ',') +
    para_('Here’s where things stand for your area this month, along with the vendors we’re lining up for action on <b>Monday</b> if we don’t see improvement or an action plan before then. Nothing is actioned yet &mdash; this is the heads-up so you and the team can get ahead of it.') +

    sectionTitle_('Performance overview (MTD)') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Cluster</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Orders</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Fail Rate</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Lost GMV</th></tr>' +
    overview + '</table>' +

    sectionTitle_('Vendors up for action on Monday') +
    vendorTable_(shortlist, { showRisk: true }) +

    para_('If any of these improve or send through a plan before Monday, we’ll take them off the list &mdash; just make sure it’s reflected in the tracker.') +
    dashboardLinksBlock_(clusters) +
    trackerButton_() +
    signoff_();

  var clusterLabel = clusters.length === 1 ? clusters[0].name : (clusters.length + ' clusters');
  return {
    subject: 'Weekly performance & vendors up for action — ' + clusterLabel + ' · ' + getCairoMonth(),
    htmlBody: emailShell_({
      subtitle: clusterLabel + ' · Weekly Leader Update',
      headline: 'This week’s performance and what’s next',
      preheader: shortlist.length + ' vendors lined up for Monday action.',
      bodyHtml: body,
      footerNote: 'MTD ' + mtdRange.label
    })
  };
}

// ---------------- 3) SUNDAY -> TEAM LEADER (weekly wrap) ----------------

function insight_(txt) {
  if (!txt) return '';
  return '<p style="font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';margin:10px 0 0 0;font-style:italic;">Insight: ' + esc_(txt) + '</p>';
}

function buildSundayWeeklyReport(tlName, clusters, mtdRange) {
  var first = firstName_(tlName);
  var clusterLabel = clusters.length === 1 ? clusters[0].name : (clusters.length + ' clusters');
  var multi = clusters.length > 1;

  // ---- aggregate across the leader's clusters ----
  var totOrders = 0, totFailed = 0, totFault = 0, totLost = 0, wTarget = 0, aboveTarget = [];
  clusters.forEach(function(c) {
    totOrders += c.allOrders; totFailed += c.failedOrders; totFault += c.vendorFaultCases; totLost += c.lostGmv;
    wTarget += c.target * c.allOrders;
    if (c.deviation > 0) aboveTarget.push(c.name);
  });
  var overallRate = totOrders > 0 ? +((totFailed / totOrders) * 100).toFixed(2) : 0;
  var blendedTarget = totOrders > 0 ? wTarget / totOrders : 0;

  var offenders = [];
  clusters.forEach(function(c) { (c.topOffenders || []).forEach(function(v) { v.clusterName = c.name; offenders.push(v); }); });
  offenders.sort(function(a, b) { return (b.riskScore - a.riskScore) || (b.failedOrders - a.failedOrders); });
  var topOff = offenders.slice(0, 8);

  var rmap = {};
  clusters.forEach(function(c) { (c.failReasons || []).forEach(function(r) { rmap[r.reason] = (rmap[r.reason] || 0) + r.failedOrders; }); });
  var reasons = Object.keys(rmap).map(function(k) { return { reason: k, failedOrders: rmap[k] }; }).sort(function(a, b) { return b.failedOrders - a.failedOrders; });
  var topReasonShare = (totFailed > 0 && reasons.length) ? Math.round((reasons[0].failedOrders / totFailed) * 100) : 0;

  var cities = [];
  clusters.forEach(function(c) { (c.cities || []).forEach(function(ct) { cities.push(ct); }); });
  cities.sort(function(a, b) { return b.failedOrders - a.failedOrders; });

  var clusterRows = clusters.slice().sort(function(a, b) { return b.riskScore - a.riskScore; }).map(function(c) {
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:600;color:' + THEME.burgundy + ';">' + esc_(c.name) + '</td>' +
      td_(formatNumber_(c.allOrders)) +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(c.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;">' + ratePill_(c.vendorFailRate, c.target) + '</td>' +
      td_(formatNumber_(c.lostGmv)) +
      '</tr>';
  }).join('');
  var clusterTable =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Cluster</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Orders</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Fail Rate</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Lost GMV</th></tr>' +
    clusterRows + '</table>';

  var body =
    para_('Hi ' + esc_(first) + ',') +
    para_('Here’s your weekly wrap &mdash; a quick read on where <b>' + esc_(clusterLabel) + '</b> stands this month and what’s driving the failed orders.') +

    sectionTitle_('1 · MTD snapshot') +
    '<div style="margin-bottom:10px;">' + ratePill_(overallRate, blendedTarget) + '</div>' +
    statCards_([
      { value: formatNumber_(totOrders), label: 'Net Orders' },
      { value: formatNumber_(totFailed), label: 'Failed', color: THEME.critical },
      { value: formatNumber_(totFault), label: 'Fault Cases', color: THEME.critical },
      { value: formatNumber_(totLost), label: 'Lost GMV', color: THEME.primary }
    ]) +
    insight_(aboveTarget.length ? (aboveTarget.length + ' of ' + clusters.length + ' cluster(s) above target: ' + aboveTarget.join(', ') + '.') : 'All clusters are at or below target this month.') +

    sectionTitle_('2 · Cluster performance') +
    clusterTable +
    insight_(overallRate > blendedTarget * 100 ? ('Blended fail rate ' + overallRate + '% is above the ' + (blendedTarget * 100).toFixed(2) + '% target.') : ('Blended fail rate ' + overallRate + '% is within target.')) +

    sectionTitle_('3 · Top offenders to action') +
    actionsTable_(topOff, multi) +

    sectionTitle_('4 · What’s driving the fails') +
    reasonTable_(reasons, totFailed) +
    insight_(reasons.length ? ('Top driver: ' + shortenReasonName_(reasons[0].reason) + ' — ' + topReasonShare + '% of failed orders.') : '') +

    sectionTitle_('5 · Where it’s concentrated') +
    cityTable_(cities) +
    insight_(cities.length ? (cities[0].city + ' carries the most failed orders (' + formatNumber_(cities[0].failedOrders) + ').') : '') +
    dashboardLinksBlock_(clusters) +
    trackerButton_() +
    para_('Have a good week ahead.') +
    signoff_();

  return {
    subject: 'Weekly wrap — ' + clusterLabel + ' MTD performance · ' + getCairoMonth(),
    htmlBody: emailShell_({
      subtitle: clusterLabel + ' · Weekly Wrap',
      headline: 'Your week in review',
      preheader: 'MTD performance and root-cause breakdown for ' + clusterLabel + '.',
      bodyHtml: body,
      footerNote: 'MTD ' + mtdRange.label
    })
  };
}

// ---------------- 4) MONDAY ESCALATION -> TEAM LEADER ----------------

