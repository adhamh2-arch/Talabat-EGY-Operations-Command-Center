#!/usr/bin/env node
/**
 * init_master_tracker.js
 *
 * One-time migration script. Reads tracker/offenders_tracker.csv and
 * builds tracker/master_tracker.json + tracker/history.jsonl from scratch.
 *
 * Safe to re-run — will overwrite master_tracker.json with migrated data
 * but will NOT duplicate history.jsonl (it rewrites it from scratch).
 *
 * Usage:  node init_master_tracker.js
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { computeRecurrenceSeverity } from './lib/recurrence_detector.js';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const TRACKER_DIR  = join(__dirname, 'tracker');
const CSV_FILE     = join(TRACKER_DIR, 'offenders_tracker.csv');
const MASTER_FILE  = join(TRACKER_DIR, 'master_tracker.json');
const HISTORY_FILE = join(TRACKER_DIR, 'history.jsonl');
const COMM_LOG     = join(TRACKER_DIR, 'communication_log.jsonl');
const ACTION_LOG   = join(TRACKER_DIR, 'action_log.jsonl');

// ── Ensure tracker dir exists ─────────────────────────────────────────────────
if (!existsSync(TRACKER_DIR)) mkdirSync(TRACKER_DIR, { recursive: true });

// ── Initialise empty log files if they don't exist ───────────────────────────
if (!existsSync(COMM_LOG))   writeFileSync(COMM_LOG,   '');
if (!existsSync(ACTION_LOG)) writeFileSync(ACTION_LOG, '');

// ── If no CSV, create empty master tracker and exit ──────────────────────────
if (!existsSync(CSV_FILE)) {
  console.log('No offenders_tracker.csv found. Creating empty master_tracker.json.');
  writeFileSync(MASTER_FILE, JSON.stringify({ cases: {}, lastUpdated: new Date().toISOString() }, null, 2));
  writeFileSync(HISTORY_FILE, '');
  console.log(JSON.stringify({ status: 'EMPTY_INIT', cases: 0 }));
  process.exit(0);
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsvLine(line) {
  const result = [];
  let current  = '';
  let inQuote  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const row  = {};
    headers.forEach((h, i) => { row[h] = cols[i] !== undefined ? cols[i] : ''; });
    return row;
  }).filter(row => Object.values(row).some(v => v)); // skip blank rows
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
const csvContent = readFileSync(CSV_FILE, 'utf-8');
const csvRows    = parseCsv(csvContent);

console.log(`Parsed ${csvRows.length} rows from offenders_tracker.csv`);

// ── Group by vendor_name|cluster, dedup by vendor+date ───────────────────────
// Key: "vendor_name|cluster"
const vendorMap  = {}; // key → { rows: [], datesSeen: Set }
const seenCombo  = new Set(); // "vendor_name|cluster|date" — for dedup

for (const row of csvRows) {
  const vendorName = row.vendor_name || row.vendor_id || 'UNKNOWN';
  const cluster    = row.cluster || 'unknown';
  const date       = row.date || '';

  if (!date) continue;

  const key   = `${vendorName}|${cluster}`;
  const combo = `${key}|${date}`;

  // Skip duplicates from double-run bug (same vendor+cluster+date)
  if (seenCombo.has(combo)) continue;
  seenCombo.add(combo);

  if (!vendorMap[key]) {
    vendorMap[key] = {
      vendor_key:   key,
      vendor_name:  vendorName,
      cluster,
      am_name:      row.am_name  || '',
      am_email:     row.am_email || '',
      city:         row.city     || '',
      is_key_vip:   row.is_key_vip === 'yes',
      rows:         [],
      datesSeen:    new Set(),
    };
  }

  vendorMap[key].rows.push(row);
  vendorMap[key].datesSeen.add(date);
}

// ── Build master tracker cases ────────────────────────────────────────────────
const cases = {};

for (const [key, vm] of Object.entries(vendorMap)) {
  const sortedDates  = [...vm.datesSeen].sort();
  const firstDate    = sortedDates[0];
  const lastDate     = sortedDates[sortedDates.length - 1];
  const appearances  = sortedDates.length;

  const recurrenceSeverity = computeRecurrenceSeverity(appearances, 1);

  // Latest row for current values
  const latestRow = vm.rows
    .filter(r => r.date === lastDate)
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0] || vm.rows[vm.rows.length - 1];

  const lastFailedOrders  = parseInt(latestRow.vendor_net_failed) || 0;
  const lastLostGmv       = parseFloat(latestRow.lost_gmv_lc)    || 0;
  const lastFailRate      = parseFloat(latestRow.fail_rate_pct)   || 0;
  const lastFaultCases    = parseInt(latestRow.vendor_fault_cases) || 0;
  const topFailureReason  = latestRow.talabat_reason || '';
  const currentRiskScore  = parseFloat(latestRow.risk_score)      || 0;

  cases[key] = {
    vendor_key:           key,
    vendor_name:          vm.vendor_name,
    chain_name:           vm.vendor_name,
    cluster:              vm.cluster,
    city:                 vm.city,
    am_name:              vm.am_name,
    am_email:             vm.am_email,
    is_key_vip:           vm.is_key_vip,

    first_detection_date: firstDate,
    last_detection_date:  lastDate,
    last_seen_date:       lastDate,
    appearances,
    consecutive_days:     1, // cannot compute from CSV alone

    previous_risk_score:  null,
    current_risk_score:   currentRiskScore,
    risk_score_change:    0,

    previous_rank:        null,
    current_rank:         parseInt(latestRow.daily_rank) || null,
    rank_movement:        'stable',
    historical_highest_rank: null,
    historical_lowest_rank:  null,

    recurrence_severity:  recurrenceSeverity,
    improvement_status:   appearances > 1 ? 'Stable' : 'New',

    last_failed_orders:   lastFailedOrders,
    last_lost_gmv:        lastLostGmv,
    last_fail_rate:       lastFailRate,
    last_vendor_fault_cases: lastFaultCases,
    top_failure_reason:   topFailureReason,

    // Comms — unknown from CSV
    is_active:               false, // will be set by next upsert run
    email_required:          false,
    email_sent:              false,
    email_sent_date:         null,
    email_thread_id:         null,
    response_received:       false,
    response_classification: null,
    communication_status:    'none',
    vendor_action_required:  false,
    vendor_action_completed: false,
    action_verification_status: null,
    recommended_action:      '',
  };
}

// ── Write master_tracker.json ─────────────────────────────────────────────────
writeFileSync(MASTER_FILE, JSON.stringify({
  cases,
  lastUpdated: new Date().toISOString(),
  migratedFrom: 'offenders_tracker.csv',
  migratedAt:   new Date().toISOString(),
}, null, 2));

// ── Write history.jsonl from deduplicated CSV rows ────────────────────────────
// One row per unique vendor+date combination
const historyLines = [];

for (const [key, vm] of Object.entries(vendorMap)) {
  for (const row of vm.rows) {
    const histLine = {
      date:                row.date,
      vendor_key:          key,
      vendor_name:         vm.vendor_name,
      cluster:             vm.cluster,
      city:                vm.city        || '',
      am_name:             vm.am_name     || '',
      am_email:            vm.am_email    || '',
      is_key_vip:          vm.is_key_vip,
      daily_rank:          null, // not in CSV
      cluster_risk_score:  parseFloat(row.risk_score) || 0,
      failed_orders:       parseInt(row.vendor_net_failed) || 0,
      lost_gmv:            parseFloat(row.lost_gmv_lc) || 0,
      fail_rate:           parseFloat(row.fail_rate_pct) || 0,
      vendor_fault_cases:  parseInt(row.vendor_fault_cases) || 0,
      talabat_reason:      row.talabat_reason || '',
      appearances:         vm.datesSeen.size,
      consecutive_days:    1,
      recurrence_severity: row.repeat_level || 'Low',
      improvement_status:  'New',
      alert_triggered:     row.alert_triggered === 'yes',
      migrated_from_csv:   true,
    };
    historyLines.push(JSON.stringify(histLine));
  }
}

// Sort by date
historyLines.sort((a, b) => {
  const da = JSON.parse(a).date;
  const db = JSON.parse(b).date;
  return da < db ? -1 : da > db ? 1 : 0;
});

writeFileSync(HISTORY_FILE, historyLines.join('\n') + (historyLines.length > 0 ? '\n' : ''));

// ── Summary ───────────────────────────────────────────────────────────────────
const caseCount        = Object.keys(cases).length;
const csvRowCount      = csvRows.length;
const dedupedRowCount  = historyLines.length;
const duplicatesSkipped = csvRowCount - dedupedRowCount;

console.log(`
Migration Summary
─────────────────────────────────────────
CSV rows parsed:         ${csvRowCount}
Duplicate rows skipped:  ${duplicatesSkipped}
Unique history rows:     ${dedupedRowCount}
Unique vendor cases:     ${caseCount}
Files written:
  tracker/master_tracker.json
  tracker/history.jsonl
  tracker/communication_log.jsonl (empty if new)
  tracker/action_log.jsonl       (empty if new)
─────────────────────────────────────────`);

console.log(JSON.stringify({
  status:             'SUCCESS',
  csvRowsParsed:      csvRowCount,
  duplicatesSkipped,
  historyRowsWritten: dedupedRowCount,
  casesMigrated:      caseCount,
}));
