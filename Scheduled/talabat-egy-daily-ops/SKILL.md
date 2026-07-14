---
name: talabat-egy-daily-ops
description: talabat Egypt daily operations pipeline — runs at 9 AM, scores clusters, upserts the Master Tracker, fires alerts, creates Gmail drafts, and uploads exports to Google Drive.
---

Run the talabat Egypt daily operations monitoring pipeline. The Master Tracker (`tracker/master_tracker.json`) is the single source of truth — never create a new tracker or historical file. Everything syncs to Google Drive for stakeholder visibility.

## Google Workspace IDs (do not hardcode elsewhere)
- Feed Sheet (input):        1W_4kxTBPa6OzZYcjf3_1tXRNH1YUwzZXBnZBFcZyFys
- Reports Folder:            1tkWLKX7brov3GgFV_dA6V-Hfi8K25zOG
- Root Folder:               1k__0J3WU317cuVXsnGrfqQMbP0MNavDq
- Pipeline folder:           C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1

The Master Tracker Sheet ID is stored at runtime in:
  config/agents.config.json → googleWorkspace.masterTrackerSheetId
(Updated each run after upload. Adham's bookmark: open that sheet URL from the daily report.)

## Step-by-step

### 1. Get today's date
Compute YYYY-MM-DD for today (use bash: `date +%Y-%m-%d`). Use this string in every filename and Drive title below.

### 2. Read the feed from Google Sheets (Google Drive MCP)
Call: mcp__bd165437-ca6e-4c7e-b958-528a192c1f95__read_file_content
  fileId: "1W_4kxTBPa6OzZYcjf3_1tXRNH1YUwzZXBnZBFcZyFys"

The result is large and will overflow context — it will be saved to a tool-results file automatically.
Copy the tool-results file to the expected path:
  C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\mcp_data\sheet_raw_YYYY-MM-DD.json

The file must be JSON with schema: { "fileContent": "<full text>" }

### 3. Parse the feed (Node.js)
Run:
  node "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\parse_sheet_feed.js" \
       "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\mcp_data\sheet_raw_YYYY-MM-DD.json" \
       YYYY-MM-DD

This produces: mcp_data/cluster_data_YYYY-MM-DD.json

If this fails (sheet empty, format mismatch, or truncated JSON):
  node "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\generate_data.js" YYYY-MM-DD
Note the fallback in the final summary.
If cluster_data_YYYY-MM-DD.json already exists and can't be deleted (permissions), proceed — the existing file will be used.

### 4. Run the 10-step pipeline (Node.js)
Run:
  node "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\run_pipeline.js" YYYY-MM-DD

Steps: validate config → check data → score clusters → check Gmail monitor →
       upsert master tracker → generate recommendations → fire alerts →
       prepare export → validate results → generate report

All outputs land in mcp_data/, tracker/, and logs/ locally.

If the pipeline crashes with "Unterminated string in JSON" or similar config error, the
config/agents.config.json may be truncated. Repair it:
  python3 -c "
  with open('config/agents.config.json') as f: c = f.read()
  idx = c.rfind(',\n\n  \"qua')
  if idx == -1: idx = max(c.rfind('},\n\n  \"'), c.rfind('\n}\n'))
  import json; json.loads(c[:idx] + '\n}\n')  # verify
  open('config/agents.config.json','w').write(c[:idx] + '\n}\n')
  print('Repaired')
  "
Then re-run the pipeline.

### 5. Check Gmail for responses (Gmail MCP) — non-blocking
Read: C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\mcp_data\gmail_monitor_payload_YYYY-MM-DD.json

For each thread in `pendingThreads`:
  Call: mcp__7ab50cc4-62ec-4940-8f38-1f9e841b28a7__get_thread
    threadId: thread.thread_id

For each reply found (messages after the original send date):
  Classify the response:
    - Has "thank you" / "acknowledged" / "received" → "Acknowledged"
    - Has "action plan" / "will fix" / "working on" → "Action Plan Shared"
    - Has "please clarify" / "more info" / "can you share" → "Information Requested"
    - Has "no issue" / "disagree" / "not correct" → "Disputed Findings"
    - Has "nothing" / "no plan" → "No Action Planned"
    - No reply → leave unchanged

  Apply each response:
    node "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\step_gmail_monitor.js" \
         --apply-response \
         --thread-id "<thread_id>" \
         --vendor-key "<vendor_key>" \
         --classification "<classification>" \
         --summary "<one sentence summary>" \
         --date "YYYY-MM-DD"

If no pending threads exist (pendingThreads is empty or file missing), skip this step.

### 6. Upload Master Tracker export to Google Drive (Google Drive MCP)
Read the export CSV:
  C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\mcp_data\master_tracker_export_YYYY-MM-DD.csv

Call: mcp__bd165437-ca6e-4c7e-b958-528a192c1f95__create_file
  title: "Master Tracker — talabat EGY Ops"
  parentId: "1k__0J3WU317cuVXsnGrfqQMbP0MNavDq"
  contentMimeType: "text/csv"
  textContent: <full CSV content>

Save the returned file ID. Update the config:
  python3 -c "
  import json
  with open('config/agents.config.json') as f: c = json.load(f)
  c['googleWorkspace']['masterTrackerSheetId'] = '<NEW_FILE_ID>'
  with open('config/agents.config.json','w') as f: json.dump(c, f, indent=2)
  # Verify valid JSON
  with open('config/agents.config.json') as f: json.load(f)
  print('Config updated')
  "

### 7. Upload daily report to Google Drive (Google Drive MCP)
Read the HTML report:
  C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\logs\report_YYYY-MM-DD.html

Call: mcp__bd165437-ca6e-4c7e-b958-528a192c1f95__create_file
  title: "Daily Ops Report — YYYY-MM-DD"
  parentId: "1tkWLKX7brov3GgFV_dA6V-Hfi8K25zOG"
  contentMimeType: "text/html"
  disableConversionToGoogleType: true
  textContent: <full HTML content>

### 8. Create Gmail alert drafts (Gmail MCP)
Read: C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\mcp_data\pending_drafts_YYYY-MM-DD.json

Check `send_mode` field:
  - send_mode: false → create drafts (Adham reviews before sending)
  - send_mode: true → send directly (set alerting.sendMode=true in config to enable)

For each draft in the drafts array:
  Call: mcp__7ab50cc4-62ec-4940-8f38-1f9e841b28a7__create_draft
    to: [draft.to]  (must be array)
    subject: draft.subject
    htmlBody: draft.body_html

  After creating each draft, record that emails were prepared (thread IDs are not available
  for drafts — they are assigned when the email is actually sent by Adham).

If send_mode is true:
  Use mcp__7ab50cc4-62ec-4940-8f38-1f9e841b28a7__send_message (if available) instead.
  After sending, call:
    node "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1\step_fire_alerts.js" \
         --mark-sent \
         --vendor-keys "<comma-separated keys from draft.vendor_keys>" \
         --thread-id "<returned message thread ID>" \
         --recipient "<draft.to>" \
         --date "YYYY-MM-DD"

### 9. Final summary
Report back:
- Date
- Pipeline status (all 10 steps pass/fail)
- Master Tracker: total active cases, new today, emails required
- Clusters above target and their fail rates
- Top recurring offenders (Critical/High severity)
- Improvement status breakdown (Improving / Stable / Deteriorating)
- Gmail drafts created (or emails sent if send_mode=true)
- Pending Gmail responses being monitored
- Google Drive links: Master Tracker URL and today's report URL
- Any fallbacks used (generate_data fallback, config repair, etc.)

## Notes
- The Master Tracker (`tracker/master_tracker.json`) is the canonical source of truth. NEVER delete it.
- `tracker/history.jsonl` is append-only. NEVER delete or truncate it.
- alerting.testMode in agents.config.json: true → all emails route to adham.h.2@talabat.com with [TEST] prefix
- alerting.sendMode: false (default) → create drafts; true → send immediately after Adham approves pipeline
- If run_pipeline.js steps 7/8 (alerts/export) fail, the pipeline can still continue — those are non-blocking
- config/agents.config.json must always be valid JSON after each write. Always verify after updating.
- The Master Tracker export is a VIEW — stakeholders read it in Drive. Manual edits to response/action
  fields should be made via the Cowork artifact or by asking Claude to update specific vendor records.