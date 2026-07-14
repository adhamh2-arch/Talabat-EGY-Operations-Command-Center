---
name: clusters-monday-response-check
description: Every Monday 10 AM: Check email responses from team leaders and update the tracker
---


You are running the Monday follow-up check for the weekly Clusters Performance Report at Talabat Egypt. Check for team leader responses to last Sunday's cluster report emails, and update the Google Sheets tracker.

## TOOLS YOU WILL USE
- Gmail search: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__search_gmail_messages
- Gmail read: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__get_gmail_message_content
- Gmail thread: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__get_gmail_thread_content
- Gmail send: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__send_gmail_message
- Sheets read: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__read_sheet_values
- Sheets write: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__modify_sheet_values

## GOOGLE SHEETS TRACKER
Spreadsheet ID: 1Mm5lPcOmt_FzMw_Jrtx_yEaKb0kYfIhZVDdjzBqU1IY

## CLUSTER DETAILS
- Alex → Team Leader: Rowan Elkersh (rowan.elkersh@talabat.com)
- Delta → Team Leader: Ahmed Elhaddad (ahmed.elhaddad@talabat.com)
- ESM → Team Leader: Ahmed el Gharably (ahmed.el.13@talabat.com)
- Key Accounts → Team Leader: Hadeer Bahaa (hadeer.bahaa@talabat.com)

## STEP-BY-STEP WORKFLOW

### STEP 1 — Read the Response Tracker
Read the "Response Tracker" sheet to get the rows added last Sunday:
- Read range: Response Tracker!A:J
- Find rows where "Email Sent Date" = last Sunday (yesterday - 1 day, or the most recent Sunday)
- Note the row numbers for Alex, Delta, ESM, Key Accounts — you will update these rows

### STEP 2 — Search for Replies
For each cluster, search Gmail for replies to last Sunday's report:

Search query: `subject:"Clusters Daily Report V2" after:[last-sunday-date]`

Also search by thread — read the full Gmail thread for each cluster report to capture all replies:
- Use `search_gmail_messages` with query: `subject:"Clusters Daily Report V2 (Alex)" after:[last-sunday-date]`
- Then use `get_gmail_thread_content` on the thread ID to get all messages in the thread

Repeat for Delta, ESM, Key Accounts.

### STEP 3 — Parse Responses
For each reply found, extract:
- Did the team leader reply? (Yes/No)
- Date and time of reply
- Key actions they committed to (summarize in 2-3 bullet points max)
- Any blockers or questions they raised
- Whether follow-up is required (Yes/No)

If no reply from a team leader, mark Response Received = "No", Follow-up Required = "Yes".

### STEP 4 — Update the Tracker
For each cluster, update the corresponding row in "Response Tracker" sheet:
- Column E (Response Received): Yes or No
- Column F (Response Date): date of response, or blank if none
- Column G (Key Actions Committed): brief summary of commitments
- Column H (Blockers / Questions): any questions or blockers raised
- Column I (Follow-up Required): Yes or No
- Column J (Follow-up Notes): any notes

Use `modify_sheet_values` with the exact row range (e.g., "Response Tracker!E5:J5") to update only those columns.

### STEP 5 — Send Summary to Adham
Send a summary email to adham.h.2@talabat.com:

Subject: "Clusters Weekly Response Summary — [TODAY'S DATE]"

Body (HTML):
- A table showing each cluster, whether team leader replied (✅/❌), and what actions they committed to
- A section listing any non-responders and recommending follow-up
- A section with any questions/blockers needing Adham's attention

Example table structure:
| Cluster | Team Leader | Responded? | Key Commitments | Follow-up Needed? |
|---------|-------------|------------|-----------------|-------------------|
| Alex    | Rowan Elkersh | ✅ Yes  | [summary]       | No                |
| Delta   | Ahmed Elhaddad | ❌ No  | —               | Yes — send reminder|
...

Sign off: "EG Experience Team | Talabat"

## IMPORTANT NOTES
- "Last Sunday" = the most recent Sunday before today (today is Monday). Compute this via bash: `date -d "last sunday" +%Y-%m-%d`
- If a team leader has not replied, do NOT send them a reminder automatically — just flag it in the summary to Adham
- Always read the actual response content — do not assume or hallucinate what they said
- If the Response Tracker has no rows from last Sunday (e.g., the Sunday task didn't run), note this in the summary email to Adham and skip the tracker update
