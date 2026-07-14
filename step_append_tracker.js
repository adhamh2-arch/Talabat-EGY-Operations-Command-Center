#!/usr/bin/env node
/**
 * step_append_tracker.js
 *
 * Reads scored_output_YYYY-MM-DD.json, computes repeat-offender levels,
 * and APPENDS new rows to tracker/offenders_tracker.csv.
 *
 * Repeat level is determined by counting distinct dates the vendor_id
 * has appeared in the tracker (including today's new entry):
 *   NEW      = 1
 *   MEDIUM   = 2–3
 *   HIGH     = 4–5
 *   CRITICAL = 6+
 *
 * Usage:  node step_append_tracker.js 2026-06-24
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_DATA_DIR  = join(__dirname, 'mcp_data');
const CONFIG_PATH   = join(__dirname, 'config', 'agents.config.json');
const TRACKER_PATH  = join(__dirname, 'tracker', 'offenders_tracker.csv');

const HEADER = 'date,cluster,vendor_id,vendor_name,city,am_name,am_email,is_key_vip,net_orders,vendor_net_failed,fail_rate_pct,lost_gmv_lc,vendor_fault_cases,late_delivery_cases,missing_items_cases,order_quality_cases,talabat_reason,risk_score,risk_level,repeat_level,appearances,alert_triggered,alert_sent';

const config  = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
const alertCfg = config.alerting;

const RUN_DATE = process.argv[2];
if (!RUN_DATE) {
  console.error('Usage: node step_append_tracker.js <YYYY-MM-DD>');
  process.exit(1);
}

const scoredFile = join(MCP_DATA_DIR, `scored_output_${RUN_DATE}.json`);
if (!existsSync(scoredFile)) {
  console.error(`scored_output_${RUN_DATE}.json not found. Run mcp_bridge_runner.js first.`);
  process.exit(1);
}

const scored = JSON.parse(readFileSync(scoredFile, 'utf-8'));

// ── Ensure tracker CSV exists with header ────────────────────────────────────
if (!existsSync(TRACKER_PATH)) {
  writeFileSync(TRACKER_PATH, HEADER + '\n');
}

// ── Load existing tracker to build appearance counts ─────────────────────────
const existingContent = readFileSync(TRACKER_PATH, 'utf-8');
const existingLines   = existingContent.split('\n').filter(l => l.trim() && !l.startsWith('date,'));

// Count distinct dates per vendor_id (col index 2 = vendor_id, col 0 = date)
const vendorAppearanceDates = {}; // vendor_id → Set<date>
for (const line of existingLines) {
  const cols = parseCsvLine(line);
  if (cols.length < 3) continue;
  const [date, , vendorId] = cols;
  if (!vendorId) continue;
  if (!vendorAppearanceDates[vendorId]) vendorAppearanceDates[vendorId] = new Set();
  vendorAppearanceDates[vendorId].add(date);
}

// ── Determine repeat level ────────────────────────────────────────────────────
function repeatLevel(appearances) {
  const levels = alertCfg.repeatOffenderLevels;
  if (appearances >= levels.CRITICAL.min) return 'CRITICAL';
  if (appearances >= levels.HIGH.min)     return 'HIGH';
  if (appearances >= levels.MEDIUM.min)   return 'MEDIUM';
  return 'NEW';
}

// ── Determine if alert should be triggered ───────────────────────────────────
function shouldAlert(vendor, clusterRiskScore, repLevel) {
  const t = alertCfg.triggers;
  if (alertCfg.triggers.forcedAlertOnRepeatLevels.includes(repLevel)) return true;
  if (vendor.lostGmv >= t.lostGmvThreshold)            return true;
  if (vendor.failRate >= t.vendorFailRateThreshold * 100) return true;
  if (vendor.vendor_fault_cases >= t.vendorFaultCasesThreshold) return true;
  if (vendor.is_key_vip && vendor.failedOrders >= t.keyAccountFailedThreshold) return true;
  return false;
}

// ── Collect all offender rows from scored output ──────────────────────────────
function collectOffenders() {
  const rows = [];

  // Cluster top offenders
  for (const cluster of scored.clusterResults) {
    for (const v of cluster.topOffenders || []) {
      rows.push({ ...v, cluster: cluster.cluster, clusterRiskScore: cluster.riskScore });
    }
  }

  // Key accounts
  for (const v of scored.keyAccounts?.topOffenders || []) {
    rows.push({ ...v, cluster: 'key_accounts', clusterRiskScore: 0 });
  }

  return rows;
}

// ── Escape a CSV field ────────────────────────────────────────────────────────
function csvField(val) {
  const s = String(val === null || val === undefined ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Simple CSV line parser (handles quoted fields) ────────────────────────────
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuote  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const offenders = collectOffenders();
const newLines  = [];

// Deduplicate by vendor_id within this run (a vendor can appear in multiple clusters)
const seenToday = new Set();

for (const v of offenders) {
  const vid = v.vendor_id || v.vendor || 'UNKNOWN';
  const key = `${RUN_DATE}::${vid}`;
  if (seenToday.has(key)) continue;
  seenToday.add(key);

  // Compute appearances (previous dates + today)
  const prevDates = vendorAppearanceDates[vid] || new Set();
  const appearances = prevDates.has(RUN_DATE)
    ? prevDates.size
    : prevDates.size + 1;

  const repLevel     = repeatLevel(appearances);
  const alertTriggered = shouldAlert(v, v.clusterRiskScore, repLevel);

  const row = [
    RUN_DATE,
    v.cluster,
    csvField(vid),
    csvField(v.vendor),
    csvField(v.city),
    csvField(v.am_name || ''),
    csvField(v.am_email || ''),
    v.is_key_vip ? 'yes' : 'no',
    v.net_orders || v.allOrders || 0,
    v.vendor_net_failed || v.failedOrders || 0,
    (v.failRate || 0).toFixed(4),
    v.lostGmv || 0,
    v.vendor_fault_cases || 0,
    v.late_delivery_cases || 0,
    v.missing_items_cases || 0,
    v.order_quality_cases || 0,
    csvField(v.talabat_reason || ''),
    v.clusterRiskScore || 0,
    '', // riskLevel at cluster level isn't per-vendor; leave blank
    repLevel,
    appearances,
    alertTriggered ? 'yes' : 'no',
    'no',  // alert_sent — will be flipped by mark_alerts_sent.js after drafts created
  ].join(',');

  newLines.push(row);
}

if (newLines.length === 0) {
  console.log('No offenders found to append.');
  process.exit(0);
}

appendFileSync(TRACKER_PATH, newLines.join('\n') + '\n');

const alertCount = newLines.filter(l => l.endsWith(',yes,no')).length;
console.log(JSON.stringify({
  status:       'SUCCESS',
  run_date:     RUN_DATE,
  rows_appended: newLines.length,
  alerts_flagged: alertCount,
  tracker_path: 'tracker/offenders_tracker.csv',
}));
