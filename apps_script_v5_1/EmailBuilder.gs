/**
 * EmailBuilder.gs — talabat-branded, human-toned emails.
 *
 * One shared visual shell (talabat theme) used by every stage:
 *   buildDailyCriticalEmail   -> to the Account Manager (daily top offenders by risk)
 *   buildTuesdayLeaderReport  -> to the Team Leader (weekly overview + vendors up for action)
 *   buildSundayWeeklyReport   -> to the Team Leader (MTD wrap + operations analysis)
 *   buildMondayEscalationEmail-> to the Team Leader (only vendors with no response/plan)
 *
 * Copy is written to read like a person wrote it — no "automated message" tags.
 * Every email carries the Action Tracker link.
 */

var EMAIL_FONT = "'Poppins','Segoe UI',Helvetica,Arial,sans-serif";

// ---------------- shared shell ----------------

function emailShell_(opts) {
  // opts: { subtitle, headline, preheader, bodyHtml, footerNote }
  var pre = opts.preheader || '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + THEME.cream + ';">' +
    '<span style="display:none!important;opacity:0;color:' + THEME.cream + ';height:0;width:0;overflow:hidden;">' + pre + '</span>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + THEME.cream + ';padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(65,21,23,0.08);">' +

    // brand header
    '<tr><td style="background:' + THEME.primary + ';padding:26px 34px 22px 34px;">' +
    '<div style="font-family:' + EMAIL_FONT + ';font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">talabat</div>' +
    '<div style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.lime + ';font-weight:600;margin-top:6px;">' + esc_(opts.subtitle || 'EGY Expansion Operations') + '</div>' +
    (opts.headline ? '<div style="font-family:' + EMAIL_FONT + ';font-size:20px;color:#ffffff;font-weight:700;margin-top:12px;line-height:1.3;">' + esc_(opts.headline) + '</div>' : '') +
    '</td></tr>' +

    // body
    '<tr><td style="padding:28px 34px 30px 34px;font-family:' + EMAIL_FONT + ';color:' + THEME.burgundy + ';">' +
    opts.bodyHtml +
    '</td></tr>' +

    // footer
    '<tr><td style="background:' + THEME.burgundy + ';padding:20px 34px;font-family:' + EMAIL_FONT + ';">' +
    '<div style="color:#ffffff;font-size:13px;font-weight:700;">talabat</div>' +
    '<div style="color:#D9C9C0;font-size:11px;line-height:1.7;margin-top:6px;">' +
    'EGY Expansion Operations' + (opts.footerNote ? ' &nbsp;·&nbsp; ' + esc_(opts.footerNote) : '') + '<br>' +
    'Questions? Reach the team at <a href="mailto:' + SEND_AS_EMAIL + '" style="color:' + THEME.lime + ';text-decoration:none;">' + SEND_AS_EMAIL + '</a>' +
    '</div></td></tr>' +

    '</table></td></tr></table></body></html>';
}

function ctaButton_(label, url, dark) {
  var bg = dark ? THEME.burgundy : THEME.primary;
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px 0;"><tr>' +
    '<td style="border-radius:8px;background:' + bg + ';">' +
    '<a href="' + url + '" style="display:inline-block;padding:13px 30px;font-family:' + EMAIL_FONT + ';font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">' + esc_(label) + ' &rarr;</a>' +
    '</td></tr></table>';
}

function trackerButton_() { return ctaButton_('Open the Action Tracker', TRACKER_URL); }

// Per-cluster links into the filtered Clusters Daily Report V2 dashboard.
function dashboardLinksBlock_(clusters) {
  var links = clusters.map(function(c) {
    var url = (typeof buildDashboardUrl_ === 'function') ? buildDashboardUrl_(c.cluster || c.key) : LOOKER_DASHBOARD;
    return '<a href="' + url + '" style="display:inline-block;margin:0 8px 8px 0;padding:9px 16px;font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:700;color:' + THEME.primary + ';background:' + THEME.primaryBg + ';border:1px solid ' + THEME.primaryTint + ';border-radius:8px;text-decoration:none;">' + esc_(c.name) + ' dashboard &rarr;</a>';
  }).join('');
  return '<p style="font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';margin:18px 0 8px 0;">Open the live Clusters Daily Report V2 (MTD, pre-filtered for your area):</p>' + links;
}

