# Command Center v5.1 — deploy guide (July 2026)

## Current LIVE state (already pushed via API, verified)
These 4 files are already correct on the live Apps Script project — **no action needed**:
`appsscript` · `Config` · `DataReader` · `ActionTool`
(They restore the earlier `CONFIG_PENDING` mishap and add the vendor-status action tool + the
new feeder column mapping: L Chain name, M Chain ID, N Order date → net orders now index 14.)

## To finish the rebuild — paste these 6 files into the Apps Script editor
The live project is missing the 6 automation files (deleted in the 2026-07-08 push). Paste each:

| Editor file | Paste FROM | Notes |
|---|---|---|
| `ScoringEngine` | `apps_script_v5_1/ScoringEngine.gs` | rebuilt; topOffenders now carry Is Key/TGO/Food + Chain ID |
| `TrackerWriter` | `apps_script_v5_1/TrackerWriter.gs` | **rewritten to the 31-col live schema**; never wipes existing data; leaves action cols AF–AI to ActionTool |
| `SheetsWriter` | `apps_script_v5_1/SheetsWriter.gs` | unchanged logic, clean copy |
| `EmailSender` | `apps_script_v5_1/EmailSender.gs` | unchanged logic, clean copy |
| `Main` | `apps_script_v5_1/Main.gs` | rebuilt; dailyRun now also calls `refreshChainIds()` |
| `EmailBuilder` | **`apps_script/EmailBuilder.gs`** (the original folder) | ~500-line email templates, unchanged — paste the pristine original |

> Why EmailBuilder comes from the other folder: it's large and unchanged, so the safest copy is
> your existing original rather than a regenerated one.

## One-time setup after pasting
Run these once from the editor (Run menu). They will prompt for authorization the first time:
1. `setupActionModule()` — creates tracker columns **AF Chain ID · AG Requested Action · AH Last Portal Status · AI Action Duration** and back-fills Chain ID from the feeders.
2. `setupWeeklyTriggers()` — installs the automated triggers: dailyRun 09:00 daily · tuesdayReport 10:00 Tue · sundayReport 10:00 Sun · mondayEscalation 10:00 Mon (Africa/Cairo).
3. (optional) `runFullTestToMe()` — runs the full pipeline but redirects every email to adham.h.2@talabat.com so you can preview safely. **Ask before sending real emails.**

## Notes
- `update_script_content` (API push) is REPLACE-ALL and unreliable for the full ~65 KB project from
  the assistant side (EmailBuilder alone has 200+ escaped quotes). Paste is the reliable channel.
- The Tuesday portal action agent (Chrome MCP) is independent of these 6 files — it only needs
  `ActionTool` (live) + the tracker columns. See `docs/Tuesday_Vendor_Status_Action_Agent_SOP.md`.
