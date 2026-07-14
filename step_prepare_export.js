#!/usr/bin/env node
/**
 * step_prepare_export.js
 *
 * Loads master_tracker.json and exports a CSV snapshot for Google Sheets sync.
 *
 * Usage:  node step_prepare_export.js 2026-06-24
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadMasterTracker } from './lib/master_tracker_store.js';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

const RUN_DATE = process.argv[2];
if (!RUN_DATE) {
  console.error('Usage: node step_prepare_export.js <YYYY-MM-DD>');
  process.exit(1);
}

if (!existsSync(MCP_DATA_DIR)) mkdirSync(MCP_DATA_DIR, { recursive: true });

// ── Load tracker ──────────────────────────────────────────────────────────────
const data  = loadMasterTracker();
const cases = data.cases || {};

// ── Filter: active OR seen in last 30 days ────────────────────────────────────
const cutoff30 = new Date(RUN_DATE + 'T00:00:00Z');
cutoff30.setUTCDate(cutoff30.getUTCDate() - 30);
const cutoff30Str = cutoff30.toISOString().slice(0, 10);

const eligible = Object.values(cases).filter(c =>
  c.is_active === true ||
  (c.last_seen_date && c.last_seen_date >= cutoff30Str)
);

// ── Severity sort order ───────────────────────────────────────────────────────
const SEVERITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

eligible.sort((a, b) => {
  // is_active DESC
  if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
  // recurrence_severity DESC
  const ra = SEVERITY_RANK[a.recurrence_severity] || 0;
  const rb = SEVERITY_RANK[b.recurrence_severity] || 0;
  if (ra !== rb) return rb - ra;
  // last_failed_orders DESC
  return (b.last_failed_orders || 0) - (a.last_failed_orders || 0);
});

// ── CSV helpers ───────────────────────────────────────────────────────────────
function csvField(val) {
  const s = String(val === null || val === undefined ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const COLUMNS = [
  'chain_name', 'cluster', 'city', 'am_name', 'am_email', 'is_key_vip',
  'first_detection_date', 'last_detection_date', 'appearances', 'consecutive_days', 'recurrence_severity',
  'current_risk_score', 'risk_score_change', 'improvement_status',
  'current_rank', 'rank_movement', 'historical_highest_rank',
  'last_failed_orders', 'last_lost_gmv', 'last_fail_rate',
  'top_failure_reason', 'recommended_action',
  'email_required', 'email_sent', 'email_sent_date', 'communication_status',
  'response_received', 'response_classification',
  'vendor_action_required', 'vendor_action_completed', 'action_verification_status',
  'is_active', 'last_seen_date',
];

// ── Build CSV lines ───────────────────────────────────────────────────────────
const lines = [COLUMNS.join(',')];

for (const c of eligible) {
  const row = COLUMNS.map(col => {
    const val = c[col];
    if (typeof val === 'boolean') return val ? 'yes' : 'no';
    return csvField(val);
  });
  lines.push(row.join(','));
}

const csv = lines.join('\n') + '\n';

// ── Write file ────────────────────────────────────────────────────────────────
const outFile = join(MCP_DATA_DIR, `master_tracker_export_${RUN_DATE}.csv`);
writeFileSync(outFile, csv);

const activeCases = eligible.filter(c => c.is_active).length;

console.log(JSON.stringify({
  status:       'SUCCESS',
  rowsExported: eligible.length,
  activeCases,
  file:         `mcp_data/master_tracker_export_${RUN_DATE}.csv`,
  date:         RUN_DATE,
}));