function sectionTitle_(txt) {
  return '<div style="font-family:' + EMAIL_FONT + ';font-size:13px;font-weight:700;color:' + THEME.primary +
    ';text-transform:uppercase;letter-spacing:0.6px;margin:26px 0 12px 0;padding-bottom:7px;border-bottom:2px solid ' + THEME.primaryBg + ';">' + esc_(txt) + '</div>';
}

function statCards_(cards) {
  // cards: [{value, label, color}]
  var tds = cards.map(function(c) {
    return '<td style="width:' + Math.floor(100 / cards.length) + '%;text-align:center;padding:14px 6px;background:' + THEME.cream + ';border-radius:10px;">' +
      '<div style="font-family:' + EMAIL_FONT + ';font-size:24px;font-weight:800;color:' + (c.color || THEME.burgundy) + ';">' + esc_(c.value) + '</div>' +
      '<div style="font-family:' + EMAIL_FONT + ';font-size:10px;font-weight:600;color:' + THEME.muted + ';text-transform:uppercase;letter-spacing:0.4px;margin-top:5px;">' + esc_(c.label) + '</div>' +
      '</td>';
  }).join('<td style="width:10px;"></td>');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + tds + '</tr></table>';
}

function vendorTable_(vendors, opts) {
  opts = opts || {};
  var showRisk = opts.showRisk !== false;
  var head = ['Vendor', 'City', 'Orders', 'Failed', 'Fail %', 'Fault Cases', 'Lost GMV'];
  if (showRisk) head.push('Risk');
  var th = head.map(function(h, i) {
    var align = i >= 2 ? 'right' : 'left';
    return '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:' + align + ';font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">' + h + '</th>';
  }).join('');

  var rows = vendors.map(function(v, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var risk = showRisk ? '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;text-align:right;">' + riskBadge_(v.riskLevel, v.riskScore) + '</td>' : '';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(v.vendor) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.city) + '</td>' +
      td_(formatNumber_(v.allOrders)) +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(v.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';">' + v.failRate + '%</td>' +
      td_(formatNumber_(v.vendorFaultCases || 0)) +
      td_(formatNumber_(Math.round(v.lostGmv || 0))) +
      risk +
      '</tr>';
  }).join('');

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr>' + th + '</tr>' + rows + '</table>';
}

