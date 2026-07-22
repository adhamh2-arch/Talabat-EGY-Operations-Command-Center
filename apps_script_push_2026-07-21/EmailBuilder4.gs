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
