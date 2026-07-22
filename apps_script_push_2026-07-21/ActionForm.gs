/**
 * ActionForm.gs — talabat-themed Action Plan submission form (Web App, added July 2026).
 * Lets an AM open a per-vendor link from the "Daily monitoring" email and log a root cause
 * + free-text action plan. On submit:
 *   AC (Action Plan Shared, col 29) = 'Yes'
 *   AD (Action Plan Details, col 30) = 'Root cause: <cause> — Plan: <text>'
 * If the AM never opens/submits it, AC stays 'No' (TrackerWriter.gs seeds every new row
 * with 'No', not blank).
 *
 * Row lookup: matches Vendor ID (col B) + Run Date (col A) from the URL (?vid=&rd=).
 * Falls back to the most recent row for that Vendor ID if rd is missing or doesn't match
 * exactly — tracker rows are written newest-first (see TrackerWriter.gs), so "topmost
 * match" is "most recent occurrence", the same tolerance ActionTool.logPortalAction
 * already relies on elsewhere in this project.
 *
 * Deployed as a Web App (appsscript.json "webapp": executeAs USER_DEPLOYING, access
 * DOMAIN) so it runs with Adham's Sheet permissions regardless of the AM's own access,
 * restricted to talabat.com accounts. Uses globals already defined elsewhere in this
 * project (EMAIL_FONT / THEME / esc_ / SPREADSHEET_ID / SHEET_NAMES / ROOT_CAUSE_OPTIONS /
 * ACTION_FORM_URL from Config.gs / EmailBuilder.gs / EmailBuilder4.gs) — no new OAuth
 * scope required.
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var vid = String(p.vid || '').trim();
  var rd = String(p.rd || '').trim();

  if (!vid) {
    return actionFormPage_({ error: 'Missing vendor reference — please open this link from a Command Center email rather than typing the URL directly.' });
  }

  var row = findTrackerRow_(vid, rd);
  if (!row) {
    return actionFormPage_({ error: 'Could not find this vendor on the tracker right now. Please reach out to the Ops team (exp.eg@talabat.com) and we will log it manually.' });
  }
  return actionFormPage_({ row: row });
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  var vid = String(p.vid || '').trim();
  var rd = String(p.rd || '').trim();
  var cause = String(p.cause || '').trim();
  var plan = String(p.plan || '').trim();

  var row = findTrackerRow_(vid, rd);
  if (!row) {
    return actionFormPage_({ error: 'Could not find this vendor on the tracker right now. Please reach out to the Ops team (exp.eg@talabat.com) and we will log it manually.' });
  }
  if (!plan) {
    return actionFormPage_({ row: row, error: 'Please add a few words on the action plan before submitting.' });
  }
  if (ROOT_CAUSE_OPTIONS.indexOf(cause) === -1) cause = 'Other';

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  var details = 'Root cause: ' + cause + ' — Plan: ' + plan;
  sheet.getRange(row.sheetRow, 29).setValue('Yes');    // AC — Action Plan Shared
  sheet.getRange(row.sheetRow, 30).setValue(details);  // AD — Action Plan Details

  return actionFormPage_({ done: true, row: row });
}

// Finds the tracker row for this vendor: exact Vendor ID + Run Date match preferred;
// falls back to the most recent (topmost) row for that Vendor ID otherwise.
function findTrackerRow_(vendorId, runDate) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAMES.vendorTracker);
  if (!sheet) return null;
  var last = sheet.getLastRow();
  if (last < 2) return null;

  var data = sheet.getRange(2, 1, last - 1, 4).getValues(); // A Run Date, B Vendor ID, C Vendor Name, D City
  var vid = String(vendorId || '').trim();
  if (!vid) return null;
  var fallback = null;
  for (var i = 0; i < data.length; i++) {
    var thisVid = String(data[i][1] || '').trim();
    if (thisVid !== vid) continue;
    var thisDate = (data[i][0] instanceof Date) ? Utilities.formatDate(data[i][0], 'Africa/Cairo', 'yyyy-MM-dd') : String(data[i][0]).trim();
    var candidate = { sheetRow: i + 2, runDate: thisDate, vendorId: thisVid, vendorName: String(data[i][2] || ''), city: String(data[i][3] || '') };
    if (runDate && thisDate === runDate) return candidate; // exact match — best case
    if (!fallback) fallback = candidate;                    // newest match (topmost row wins)
  }
  return fallback;
}

function actionFormPage_(opts) {
  opts = opts || {};
  var inner;

  if (opts.done) {
    inner =
      '<div style="text-align:center;padding:30px 10px;">' +
      '<div style="font-size:38px;line-height:1;">&#9989;</div>' +
      '<h2 style="font-family:' + EMAIL_FONT + ';color:' + THEME.burgundy + ';margin:14px 0 6px 0;font-size:19px;">Thanks &mdash; saved.</h2>' +
      '<p style="font-family:' + EMAIL_FONT + ';color:' + THEME.muted + ';font-size:13px;margin:0;">' +
      (opts.row ? esc_(opts.row.vendorName) + '&rsquo;s action plan is logged on the tracker.' : 'Logged on the tracker.') +
      '</p></div>';
  } else if (opts.error && !opts.row) {
    inner =
      '<div style="text-align:center;padding:30px 10px;">' +
      '<div style="font-size:38px;line-height:1;">&#9888;</div>' +
      '<h2 style="font-family:' + EMAIL_FONT + ';color:' + THEME.burgundy + ';margin:14px 0 6px 0;font-size:16px;">' + esc_(opts.error) + '</h2>' +
      '</div>';
  } else {
    var row = opts.row;
    var options = ROOT_CAUSE_OPTIONS.map(function(o) {
      return '<option value="' + esc_(o) + '">' + esc_(o) + '</option>';
    }).join('');
    inner =
      '<h2 style="font-family:' + EMAIL_FONT + ';color:' + THEME.burgundy + ';margin:0 0 3px 0;font-size:18px;">' + esc_(row.vendorName) + '</h2>' +
      '<p style="font-family:' + EMAIL_FONT + ';color:' + THEME.muted + ';font-size:12px;margin:0 0 22px 0;">' + esc_(row.city) + ' &middot; ' + esc_(row.runDate) + '</p>' +
      (opts.error ? '<p style="font-family:' + EMAIL_FONT + ';color:' + THEME.critical + ';font-size:12px;margin:0 0 14px 0;">' + esc_(opts.error) + '</p>' : '') +
      '<form method="post" action="' + esc_(ACTION_FORM_URL || '') + '">' +
      '<input type="hidden" name="vid" value="' + esc_(row.vendorId) + '">' +
      '<input type="hidden" name="rd" value="' + esc_(row.runDate) + '">' +
      '<label style="display:block;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;color:' + THEME.primary + ';text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Root cause</label>' +
      '<select name="cause" required style="width:100%;padding:10px;border:1px solid #E0D8CE;border-radius:8px;font-family:' + EMAIL_FONT + ';font-size:14px;margin:0 0 18px 0;background:#fff;box-sizing:border-box;">' +
      '<option value="">Select one&hellip;</option>' + options +
      '</select>' +
      '<label style="display:block;font-family:' + EMAIL_FONT + ';font-size:11px;font-weight:700;color:' + THEME.primary + ';text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Action plan</label>' +
      '<textarea name="plan" required rows="5" placeholder="What are you doing with the vendor to fix this?" style="width:100%;padding:10px;border:1px solid #E0D8CE;border-radius:8px;font-family:' + EMAIL_FONT + ';font-size:14px;margin:0 0 20px 0;box-sizing:border-box;resize:vertical;"></textarea>' +
      '<button type="submit" style="width:100%;background:' + THEME.primary + ';color:#ffffff;border:none;padding:13px 20px;border-radius:8px;font-family:' + EMAIL_FONT + ';font-size:14px;font-weight:700;cursor:pointer;">Submit &rarr;</button>' +
      '</form>';
  }

  var shell =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + THEME.cream + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + THEME.cream + ';padding:28px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(65,21,23,0.08);">' +
    '<tr><td style="background:' + THEME.primary + ';padding:22px 28px;">' +
    '<div style="font-family:' + EMAIL_FONT + ';font-size:23px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">talabat</div>' +
    '<div style="font-family:' + EMAIL_FONT + ';font-size:12px;color:' + THEME.lime + ';font-weight:600;margin-top:4px;">Action Plan &middot; EGY Expansion Operations</div>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 28px 30px 28px;">' + inner + '</td></tr>' +
    '</table></td></tr></table></body></html>';

  return HtmlService.createHtmlOutput(shell)
    .setTitle('talabat — Action Plan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
