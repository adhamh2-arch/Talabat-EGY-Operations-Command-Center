---
name: clusters-weekly-analysis-sunday
description: Every Sunday 10 AM: Run Looker WoW dashboard for all 4 clusters in PARALLEL, send Talabat-branded insights emails (Poppins font + WoW KPIs + Vendor Ratings + Feedback Form), update tracker [TEST MODE]
---

You are running the weekly Clusters Performance Analysis for Talabat Egypt.

## ⚠️ TEST MODE ACTIVE
ALL emails must be sent ONLY to: adham.h.2@talabat.com — no other recipients.

## TOOLS
- Looker: mcp__28138290-1612-4fb1-aaf0-f9911799cd76__looker_run_dashboard
- Gmail: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__send_gmail_message
- Sheets read: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__read_sheet_values
- Sheets write: mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__modify_sheet_values
- Bash (Python for large file parsing)

## TRACKER
Spreadsheet ID: 1Mm5lPcOmt_FzMw_Jrtx_yEaKb0kYfIhZVDdjzBqU1IY
Tabs: Weekly KPIs | Top Offenders | AM Performance | Response Tracker

## LOOKER DASHBOARD
Dashboard ID: 18231

---

## CLUSTER CONFIG

| Cluster | Team Leader | Email (post-test) | VFR Target |
|---------|-------------|-------------------|------------|
| Alex | Rowan Elkersh | rowan.elkersh@talabat.com | 0.70% |
| Delta | Ahmed Elhaddad | ahmed.elhaddad@talabat.com | 0.72% |
| ESM | Ahmed el Gharably | ahmed.el.13@talabat.com | 0.72% |
| Key Accounts | Hadeer Bahaa | hadeer.bahaa@talabat.com | 0.80% |

## KPI TARGETS (APPLY TO ALL CLUSTERS)

| KPI | Target | Warn | Critical |
|-----|--------|------|---------|
| Net Orders | ↑ Increasing WoW | — | — |
| VFR % | ≤ 0.80% | 0.80–1.20% | > 1.20% |
| NFR % | ≤ 1.80% | 1.80–2.20% | > 2.20% |
| Vendor Delay V2 | < 5.00% | 5.00–6.00% | > 6.00% |
| Availability % | ≥ 80% | 70–80% | < 70% |
| CST Contact Rate | < 3.00% | 3.00–3.50% | > 3.50% |
| Image Ratio | > 90% | 85–90% | < 85% |
| Description Ratio | > 80% | 75–80% | < 75% |
| Active Vendor Count | Info only | — | — |

---

## MANDATORY BRAND / DESIGN SYSTEM (APPLY TO EVERY EMAIL)

Every email MUST follow Talabat brand standards. No exceptions.

### Colors
| Name | Hex | Use |
|------|-----|-----|
| Talabat Orange | `#FF5900` | Headers, buttons, accent bars, table headers, section titles |
| Dark Burgundy | `#411517` | Body text, dark backgrounds |
| Warm Cream | `#F4EDE3` | Email background, card backgrounds |
| White | `#FFFFFF` | Inner card surface, text on orange |
| Electric Lime | `#CFFF00` | Accent on orange/dark backgrounds only |
| Status Red | `#C0392B` | Critical flags |
| Status Orange | `#E67E22` | Warning flags |
| Status Green | `#27AE60` | On target / improving |
| Status Yellow | `#F1C40F` | Watch |

### Typography
Font: **Poppins** (loaded via Google Fonts @import). Fallback: Arial, sans-serif.
- Email title: Poppins ExtraBold 22px, color #FFFFFF on orange
- Section headers: Poppins SemiBold 14px, color #FFFFFF on #FF5900
- Table headers: Poppins Bold 12px, color #FFFFFF on #FF5900
- Body/cells: Poppins Regular 12–13px, color #411517
- Status badges: Poppins Bold 11px

