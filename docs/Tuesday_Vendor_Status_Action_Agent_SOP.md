# Tuesday Vendor-Status Action Agent — SOP (v1.0, July 2026)

Automated weekly workflow that reviews need-action vendors in the **Vendor Action Tracker**
and applies a temporary branch status on the talabat restaurant-management portal via the
Chrome (Claude in Chrome) agent.

## When it runs
Every **Tuesday 11:00 (Africa/Cairo)**, after the daily 09:00 refresh and the 10:00 Tuesday report.
Runs only while the Claude desktop app is open and Chrome is signed in to `portal.talabat.com`.

## Prerequisites
- Chrome open and logged in to the talabat portal (Work profile).
- Tracker columns present (added by `ActionTool.setupActionColumns`):
  - **AF Chain ID** — needed for the portal URL (`restaurants/{Chain ID}`).
  - **AG Requested Action** — free text: `Status | Reason | Duration` (see vocab below).
  - **AH Last Portal Status (found/set)** — written back by the agent + timestamp.
  - **AI Action Duration** — time period applied (default `15 mins`).

## Need-action rule (which vendors qualify)
A tracker row qualifies when **both**:
1. **Risk Level** (col U) is `CRITICAL` or `HIGH`, **and**
2. **VFR** = Net Fail Rate % (col O) **>= 40%**.

Safety gate: the agent only *executes* a portal change on qualifying rows that also have a
non-empty **Requested Action (AG)**. Qualifying rows with a blank AG are reported back for
Adham to fill — nothing is changed on the portal without an explicit Requested Action.

> Threshold note: 40% VFR is a deliberately high bar; on current data very few vendors hit it.
> Tune `VFR_ACTION_THRESHOLD` in `ActionTool.gs` if the queue is too narrow/wide.

## Portal reference (from the Branch status page)
URL pattern: `https://portal.talabat.com/eg/p/restaurant-management#/restaurants/{Chain ID}/branches/{Vendor ID}/status`
(Restaurants = Chain ID, Branches = Vendor ID. If Chain ID is unknown, it falls back to Vendor ID.)

- **Status:** Busy · Closed · Hidden
- **Reason:** Courier Delayed at pickup · No drivers · Kitchen is too busy · Updating menu ·
  Technical issue · Too Many Rejected Orders · Bad weather · Prayer · Lockdown · Closed · Other
- **Time Period:** 15 mins (always)

## Requested Action format (col AG)
`Status | Reason | Duration` — e.g. `Busy | No drivers | 15 mins`, `Hidden | Technical issue | 15 mins`.
Duration defaults to `15 mins` if omitted.

## Agent steps (per qualifying + executable vendor)
1. Read Vendor ID (B), Chain ID (AF), Requested Action (AG) from the tracker.
2. Navigate to the branch-status URL.
3. Read the **Current status / Current reason** shown on the page.
   - **If the vendor is permanently Busy → SKIP.** Log `Found permanent Busy — skipped` to AH. Do not change anything.
4. Otherwise set Status + Reason from Requested Action, Time Period = 15 mins, click **SAVE**.
5. Write back to the tracker:
   - **AH Last Portal Status** = what was set/found + timestamp, e.g. `Set Busy (No drivers) @ 2026-07-14 11:07`.
   - **AI Action Duration** = `15 mins`.
6. Never touch vendors that don't qualify, and never change a status without a Requested Action.

## After the run
Post a short summary (vendors reviewed, changed, skipped-permanent, awaiting Requested Action)
and, if any qualifying rows had no Requested Action, list them for Adham.

## Related Apps Script functions (`ActionTool.gs`)
- `setupActionModule()` — one-shot: create columns + back-fill Chain IDs.
- `refreshChainIds()` — fill Chain ID from feeders by Vendor ID.
- `getNeedActionQueue()` / `logNeedActionQueue()` — list qualifying vendors + portal URLs.
- `logPortalAction(vendorId, statusText, duration)` — write AH/AI for a vendor.
