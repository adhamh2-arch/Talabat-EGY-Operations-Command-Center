# Vendor-Status Action Agent — SOP (v1.3, July 2026)

Automated workflow that reviews need-action vendors in the **Vendor Action Tracker**,
applies a temporary branch status on the talabat restaurant-management portal via the
Chrome (Claude in Chrome) agent, and emails each Account Manager directly via Gmail for
vendors it actually set to Hidden that run. (Filename/name kept for history — this now
runs **daily**, not just Tuesdays.)

## When it runs
Every **day at 17:00 (Africa/Cairo)**, after the daily 09:00 refresh.
Runs only while the Claude desktop app is open and Chrome is signed in to `portal.talabat.com`.

## Prerequisites
- Chrome open and logged in to the talabat portal (Work profile).
- Tracker columns present (added by `ActionTool.setupActionColumns`):
  - **AF Chain ID** — needed for the portal URL (`restaurants/{Chain ID}`).
  - **AG Requested Action (auto)** — auto-computed spreadsheet formula, never edited by hand.
  - **AH Last Seen Status (found)** — written back by the agent + timestamp.
  - **AI Action Taken (set)** — written back by the agent + timestamp.

## Need-action rule (which vendors qualify)
A tracker row qualifies when Net Fail Rate % (col O, VFR) is **40%–100% inclusive**,
the vendor is **not** a Key Account (col I = No), and **is** a food vendor (col K = Yes).

AG (Requested Action) is a live spreadsheet formula, not a judgment call for the agent —
it already encodes the only two approved actions:
- **AG = "Hidden | TOO_MANY_REJECTED_ORDERS"** → act: hide the vendor for this reason.
- **AG = "Open"** → an Action Plan was shared (col AC) → restore/keep active, don't hide.
- **AG blank** → below threshold, no action.

> Threshold note: 40% VFR is a deliberately high bar; tune `VFR_ACTION_THRESHOLD` in
> `ActionTool.gs` if the queue is too narrow/wide.

## Portal reference (from the Branch status page)
URL pattern: `https://portal.talabat.com/eg/p/restaurant-management#/restaurants/{Chain ID}/branches/{Vendor ID}/status`
(Restaurants = Chain ID, Branches = Vendor ID. If Chain ID is unknown, it falls back to Vendor ID.)

**Approved status/reason vocab — the only two permitted actions:**
- **Open** — restore to active (no reason).
- **Hidden** + reason **TOO_MANY_REJECTED_ORDERS** — the corrective action.

Never set any other status or reason.

## Agent steps (per queued vendor, one at a time — never batch)
1. Navigate to the branch-status URL from Chain ID + Vendor ID.
2. Read the current status/reason. Write it to **AH** as `<current status/reason> @ <timestamp>` — always, even if nothing changes.
3. **If the vendor is already on permanent Busy → SKIP.** Write **AI** = `Skipped — permanent Busy @ <timestamp>`. Change nothing.
4. Otherwise read AG and act:
   - `Hidden | TOO_MANY_REJECTED_ORDERS` → set Status = Hidden, Reason = TOO_MANY_REJECTED_ORDERS, SAVE. Write **AI** = `Set Hidden (TOO_MANY_REJECTED_ORDERS) @ <timestamp>`.
   - `Open` → if currently Hidden by us, restore to Open and write **AI** = `Restored to Open — action plan shared; recheck next cycle @ <timestamp>`; otherwise leave as-is and write **AI** = `Left active — action plan shared; act next cycle @ <timestamp>`.
   - blank → write **AI** = `No action (VFR below threshold) @ <timestamp>`.
5. Never touch vendors that don't qualify, and never set a status the auto AG formula didn't ask for.

## After the run
1. Post a concise summary (reviewed / set-to-Hidden / deferred / skipped-permanent / no-action / AM emails sent).
2. **Email the AMs — directly, not via Apps Script (changed 2026-07-21).** `run_script_function` 404s on this project (manifest has no `executionApi` block + the script is still on a default GCP project — see the `script-execution-api-404` memory; the real fix needs a human in the Apps Script editor). Until that's fixed, the agent builds the same branded "Daily monitoring" email itself and sends it with the Gmail MCP tool (`send_gmail_message`, from `exp.eg@talabat.com`, cc `exp.eg@talabat.com`), then stamps **X** (Alert Sent = `Yes`) and **Y** (Alert Date = today) on each emailed vendor's row with the Sheets MCP tool (`modify_sheet_values`) — no Apps Script call either way. Same filter as before: only vendors whose **AI** starts with `Set Hidden`, grouped by AM Email (col G); no email goes out if nothing was set to Hidden this run. The exact HTML template and field mapping live in the agent's own prompt (SKILL.md) so there's a single source of truth for the markup.