### Layout Rules — ALL MANDATORY
1. **Everything centered** — email wrapper max-width 900px, margin: 0 auto
2. Email background: `#F4EDE3` (cream)
3. Inner card: white `#FFFFFF`, border-radius 12px, box-shadow `0 2px 16px rgba(65,21,23,0.08)`
4. Every section header: `#FF5900` background, white text, Poppins SemiBold, left-padded 18px
5. Table headers: `#FF5900` background, white text
6. Alternating table rows: even rows `#FFF8F4` (very light cream)
7. All tables: `width: 100%; border-collapse: collapse;`
8. All table cells: `text-align: center;` — exception: vendor name / AM name columns = left align
9. Footer bar: `#411517` background, white text, centered
10. Orange accent bar at top of email: full-width, 6px height, `#FF5900`

### Mandatory CSS Block (include in every email `<head>`):
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Poppins', Arial, sans-serif;
    background: #F4EDE3;
    color: #411517;
    font-size: 13px;
    line-height: 1.6;
  }
  .email-outer { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  .accent-bar { width: 100%; height: 6px; background: #FF5900; border-radius: 6px 6px 0 0; }
  .email-card { background: #FFFFFF; border-radius: 0 0 12px 12px; box-shadow: 0 2px 16px rgba(65,21,23,0.08); overflow: hidden; }
  .email-header { background: #FF5900; padding: 24px 32px; text-align: center; }
  .email-header h1 { font-family: 'Poppins', Arial, sans-serif; font-weight: 800; font-size: 22px; color: #FFFFFF; margin-bottom: 4px; }
  .email-header p { font-family: 'Poppins', Arial, sans-serif; font-size: 12px; color: #F4EDE3; opacity: 0.9; }
  .test-banner { background: #411517; color: #CFFF00; text-align: center; padding: 8px 16px; font-family: 'Poppins', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
  .email-body { padding: 24px 28px; }
  .greeting { font-family: 'Poppins', Arial, sans-serif; font-size: 14px; color: #411517; margin-bottom: 20px; }
  .section { margin-bottom: 28px; }
  .section-header { background: #FF5900; color: #FFFFFF; font-family: 'Poppins', Arial, sans-serif; font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 6px 6px 0 0; }
  .section-body { border: 1px solid #F4EDE3; border-top: none; border-radius: 0 0 6px 6px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-family: 'Poppins', Arial, sans-serif; font-size: 12px; }
  th { background: #FF5900; color: #FFFFFF; padding: 9px 10px; text-align: center; font-weight: 600; font-size: 11px; }
  th.left { text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #F4EDE3; color: #411517; text-align: center; vertical-align: middle; }
  td.left { text-align: left; }
  tr:nth-child(even) td { background: #FFF8F4; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; font-family: 'Poppins', Arial, sans-serif; }
  .badge-critical { background: #FDECEA; color: #C0392B; border: 1px solid #C0392B; }
  .badge-warning { background: #FEF3E2; color: #E67E22; border: 1px solid #E67E22; }
  .badge-ok { background: #EAFAF1; color: #27AE60; border: 1px solid #27AE60; }
  .badge-watch { background: #FEFCE8; color: #B7950B; border: 1px solid #F1C40F; }
  .badge-info { background: #F4EDE3; color: #411517; border: 1px solid #D5C6B9; }
  .kpi-delta-up { color: #C0392B; font-weight: 700; }
  .kpi-delta-down { color: #27AE60; font-weight: 700; }
  .kpi-delta-neutral { color: #7F8C8D; font-weight: 600; }
  .risk-critical { background: #FDECEA; }
  .risk-high { background: #FEF3E2; }
  .risk-medium { background: #FEFCE8; }
  .risk-low { background: #EAFAF1; }
  .feedback-wrap { background: #F4EDE3; border: 2px dashed #FF5900; border-radius: 10px; padding: 24px; text-align: center; margin: 28px 0; }
  .feedback-title { font-family: 'Poppins', Arial, sans-serif; font-size: 15px; font-weight: 700; color: #FF5900; margin-bottom: 8px; }
  .feedback-sub { font-family: 'Poppins', Arial, sans-serif; font-size: 12px; color: #411517; margin-bottom: 16px; }
  .btn-feedback { display: inline-block; background: #FF5900; color: #FFFFFF !important; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-family: 'Poppins', Arial, sans-serif; font-size: 13px; font-weight: 700; }
  .feedback-note { font-family: 'Poppins', Arial, sans-serif; font-size: 11px; color: #8E6B55; margin-top: 10px; font-style: italic; }
  .email-footer { background: #411517; color: #F4EDE3; text-align: center; padding: 16px 20px; font-family: 'Poppins', Arial, sans-serif; font-size: 11px; }
  .source-note { font-family: 'Poppins', Arial, sans-serif; font-size: 11px; color: #8E6B55; font-style: italic; padding: 6px 12px; background: #FFFAF7; }
</style>
```

---

## STEP 1 — SPAWN 4 PARALLEL CLUSTER AGENTS

Spawn all 4 agents simultaneously in a single call. Each handles one cluster end-to-end.

---

### AGENT PROMPT TEMPLATE

```
You are processing the weekly Clusters Performance Analysis for the [CLUSTER_NAME] cluster at Talabat Egypt.

## CLUSTER DETAILS
- Cluster: [CLUSTER_NAME]
- Team Leader: [TEAM_LEADER_NAME]
- Real email (post-test): [TEAM_LEADER_EMAIL]
- VFR Target: [VFR_TARGET]%
- Is Key Accounts: [YES/NO]

## TEST MODE — ALL emails go ONLY to: adham.h.2@talabat.com

## TOOLS
- mcp__28138290-1612-4fb1-aaf0-f9911799cd76__looker_run_dashboard
- mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__send_gmail_message
- mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__read_sheet_values
- mcp__9d0eeefb-14b7-4db7-bb20-a95ff999d323__modify_sheet_values
- Bash (Python for large file parsing)

---

## STEP A — Run 2 Looker Dashboard Queries (Week over Week)

Run both queries. Save both output files.

**Query A1 — This Week:**
Call looker_run_dashboard with:
  dashboard_id: "18231"
  filters: [FILTERS_JSON with "Local Order Date": "this week"]

**Query A2 — Last Week:**
Call looker_run_dashboard with:
  dashboard_id: "18231"
  filters: [FILTERS_JSON with "Local Order Date": "last week"]

Translate the output file path: Windows prefix up to "\outputs" → "/sessions/[session-id]/mnt/outputs"
Get the exact session-id from the tool output file path — never guess it.

---

## STEP B — Extract Data From Both Files

Run this Python script for EACH file (replace FILE_PATH):

```python
import json

with open('FILE_PATH') as f:
    data = json.load(f)

elements = {}
for el in data.get('elements', []):
    title = el.get('title')
    rows = el.get('data', [])
    if title and rows:
        elements[title] = rows

print("ELEMENTS:", list(elements.keys()))
print("ROW COUNTS:", {k: len(v) for k,v in elements.items()})

for name, rows in elements.items():
    print(f"\n===== {name} ({len(rows)} rows) =====")
    for r in rows:
        print(r)
```

Extract from BOTH files:
- "Net orders" → net orders total
- "VFR" → VFR %
- "NFR" → NFR %
- "VD V2" or "Vendor Delay" → delay %
- "Availability" → availability %
- "CST CR" → contact rate %
- "Active Vendor" → vendor count
- "Image Ratio" → %
- "Description Ratio" → %
- "Busy Reasons" → ALL rows
- "Top 20 Offender Vendors" → ALL rows (MTD offenders list)
- "Top 20 Offenders Last Day" → ALL rows (yesterday)
- "AM VFR Performance" → ALL rows
- "Zones Contribution" or "VFR Contribution per Area" → ALL rows
- "Top VF-Reason" → ALL rows
- "Top 20 Ven Ratings and reviews" → ALL rows (columns: vendor_name, rating_display, avg_driver_rating, avg_original_rating, rating_count, reviews_count)
- "Top 20 Outliers Ven Ratings and reviews" → ALL rows (same columns)

Label all extracted values as either `this_week` or `last_week` based on which file they came from.

---

## STEP C — KA VENDOR FILTER (STRICT — APPLY BEFORE EMAIL BUILD)

### For NON-Key Accounts clusters (Alex, Delta, ESM):
Remove the following brands COMPLETELY from Top Offenders (both MTD and yesterday lists) and AM Performance analysis before writing any email section:
- KFC / KFC-TGO
- McDonald's
- Pizza Hut
- Hardee's
- Papa John's / Papa John's Pizza
- Starbucks
- Burger King
- Al Dahan
- Domino's
- Cilantro
- Prego
- B.LABAN
- Gad
- Bazooka (entries labeled TGO or tagged as Key Account)

After filtering, note at the bottom of the Top Offenders section: "⚠️ Note: [N] Key Account brand vendors removed after post-processing filter."

### For Key Accounts cluster:
Keep ONLY: KFC, McDonald's, Pizza Hut, Hardee's, Papa John's, Starbucks, Burger King, Al Dahan, Domino's, Cilantro, Prego, B.LABAN, Gad, and other named national chains.
Remove: local/independent vendors.

---

## STEP D — Compute Metrics, Red Flags & Risk Scores

### D1 — WoW KPI Delta Computation
For each KPI:
- this_week_value = value from A1
- last_week_value = value from A2
- delta = this_week_value - last_week_value
- delta_arrow:
  - For VFR, NFR, Delay, Contact Rate: higher = worse → use 🔴▲ if delta > 0, 🟢▼ if delta < 0
  - For Net Orders, Availability, Image Ratio, Description Ratio: higher = better → use 🟢▲ if delta > 0, 🔴▼ if delta < 0
  - delta = 0 → → (neutral)
- status = assign based on this_week_value vs KPI target

### KPI TARGETS
| KPI | Target | Warn | Critical |
|-----|--------|------|---------|
| Net Orders | ↑ Increasing | WoW decline | — |
| VFR % | ≤ 0.80% | 0.80–1.20% | > 1.20% |
| NFR % | ≤ 1.80% | 1.80–2.20% | > 2.20% |
| Vendor Delay V2 | < 5.00% | 5.00–6.00% | > 6.00% |
| Availability % | ≥ 80% | 70–80% | < 70% |
| CST Contact Rate | < 3.00% | 3.00–3.50% | > 3.50% |
| Image Ratio | > 90% | 85–90% | < 85% |
| Description Ratio | > 80% | 75–80% | < 75% |
| Active Vendor Count | Info only | — | — |

### D2 — Red Flags
Generate a red flag for:
- 🔴 CRITICAL: Any vendor VFR > 20% this week (after KA filter)
- 🔴 CRITICAL: Cluster VFR > cluster target × 1.5
- 🔴 CRITICAL: Availability < 70%
- 🟠 WARNING: Vendor VFR 10–20% with stagnant or worsening trend
- 🟠 WARNING: Zone VFR > 5%
- 🟠 WARNING: AM VFR > 1.2%
- 🟠 WARNING: Description Ratio < 80%
- 🟡 NOTE: Top fail reason and volume this week

### D3 — Risk Score (every vendor in Top Offenders)
```python
cluster_vfr_target = [VFR_TARGET_DECIMAL]

deviation = max(0, vendor_vfr_pct - cluster_vfr_target * 100)
deviation_pct = (deviation / (cluster_vfr_target * 100)) * 100
factor1 = min(40, deviation_pct * 0.8)
factor2 = min(30, (vendor_vfos / 500) * 6)
factor3 = min(20, (vendor_orders / 10000) * 4)
lost_gmv = vendor_vfos * 180
factor4 = min(10, lost_gmv / 20000)
risk_score = round(factor1 + factor2 + factor3 + factor4)
```

| Score | Level | Row CSS class |
|-------|-------|---------------|
| 0–25 | 🟢 LOW | risk-low |
| 26–50 | 🟡 MEDIUM | risk-medium |
| 51–75 | 🟠 HIGH | risk-high |
| 76–100 | 🔴 CRITICAL | risk-critical |

Sort Top Offenders table by Risk Score DESC.

---

## STEP E — Build & Send Email

- to: adham.h.2@talabat.com (TEST MODE)
- subject: "[TEST] [CLUSTER_NAME] Cluster | Weekly Performance Report | [THIS_WEEK_DATE_RANGE]"
- body_type: html

### FULL HTML STRUCTURE — IDENTICAL ACROSS ALL 4 CLUSTERS

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  [PASTE MANDATORY CSS BLOCK FROM BRAND SECTION ABOVE]
</style>
</head>
<body>
<div class="email-outer">

  <!-- TOP ACCENT BAR -->
  <div class="accent-bar"></div>

  <div class="email-card">

    <!-- TEST BANNER -->
    <div class="test-banner">⚠️ TEST MODE — Real recipient: [TEAM_LEADER_EMAIL] | [DATE]</div>

    <!-- HEADER -->
    <div class="email-header">
      <h1>🍽️ [CLUSTER_NAME] Cluster Performance Report</h1>
      <p>EG Experience Team &nbsp;|&nbsp; Week: [THIS_WEEK_DATE_RANGE] vs [LAST_WEEK_DATE_RANGE] &nbsp;|&nbsp; Generated: [TODAY_DATE]</p>
    </div>

    <div class="email-body">

      <!-- GREETING -->
      <p class="greeting">Hello [TEAM_LEADER_FIRST_NAME],<br><br>
      Here is the <strong>[CLUSTER_NAME] Cluster weekly performance report</strong> with week-over-week comparisons. Please review the red flags and submit your feedback by EOD Tuesday.</p>

      <!-- SECTION 1: KPI SUMMARY -->
      <div class="section">
        <div class="section-header">📊 Section 1 — KPI Summary (Week-over-Week)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th class="left">KPI</th>
                <th>This Week</th>
                <th>Last Week</th>
                <th>WoW Δ</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <!-- One row per KPI. Use badge classes for Status. Use kpi-delta-up/down for Δ. -->
              <!-- Net Orders row example:
              <tr>
                <td class="left"><strong>Net Orders</strong></td>
                <td>525,781</td>
                <td>498,034</td>
                <td class="kpi-delta-down">🟢▲ +27,747</td>
                <td>↑ Increasing</td>
                <td><span class="badge badge-ok">✅ ON TARGET</span></td>
              </tr>
              -->
              [BUILD ROWS FOR: Net Orders, VFR %, NFR %, Vendor Delay V2, Availability %, CST Contact Rate, Active Vendors (info), Image Ratio, Description Ratio]
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 2: RED FLAGS -->
      <div class="section">
        <div class="section-header">🚨 Section 2 — Red Flags & Critical Issues</div>
        <div class="section-body">
          <!-- If no flags: <p style="padding:14px;color:#27AE60;font-weight:600;">✅ No critical flags this week.</p> -->
          <!-- For each flag:
          <table>
            <thead><tr><th>Severity</th><th class="left">Title</th><th class="left">Detail</th><th class="left">Action Required</th></tr></thead>
            <tbody>
              <tr class="risk-critical">
                <td><span class="badge badge-critical">🔴 CRITICAL</span></td>
                <td class="left">KFC KOBA — 28.6% VFR</td>
                <td class="left">VFR 28.6% this week | 280 faults / 979 orders | AM: Sherif Saleh | Worsening</td>
                <td class="left">Immediate escalation — root cause + 48hr plan</td>
              </tr>
            </tbody>
          </table>
          -->
        </div>
      </div>

      <!-- SECTION 3: TOP 20 MTD VFR OFFENDERS (AFTER KA FILTER) -->
      <div class="section">
        <div class="section-header">📋 Section 3 — Top VFR Offenders This Week (KA Filtered, Risk Score ↓)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Risk</th>
                <th class="left">Vendor Name</th>
                <th>ID</th>
                <th class="left">AM</th>
                <th>Orders</th>
                <th>VFOs</th>
                <th>VFR %</th>
                <th>Last Wk VFR</th>
                <th>WoW Δ</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <!-- Apply row class: risk-critical / risk-high / risk-medium / risk-low -->
              <!-- [BUILD ROWS, SORTED BY RISK SCORE DESC] -->
            </tbody>
          </table>
          <p class="source-note">⚠️ Note: [N] Key Account brand vendors removed (post-processing filter). | Cluster: [CLUSTER_NAME]</p>
        </div>
      </div>

      <!-- SECTION 4: TOP OFFENDERS YESTERDAY -->
      <div class="section">
        <div class="section-header">⚡ Section 4 — Top Offenders Last Day (KA Filtered)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th class="left">Vendor Name</th>
                <th class="left">AM</th>
                <th>Gross Orders</th>
                <th>VFOs</th>
                <th>VFR %</th>
                <th>NFR %</th>
              </tr>
            </thead>
            <tbody>
              <!-- [BUILD ROWS] -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 5: AM VFR PERFORMANCE -->
      <div class="section">
        <div class="section-header">👤 Section 5 — AM VFR Performance (This Week)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th class="left">AM Name</th>
                <th>Net Orders</th>
                <th>VFOs</th>
                <th>VFR %</th>
                <th>NFR %</th>
                <th>VF-CR %</th>
                <th>VFR Contribution</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <!-- VFR > 1.2% = badge-critical, 0.8–1.2% = badge-warning, < 0.8% = badge-ok -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 6: ZONE VFR CONTRIBUTION -->
      <div class="section">
        <div class="section-header">🗺️ Section 6 — Zone VFR Contribution (This Week)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th class="left">Zone</th>
                <th>Net Orders</th>
                <th>VFOs</th>
                <th>VFR %</th>
                <th>NFR %</th>
                <th>VFR Contribution %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <!-- Zones > 5% VFR: class="risk-critical", badge-critical -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 7: BUSY REASONS -->
      <div class="section">
        <div class="section-header">⏸️ Section 7 — Busy Reasons (This Week)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th class="left">Reason</th>
                <th>Hours</th>
                <th>% of Total</th>
                <th>WoW Change</th>
              </tr>
            </thead>
            <tbody>
              <!-- [BUILD ROWS, sorted by hours DESC] -->
            </tbody>
          </table>
          <p class="source-note">Top 3 reasons = [X]% of total busy hours. Key action: [one-line interpretation].</p>
        </div>
      </div>

      <!-- SECTION 8: TOP VF-REASONS -->
      <div class="section">
        <div class="section-header">⚡ Section 8 — Top VF-Reasons (This Week)</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th class="left">VF Reason</th>
                <th>Count</th>
                <th>WoW Δ</th>
              </tr>
            </thead>
            <tbody><!-- [BUILD ROWS] --></tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 9: VENDOR RATINGS & REVIEWS -->
      <div class="section">
        <div class="section-header">⭐ Section 9 — Vendor Ratings & Reviews (This Week)</div>
        <div class="section-body">
          <p class="source-note" style="padding:8px 12px;">Source: "Top 20 Ven Ratings and reviews" — Dashboard 18231</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th class="left">Vendor Name</th>
                <th>Rating Bin</th>
                <th>Display Rating</th>
                <th>Avg Driver Rating</th>
                <th>Avg Original Rating</th>
                <th>Rating Count</th>
                <th>Reviews Count</th>
              </tr>
            </thead>
            <tbody><!-- [BUILD ROWS, Top 20] --></tbody>
          </table>
          <p class="source-note" style="margin-top:12px; padding:8px 12px;"><strong>Outlier Vendors</strong> (ratings needing attention):</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th class="left">Vendor Name</th>
                <th>Display Rating</th>
                <th>Avg Rating</th>
                <th>Rating Count</th>
                <th>Reviews Count</th>
              </tr>
            </thead>
            <tbody><!-- [BUILD ROWS from "Top 20 Outliers Ven Ratings and reviews", or: "No outlier vendors this week."] --></tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 10: RECOMMENDED ACTIONS -->
      <div class="section">
        <div class="section-header">🎯 Section 10 — Recommended Actions</div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th class="left">Action</th>
                <th class="left">Owner</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              <!-- P1 for Risk Score ≥ 76 and 🔴 CRITICAL flags -->
              <!-- P2 for Risk Score 51–75 and 🟠 WARNING flags -->
              <!-- P3 for monitoring items -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- FEEDBACK FORM -->
      <div class="feedback-wrap">
        <p class="feedback-title">📝 Weekly Feedback Form</p>
        <p class="feedback-sub">Share your actions taken, blockers, and AM coaching updates for this week's report.</p>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLScdHENmxrEMMHcUBz-sqDC6OFMu7Ilk-gfezOZ36ReW7RZXUA/viewform" class="btn-feedback" target="_blank">Submit Your Weekly Feedback →</a>
        <p class="feedback-note">Please complete by EOD Tuesday.</p>
      </div>

    </div><!-- /email-body -->

    <!-- FOOTER -->
    <div class="email-footer">
      EG Experience Team &nbsp;|&nbsp; talabat &nbsp;|&nbsp; Auto-generated: [TODAY_DATE]<br>
      <span style="color:#CFFF00; font-weight:600;">⚠️ TEST MODE — Recipients restricted to adham.h.2@talabat.com</span>
    </div>

  </div><!-- /email-card -->
</div><!-- /email-outer -->
</body>
</html>
```

---

## STEP F — Update Google Sheets
Spreadsheet ID: 1Mm5lPcOmt_FzMw_Jrtx_yEaKb0kYfIhZVDdjzBqU1IY

Get today's date: `date +%Y-%m-%d` in bash.
Read existing row counts before each append:
- read_sheet_values("Weekly KPIs!A:A") → next_row = len(result) + 1
- read_sheet_values("Top Offenders!A:A") → next_row
- read_sheet_values("AM Performance!A:A") → next_row
- read_sheet_values("Response Tracker!A:A") → next_row

**Weekly KPIs tab** (1 row per cluster):
[date, cluster, team_leader, net_orders_this_week, net_orders_last_week, wow_delta_orders, vfr_this_week, vfr_last_week, wow_delta_vfr, vfr_target, nfr_this_week, availability, contact_rate, delay, description_ratio, active_vendors, "Yes (Test)"]

**Top Offenders tab** (1 row per vendor after KA filter):
[date, cluster, vendor_id, vendor_name, am_name, orders_this_week, vfos, vfr_pct, last_week_vfr, wow_delta, risk_score, risk_level, top_fail_reason, recommended_action]

**AM Performance tab** (1 row per AM):
[date, cluster, am_name, orders, vfos, vfr_pct, nfr_pct, vfcr_pct, status_label]

**Response Tracker tab** (1 row per cluster):
[date, cluster, team_leader, date, "No", "", "", "", "Yes", "Awaiting response"]

## RETURN
Return JSON:
{
  "cluster": "[CLUSTER_NAME]",
  "status": "success"|"partial"|"error",
  "email_sent": true/false,
  "tracker_updated": true/false,
  "vfr_this_week": "X.XX%",
  "vfr_last_week": "X.XX%",
  "wow_delta_vfr": "+/-X.XXpp",
  "vfr_target": "[VFR_TARGET]%",
  "ka_vendors_removed": N,
  "risk_critical_count": N,
  "risk_high_count": N,
  "red_flags": N,
  "error": null
}
```

---

## CLUSTER VARIABLES

**Agent 1 — Alex:**
- CLUSTER_NAME: Alex
- TEAM_LEADER_NAME: Rowan Elkersh
- TEAM_LEADER_EMAIL: rowan.elkersh@talabat.com
- VFR_TARGET: 0.70 / VFR_TARGET_DECIMAL: 0.007
- IS_KEY_ACCOUNTS: NO
- FILTERS_JSON (add "Local Order Date": "this week" or "last week"):
  - Team Leader Name: Rowan Elkersh
  - Is Active (Yes / No): Yes
  - Is Key VIP Account (Yes / No): No
  - Is Food (Yes / No): Yes
  - Is Darkstore (Yes / No): No

**Agent 2 — Delta:**
- CLUSTER_NAME: Delta
- TEAM_LEADER_NAME: Ahmed Elhaddad
- TEAM_LEADER_EMAIL: ahmed.elhaddad@talabat.com
- VFR_TARGET: 0.72 / VFR_TARGET_DECIMAL: 0.0072
- IS_KEY_ACCOUNTS: NO
- FILTERS_JSON:
  - Team Leader Name: Ahmed Elhaddad
  - Is Active (Yes / No): Yes
  - Is Key VIP Account (Yes / No): No
  - Is Food (Yes / No): Yes
  - Is Darkstore (Yes / No): No

**Agent 3 — ESM:**
- CLUSTER_NAME: ESM
- TEAM_LEADER_NAME: Ahmed el Gharably
- TEAM_LEADER_EMAIL: ahmed.el.13@talabat.com
- VFR_TARGET: 0.72 / VFR_TARGET_DECIMAL: 0.0072
- IS_KEY_ACCOUNTS: NO
- FILTERS_JSON:
  - Team Leader Name: Ahmed el Gharably
  - Is Active (Yes / No): Yes
  - Is Key VIP Account (Yes / No): No
  - Is Food (Yes / No): Yes
  - Is Darkstore (Yes / No): No

**Agent 4 — Key Accounts:**
- CLUSTER_NAME: Key Accounts
- TEAM_LEADER_NAME: Hadeer Bahaa
- TEAM_LEADER_EMAIL: hadeer.bahaa@talabat.com
- VFR_TARGET: 0.80 / VFR_TARGET_DECIMAL: 0.008
- IS_KEY_ACCOUNTS: YES
- FILTERS_JSON:
  - Is Active (Yes / No): Yes
  - Is Key VIP Account (Yes / No): Yes
  - Is Food (Yes / No): Yes
  - Is Darkstore (Yes / No): No

---

## STEP 2 — WAIT FOR ALL 4 AGENTS

Collect all 4 JSON summaries. If any agent fails, log "ERROR" in the Weekly KPIs tab and note in final summary.

---

## STEP 3 — PIPELINE SUMMARY EMAIL TO ADHAM

To: adham.h.2@talabat.com
Subject: "🍽️ [TEST] Weekly Clusters Pipeline Summary — [TODAY_DATE]"
HTML — Talabat brand (same CSS as above).

Include:
- Pipeline status table: Cluster | Status | VFR This Wk | VFR Last Wk | WoW Δ | KA Removed | Critical | High | Red Flags | Email
- Any errors/partial failures
- Footer: EG Experience Team | talabat | Auto-generated

---

## CRITICAL RULES (NON-NEGOTIABLE)
1. Spawn all 4 agents simultaneously — never sequential
2. Every email uses IDENTICAL HTML structure (10 sections + feedback form + footer) — same section order, same table columns
3. Talabat brand ALWAYS: Poppins font, #FF5900 orange, #411517 burgundy, #F4EDE3 cream, everything centered
4. WoW KPI table ALWAYS: This Week | Last Week | WoW Δ | Target | Status
5. KA vendors STRICTLY filtered BEFORE writing any section (Alex/Delta/ESM: remove KA brands; Key Accounts: keep only KA brands)
6. Risk scores computed for every vendor in Top Offenders; table sorted DESC by risk score
7. Vendor Ratings & Reviews section (Section 9) ALWAYS included — extract from "Top 20 Ven Ratings and reviews"
8. Feedback form button ALWAYS included
9. All data from Looker only — never estimate or fabricate
10. If agent fails, log and continue — never abort the whole pipeline