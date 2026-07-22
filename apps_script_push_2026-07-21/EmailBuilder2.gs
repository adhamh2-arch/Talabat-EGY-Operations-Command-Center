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
    '<p style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.muted + ';margin:0 0 12px 0;">Actioned today &mdash; each with the root cause behind its failed orders. Use <b>Log Plan</b> next to a vendor to record your action plan.</p>' +
    actionsTable_(vendors, showCluster, { showActionLink: true }) +

    sectionTitle_('What happens next') +
    '<ul style="font-family:' + EMAIL_FONT + ';font-size:13px;color:' + THEME.burgundy + ';line-height:1.8;margin:0;padding-left:18px;">' +
    '<li>Each vendor above is logged in the Action Tracker and flagged for follow-up.</li>' +
    '<li>Use the <b>Log Plan</b> button next to a vendor to record the root cause and action plan directly &mdash; it updates the tracker for you.</li>' +
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

// Daily "actions taken" table with a simplified root-cause column. When opts.showActionLink
// is true and a vendor object carries a vendorId, each row also gets a small "Log Plan"
// button linking to the ActionForm.gs web app (falls back to the plain tracker link until
// ACTION_FORM_URL is deployed — see Config.gs buildActionFormUrl_). runDate defaults to
// today if the caller didn't attach one (e.g. the dormant sendDailyCriticalAlerts path).
function actionsTable_(vendors, showCluster, opts) {
  opts = opts || {};
  var showAction = !!opts.showActionLink;
  var head = ['Vendor', 'City'];
  if (showCluster) head.push('Cluster');
  head = head.concat(['Failed', 'Fail %', 'Root cause']);
  if (showAction) head.push('Action Plan');
  var th = head.map(function(h) {
    var align = (h === 'Failed' || h === 'Fail %') ? 'right' : (h === 'Action Plan' ? 'center' : 'left');
    return '<th style="background:' + THEME.primary + ';color:#fff;padding:9px 12px;text-align:' + align + ';font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">' + h + '</th>';
  }).join('');
  var rows = vendors.map(function(v, i) {
    var bg = i % 2 === 0 ? '#ffffff' : THEME.primaryBg;
    var clusterCell = showCluster ? '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.clusterName || '') + '</td>' : '';
    var actionCell = '';
    if (showAction) {
      var link = (v.vendorId && typeof buildActionFormUrl_ === 'function')
        ? buildActionFormUrl_(v.vendorId, v.runDate || getCairoDate(0))
        : '';
      actionCell = '<td style="padding:8px 10px;border-bottom:1px solid #F0E9E1;text-align:center;">' +
        (link ? '<a href="' + link + '" style="display:inline-block;padding:7px 14px;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;color:#ffffff;background:' + THEME.primary + ';border-radius:6px;text-decoration:none;white-space:nowrap;">Log Plan &rarr;</a>' : '&mdash;') +
        '</td>';
    }
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';font-weight:600;">' + esc_(v.vendor) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.muted + ';">' + esc_(v.city) + '</td>' +
      clusterCell +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';font-weight:700;">' + formatNumber_(v.failedOrders) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;text-align:right;color:' + THEME.critical + ';">' + v.failRate + '%</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #F0E9E1;font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.burgundy + ';">' + esc_(v.rootCause || '&mdash;') + '</td>' +
      actionCell +
      '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;"><tr>' + th + '</tr>' + rows + '</table>';
}

// ---------------- 2) TUESDAY -> TEAM LEADER ----------------