## Action Plan form (added 2026-07-21)
The daily AM email's offender table now has a per-vendor **Log Plan** button instead of just
one generic tracker link. Each button opens a talabat-themed web form
(`https://script.google.com/a/macros/talabat.com/s/AKfycby3tXMiwtH6MIdPu19IFDbuLIr4GwIEaATXIUj_FbosM-8Ax6UZh_oTx5BNN8PX-dqF/exec?vid={Vendor ID}&rd={Run Date}`,
restricted to talabat.com accounts) where the AM picks a root cause and types the plan. On
submit it writes directly to that vendor's tracker row: **AC** (Action Plan Shared) = `Yes`,
**AD** (Action Plan Details) = `Root cause: <cause> — Plan: <text>`. If the AM never opens or
submits it, AC stays `No` (TrackerWriter now seeds every new row with `No`, not blank).
This is served by the Apps Script Web App `ActionForm.gs` (script
`1D4-BaNKBH6dybOG21neMZZxtJXRryp7yuPnE6yt6hhsDwkzI6JVJvb_7`), matching the row by Vendor ID
+ Run Date (falls back to the most recent row for that Vendor ID). AG's auto formula already
reads AC, so a submitted plan flips a 40%+ VFR vendor's Requested Action to "Open" (defer)
on the next run. The agent's own STEP 5 builds one link per vendor (never reuses a link
across vendors in the same email) — see RESOURCES / STEP 5 in the prompt for the exact
pattern.

## Related Apps Script functions
- `setupActionModule()` (`ActionTool.gs`) — one-shot: create columns + back-fill Chain IDs.
- `refreshChainIds()` — fill Chain ID from feeders by Vendor ID (also runs automatically at the end of every `dailyRun()`).
- `getNeedActionQueue()` / `logNeedActionQueue()` — list qualifying vendors + portal URLs.
- `logPortalAction(vendorId, foundStatus, setStatus)` — writes AH/AI for a vendor. **Fixed July 2026**: the tracker writes newest-first (today's rows at the top), so this now scans top-down to update *today's* row for a vendor — it used to scan bottom-up and could land on that vendor's oldest historical row instead, which would have silently broken step "After the run" above.
- `sendActionedVendorEmails()` (`EmailSender.gs`) — no longer called by this agent (was STEP 5, until the `run_script_function` 404 was confirmed 2026-07-20/21 — see `script-execution-api-404` memory). Left in place untouched as a manual/rollback option from the Sheets menu once the Apps Script Execution API is actually fixed (Part A + Part B in that memory); STEP 5 could switch back to calling it at that point instead of sending via Gmail MCP directly. Still not called by `dailyRun()` either.

## Do NOT automate `prepareTakeAction()`
`prepareTakeAction()` (menu: 🎯 Take Action) calls `SpreadsheetApp.getUi().alert(...)` — a UI
dialog. It only works when a person clicks it from the Sheets menu; it throws an error if
called from any installable trigger (time-based, on-edit, or on-change), because triggers
run without a live UI session to attach to. It's a manual preview tool for Adham, not part
of the automated pipeline — the agent above reads the queue itself and never calls it.

## Note on this doc
This SOP previously described an older vocab (`Busy`/`Closed`/`Hidden` with a reason picklist
and a 15-minute time period). The live agent only ever uses **Open** or **Hidden + TOO_MANY_REJECTED_ORDERS**,
per `ActionTool.gs`'s `APPROVED_ACTION` / `RESTORE_ACTION` constants — this revision brings the doc back in sync with what actually runs.

**2026-07-21 update:** STEP 5 (AM email) no longer calls Apps Script at all. `run_script_function`
was confirmed 404ing on this project (missing `executionApi` manifest block + script still on a
default GCP project — a human-only fix, see the `script-execution-api-404` memory). The agent now
builds the same branded email and sends it directly via the Gmail MCP tool, and stamps tracker
columns X/Y directly via the Sheets MCP tool, instead of going through `sendActionedVendorEmails()`.
This was confirmed to have actually cost one AM notification on 2026-07-20 (Beshoy Makary /
AL SAYYIDA ZEINAB RESTAURANT, hidden on the portal but never emailed, and X/Y never stamped)
before this change — see the tracker row and the memory for the full trace.