function reasonTable_(reasons, clusterFails) {
  if (!reasons || reasons.length === 0) return '<p style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.muted + ';">No fail-reason data available.</p>';
  var rows = reasons.slice(0, 7).map(function(r, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var share = clusterFails > 0 ? ((r.failedOrders / clusterFails) * 100).toFixed(0) + '%' : '—';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';">' + esc_(shortenReasonName_(r.reason)) + '</td>' +
      td_(formatNumber_(r.failedOrders)) +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.muted + ';">' + share + '</td>' +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Fail Reason</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Share</th></tr>' +
    rows + '</table>';
}

function cityTable_(cities) {
  if (!cities || cities.length === 0) return '';
  var rows = cities.slice(0, 10).map(function(c, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(c.city) + '</td>' +
      td_(formatNumber_(c.allOrders)) +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(c.failedOrders) + '</td>' +
      '<td style="padding:9px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;">' + c.vendorFailRate + '%</td>' +
      td_(formatNumber_(c.lostGmv)) +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">City</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Orders</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Fail %</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Lost GMV</th></tr>' +
    rows + '</table>';
}

function ratePill_(rate, target) {
  var over = rate > target * 100 + 1e-9;
  var bg = over ? '#FCE4E4' : '#E4F3E7';
  var fg = over ? THEME.critical : THEME.low;
  var arrow = over ? '&#9650;' : '&#9660;';
  return '<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:' + bg + ';color:' + fg + ';font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:700;">' + arrow + ' ' + rate + '% vs ' + (target * 100).toFixed(2) + '%</span>';
}

// ---------------- 1) DAILY CRITICAL -> AM ----------------

function buildDailyCriticalEmail(amName, vendors, mtdRange) {
  var first = firstName_(amName);
  var tot = totals_(vendors);
  var count = vendors.length;

  var clusterSet = {};
  vendors.forEach(function(v) { if (v.clusterName) clusterSet[v.clusterName] = true; });
  var clusterNames = Object.keys(clusterSet);
  var clusterLabel = clusterNames.length === 1 ? clusterNames[0] : (clusterNames.length + ' clusters');
  var showCluster = clusterNames.length > 1;

  var body =
    para_('Hi ' + esc_(first) + ',') +
    para_('As part of today’s daily monitoring we reviewed your vendors and have <b>already actioned the offenders below</b>. Each one is listed with the main driver behind its failed orders so you have the full picture.') +

    sectionTitle_('Today at a glance') +
    statCards_([
      { value: formatNumber_(count), label: 'Vendors Actioned', color: THEME.primary },
      { value: formatNumber_(tot.failedOrders), label: 'Failed Orders', color: THEME.critical },
      { value: formatNumber_(tot.faultCases), label: 'Vendor Fault Cases', color: THEME.critical },
      { value: formatNumber_(tot.lostGmv), label: 'Lost GMV (EGP)', color: THEME.primary }
    ]) +

    sectionTitle_('Action taken on the following offenders') +
    '<p style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.muted + ';margin:0 0 12px 0;">Actioned today &mdash; each with the root cause behind its failed orders.</p>' +
    actionsTable_(vendors, showCluster) +

    sectionTitle_('What happens next') +
    '<ul style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.burgundy + ';line-height:1.8;margin:0;padding-left:18px;">' +
    '<li>Each vendor above is logged in the Action Tracker and flagged for follow-up.</li>' +
    '<li>Please align with the vendor on the root cause and add any action plan in the tracker.</li>' +
    '<li>Repeat offenders roll up into the leader’s Tuesday review.</li>' +
    '</ul>' +

    trackerButton_() +
    para_('Thanks a lot &mdash; shout if any of these need a second look.') +
    signoff_();

  return {
    subject: 'Daily monitoring: action taken on ' + count + ' vendor' + (count === 1 ? '' : 's') + ' — ' + getCairoMonth(),
    htmlBody: emailShell_({
      subtitle: clusterLabel + ' · Daily Monitoring',
      headline: 'Today’s actions on flagged vendors',
      preheader: count + ' vendors actioned today with root cause.',
      bodyHtml: body,
      footerNote: 'MTD ' + mtdRange.label
    })
  };
}

// Daily "actions taken" table with a simplified root-cause column.
function actionsTable_(vendors, showCluster) {
  var head = ['Vendor', 'City'];
  if (showCluster) head.push('Cluster');
  head = head.concat(['Failed', 'Fail %', 'Root cause']);
  var th = head.map(function(h) {
    var align = (h === 'Failed' || h === 'Fail %') ? 'right' : 'left';
    return '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:' + align + ';font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">' + h + '</th>';
  }).join('');
  var rows = vendors.map(function(v, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var clusterCell = showCluster ? '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.clusterName || '') + '</td>' : '';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(v.vendor) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.city) + '</td>' +
      clusterCell +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(v.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';">' + v.failRate + '%</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';">' + esc_(v.rootCause || '&mdash;') + '</td>' +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;"><tr>' + th + '</tr>' + rows + '</table>';
}

// ---------------- 2) TUESDAY -> TEAM LEADER ----------------

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

function buildMondayEscalationEmail(tlName, clusterName, vendors, mtdRange) {
  var first = firstName_(tlName);
  var rows = vendors.map(function(v, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var improved = v.performanceImproved === 'Yes' ? '&#10003;' : '&#10007;';
    var plan = (v.actionPlanShared === 'Yes' || v.actionPlanShared === 'Partial') ? '&#10003;' : '&#10007;';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;font-weight:600;color:' + THEME.burgundy + ';">' + esc_(v.vendor) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.city) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.amName || 'N/A') + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(v.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:center;">' + improved + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:center;">' + plan + '</td>' +
      '</tr>';
  }).join('');

  var body =
    para_('Hi ' + esc_(first) + ',') +
    para_('These vendors in <b>' + esc_(clusterName) + '</b> didn’t show improvement and we haven’t received an action plan from the Tuesday heads-up, so we’re moving ahead with the agreed corrective action today.') +
    sectionTitle_('Vendors being actioned') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;">' +
    '<tr><th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Vendor</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">City</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:left;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">AM</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:right;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Failed</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:center;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Improved</th>' +
    '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:center;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;">Plan</th></tr>' +
    rows + '</table>' +
    trackerButton_() +
    para_('If any of this needs a second look, let’s talk today before it goes further.') +
    signoff_();

  return {
    subject: 'Vendors being actioned today — ' + clusterName + ' · ' + getCairoMonth(),
    htmlBody: emailShell_({
      subtitle: clusterName + ' · Escalation',
      headline: 'Moving ahead with corrective action',
      preheader: vendors.length + ' vendors being actioned in ' + clusterName + '.',
      bodyHtml: body,
      footerNote: 'MTD ' + mtdRange.label
    })
  };
}

// ---------------- small helpers ----------------

function para_(html) {
  return '<p style="font-family:' + EMAIL_FONT + ';font-size:14px;line-height:1.7;color:' + THEME.burgundy + ';margin:0 0 16px 0;">' + html + '</p>';
}
function signoff_() {
  return '<p style="font-family:' + EMAIL_FONT + ';font-size:14px;line-height:1.7;color:' + THEME.burgundy + ';margin:18px 0 0 0;">All the best,<br><b style="color:' + THEME.primary + ';">' + EMAIL_SENDER_NAME + '</b></p>';
}
function td_(v) {
  return '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.burgundy + ';">' + v + '</td>';
}
function riskBadge_(level, score) {
  var colors = { critical: THEME.critical, high: THEME.primary, medium: THEME.medium, low: THEME.low };
  var fg = (level === 'medium') ? THEME.burgundy : '#ffffff';
  var bg = colors[level] || THEME.muted;
  return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-family:' + EMAIL_FONT + ';font-size:10px;font-weight:800;color:' + fg + ';background:' + bg + ';">' + (score != null ? score : (level || '').toUpperCase()) + '</span>';
}
function totals_(vendors) {
  var t = { allOrders: 0, failedOrders: 0, faultCases: 0, lostGmv: 0 };
  vendors.forEach(function(v) {
    t.allOrders += v.allOrders || 0;
    t.failedOrders += v.failedOrders || 0;
    t.faultCases += v.vendorFaultCases || 0;
    t.lostGmv += Math.round(v.lostGmv || 0);
  });
  return t;
}
function firstName_(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function formatNumber_(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function shortenReasonName_(reason) {
  var map = {
    'POST_ACCEPTANCE_FORGOT_TO_ADD_SOMETHING': 'Forgot to Add Something',
    'POST_ACCEPTANCE_DUPLICATE_ORDER': 'Duplicate Order',
    'POST_ACCEPTANCE_WRONG_ADDRESS': 'Wrong Address',
    'POST_ACCEPTANCE_CHANGED_MIND_NO_REASON': 'Changed Mind / No Reason',
    'POST_ACCEPTANCE_CHANGE_PAYMENT_METHOD': 'Change Payment Method',
    'POST_ACCEPTANCE_VOUCHER_NOT_APPLIED': 'Voucher Not Applied',
    'Ven - Refuse to prepare Order': 'Vendor Refuse to Prepare',
    'Ven - uncontactable': 'Vendor Uncontactable',
    'CST - Fake order': 'Fake Order',
    'CST - Duplicate Order': 'Duplicate Order (CST)',
    'CST - doesn\'t response': 'Customer No Response',
    'CST - Unable to pay': 'Unable to Pay',
    'CST - Refuse to receive the order': 'Refuse to Receive',
    'CST - Change Payment Method': 'Change Payment (CST)',
    'CST - Refuse to provide a reason': 'No Reason Given',
    'Order Picked-up/ delivered by another rider': 'Picked-up by Another Rider',
    'Unprofessional Behavior from Rider': 'Rider Issue',
    'Late Delivery': 'Late Delivery',
    'Food is inedible': 'Food Inedible',
    'Ven Wrong Order': 'Wrong Order'
  };
  return map[reason] || reason;
}
