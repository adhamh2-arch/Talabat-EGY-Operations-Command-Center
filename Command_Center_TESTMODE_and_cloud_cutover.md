# Command Center — TEST-mode switch + cloud cutover (July 2026)

Two changes, both done from the **Apps Script editor** (I can't push these via API — the
connector has no executable deployment, and `update_script_content` is replace-all and has
deleted files before, so pasting is the safe channel).

Goal:
- **Daily + Monday** run fully on Google's cloud (no laptop, no approvals) via Apps Script triggers.
- **Sunday stays in Cowork** (the Looker WoW weekly — Apps Script can't call Looker).
- A **TEST-mode switch** in the 🟠 Command Center menu so you flip real-vs-test emails without editing code. Defaults to **ON** (safe) — nothing reaches real recipients until you go live.

---

## Edit 1 — `Config.gs`  (APPEND these two functions at the end of the file)

```javascript
// ===== TEST MODE SWITCH =====
// When ON, every workflow email is redirected to ALERT_EMAIL with a
// "[TEST -> original]" subject and no CC. Toggle from the 🟠 Command Center menu.
// Defaults to ON (safe) until you explicitly GO LIVE.
function isTestMode() {
  var v = PropertiesService.getScriptProperties().getProperty('TEST_MODE');
  return v === null ? true : (v === 'true');
}
function setTestMode_(on) {
  PropertiesService.getScriptProperties().setProperty('TEST_MODE', on ? 'true' : 'false');
}
```

---

## Edit 2 — `EmailSender.gs`  (replace ONE line inside `sendEmail_`)

Find:

```javascript
function sendEmail_(to, content) {
  var redirect = __TEST_REDIRECT;
```

Replace the `var redirect` line with:

```javascript
function sendEmail_(to, content) {
  var redirect = __TEST_REDIRECT || (isTestMode() ? ALERT_EMAIL : null);
```

That's the whole behavioral change — every stage (`sendDailyCriticalAlerts`,
`sendTuesdayLeaderReports`, `sendSundayWeeklyReports`, `sendMondayEscalations`) already routes
through `sendEmail_`, so they all honor the switch automatically.

---

## Edit 3 — `Main.gs`  (two changes)

### 3a. Add menu items — in `onOpen()`, add this block before the `⏰ Enable All Triggers` line:

```javascript
    .addSeparator()
    .addItem('🧪 Email mode — show current', 'showEmailMode')
    .addItem('   ↳ Switch to TEST (emails to me only)', 'enableTestMode')
    .addItem('   ↳ GO LIVE (emails to real recipients)', 'disableTestMode')
```

### 3b. Add these three functions anywhere in `Main.gs`:

```javascript
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
```

### 3c. Replace `setupWeeklyTriggers()` so it installs ONLY daily + Monday (Sunday stays Cowork/Looker):

```javascript
function setupWeeklyTriggers() {
  removeAllTriggers();
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(9).nearMinute(0).inTimezone('Africa/Cairo').create();
  ScriptApp.newTrigger('mondayEscalation').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).nearMinute(0).inTimezone('Africa/Cairo').create();
  Logger.log('Triggers set: dailyRun 09:00 daily · mondayEscalation 10:00 Mon (Africa/Cairo). ' +
             'Sunday weekly stays in Cowork (Looker). Tuesday leader report left off — ' +
             'add tuesdayReport / sundayReport triggers here later if you want them on cloud too.');
}
```

> If you'd rather keep the Apps Script Tuesday leader report and Sunday feeder report on cloud too,
> keep the original 4-line version instead — but then TEST mode should stay ON for Sunday so it
> doesn't compete with the Cowork Looker weekly to Team Leaders.

---

## After pasting — one-time steps (from the editor Run menu / 🟠 menu)

1. **Reload the spreadsheet** so the new 🟠 Command Center menu items appear.
2. `🧪 Email mode — show current` → confirm it says **TEST mode is ON**.
3. **🟠 Command Center → Enable All Triggers** (`setupWeeklyTriggers`) — authorize once when prompted.
   This installs the daily + Monday cloud triggers. They now run on Google's servers with **zero
   approvals and no laptop needed**.
4. `▶ Run Daily Pipeline Now` once to smoke-test — every email lands in **adham.h.2@talabat.com**
   while TEST mode is on. Check it looks right.
5. When you're happy: **🟠 Command Center → GO LIVE**. From then on, daily critical alerts go to
   AMs and Monday escalations to Team Leaders, FROM/CC exp.eg@talabat.com.

## What stays in Cowork (needs your machine)
- **Sunday Looker weekly** — the rich WoW analysis; can't run serverless.
- **Monday response-check** — reads replies to the Sunday Looker emails.
- **Tuesday portal action agent** — Chrome-driven; portal has no API. Already set to run unattended;
  click **Run now** once and approve its tools so future runs don't pause on permissions.

## Heads-up: what the cloud daily does NOT do (that the Cowork daily-ops did)
The Apps Script `dailyRun` updates the Vendor Action Tracker + sends critical AM emails. It does
**not** produce the Drive CSV export, the `master_tracker.json` history, or the Gmail
reply-classification that the Cowork `talabat-egy-daily-ops` task does. Decide whether you still
want those — if yes, keep the Cowork daily task enabled alongside (it only creates drafts, so no
duplicate sends); if not, disable it and I'll remove it.
