#!/usr/bin/env node
/**
 * step_upsert_master.js
 *
 * Reads scored_output_<date>.json and upserts every vendor into the
 * persistent master_tracker.json (JSON on disk).  Replaces step_append_tracker.js.
 *
 * Usage:  node step_upsert_master.js 2026-06-24
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  loadMasterTracker,
  saveMasterTracker,
  appendHistory,
} from './lib/master_tracker_store.js';
import { computeRecurrenceSeverity, computeImprovementStatus } from './lib/recurrence_detector.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH  = join(__dirname, 'config', 'agents.config.json');
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

const RUN_DATE = process.argv[2];
if (!RUN_DATE) {
  console.error('Usage: node step_upsert_master.js <YYYY-MM-DD>');
  process.exit(1);
}

// ── Load dependencies ─────────────────────────────────────────────────────────
const config   = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
const alertCfg = config.alerting;

const scoredFile = join(MCP_DATA_DIR, `scored_output_${RUN_DATE}.json`);
if (!existsSync(scoredFile)) {
  console.error(`scored_output_${RUN_DATE}.json not found. Run mcp_bridge_runner.js first.`);
  process.exit(1);
}

const scored = JSON.parse(readFileSync(scoredFile, 'utf-8'));
const data   = loadMasterTracker();
const cases  = data.cases;

// ── Thresholds ────────────────────────────────────────────────────────────────
const triggers = alertCfg.triggers || {};
const LOST_GMV_THRESHOLD   = triggers.lostGmvThreshold        ?? 100000;
const FAIL_RATE_THRESHOLD  = triggers.vendorFailRateThreshold != null
  ? (triggers.vendorFailRateThreshold < 1 ? triggers.vendorFailRateThreshold * 100 : triggers.vendorFailRateThreshold)
  : 3.0;
const FAULT_THRESHOLD      = triggers.vendorFaultCasesThreshold ?? 100;
const KEY_VIP_THRESHOLD    = triggers.keyAccountFailedThreshold ?? 50;

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateMinus(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function dateDiffDays(a, b) {
  // Returns a - b in days
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round((da - db) / 86400000);
}

// ── Collect all vendors from scored output ────────────────────────────────────
const vendorsToday = []; // { vendorData, cluster, daily_rank, clusterRiskScore, is_key_vip }

// Cluster top offenders
for (const clusterResult of (scored.clusterResults || [])) {
  const cluster          = clusterResult.cluster || clusterResult.name?.toLowerCase().replace(' ', '_');
  const clusterRiskScore = clusterResult.riskScore || 0;

  for (let i = 0; i < (clusterResult.topOffenders || []).length; i++) {
    const v = clusterResult.topOffenders[i];
    vendorsToday.push({
      vendorData:      v,
      cluster,
      daily_rank:      i + 1,
      clusterRiskScore,
      is_key_vip:      v.is_key_vip || false,
    });
  }
}

// Key accounts
for (let i = 0; i < (scored.keyAccounts?.topOffenders || []).length; i++) {
  const v = scored.keyAccounts.topOffenders[i];
  vendorsToday.push({
    vendorData:      v,
    cluster:         'key_accounts',
    daily_rank:      i + 1,
    clusterRiskScore: 0,
    is_key_vip:      true,
  });
}

// ── Dedup: keep first occurrence per vendor+cluster ───────────────────────────
const seenKeys = new Set();
const uniqueVendors = [];
for (const item of vendorsToday) {
  const v    = item.vendorData;
  const name = v.vendor || v.vendor_name || 'UNKNOWN';
  const key  = `${name}|${item.cluster}`;
  if (seenKeys.has(key)) continue;
  seenKeys.add(key);
  uniqueVendors.push({ ...item, vendor_key: key, vendor_name: name });
}

// ── Upsert each vendor ────────────────────────────────────────────────────────
let newCases     = 0;
let updatedCases = 0;
const historyRows = [];
const seenTodayKeys = new Set();

for (const item of uniqueVendors) {
  const { vendor_key, vendor_name, cluster, daily_rank, clusterRiskScore, is_key_vip, vendorData: v } = item;

  seenTodayKeys.add(vendor_key);

  // ── Extract fields ──────────────────────────────────────────────────────────
  const failed_orders     = v.vendor_net_failed ?? v.failedOrders ?? 0;
  const lost_gmv          = v.lostGmv ?? 0;
  const raw_fail_rate     = v.failRate ?? 0;
  const fail_rate         = raw_fail_rate < 1 ? raw_fail_rate * 100 : raw_fail_rate;
  const vendor_fault_cases = v.vendor_fault_cases ?? 0;
  const talabat_reason    = v.talabat_reason || '';

  if (cases[vendor_key]) {
    // ── UPDATE existing case ──────────────────────────────────────────────────
    const c = cases[vendor_key];

    c.appearances = (c.appearances || 0) + 1;

    // Consecutive days: if last_seen_date was yesterday → +1, else reset to 1
    const lastSeen = c.last_seen_date;
    if (lastSeen && dateDiffDays(RUN_DATE, lastSeen) === 1) {
      c.consecutive_days = (c.consecutive_days || 0) + 1;
    } else {
      c.consecutive_days = 1;
    }

    // Risk score tracking
    c.previous_risk_score = c.current_risk_score || 0;
    c.current_risk_score  = clusterRiskScore;
    c.risk_score_change   = c.current_risk_score - c.previous_risk_score;

    // Rank tracking
    c.previous_rank = c.current_rank || daily_rank;
    c.current_rank  = daily_rank;
    if (c.current_rank < c.previous_rank) {
      c.rank_movement = 'up';    // lower number = better rank
    } else if (c.current_rank > c.previous_rank) {
      c.rank_movement = 'down';
    } else {
      c.rank_movement = 'stable';
    }

    // Historical rank bounds
    const existingHighest = c.historical_highest_rank ?? c.current_rank;
    const existingLowest  = c.historical_lowest_rank  ?? c.current_rank;
    c.historical_highest_rank = Math.min(existingHighest, daily_rank);
    c.historical_lowest_rank  = Math.max(existingLowest,  daily_rank);

    // Improvement status
    c.improvement_status = computeImprovementStatus(
      c.current_risk_score,
      c.previous_risk_score,
      failed_orders,
      c.last_failed_orders
    );

    // Recurrence
    c.recurrence_severity = computeRecurrenceSeverity(c.appearances, c.consecutive_days);

    // Update data fields
    c.last_detection_date   = RUN_DATE;
    c.last_seen_date        = RUN_DATE;
    c.is_active             = true;
    c.last_failed_orders    = failed_orders;
    c.last_lost_gmv         = lost_gmv;
    c.last_fail_rate        = fail_rate;
    c.last_vendor_fault_cases = vendor_fault_cases;
    if (talabat_reason) c.top_failure_reason = talabat_reason;

    updatedCases++;
  } else {
    // ── INSERT new case ────────────────────────────────────────────────────────
    cases[vendor_key] = {
      vendor_key,
      vendor_name,
      chain_name:             v.chain_name || vendor_name,
      cluster,
      city:                   v.city || '',
      am_name:                v.am_name || '',
      am_email:               v.am_email || '',
      is_key_vip:             is_key_vip || v.is_key_vip || false,

      first_detection_date:   RUN_DATE,
      last_detection_date:    RUN_DATE,
      last_seen_date:         RUN_DATE,
      appearances:            1,
      consecutive_days:       1,

      previous_risk_score:    null,
      current_risk_score:     clusterRiskScore,
      risk_score_change:      0,

      previous_rank:          null,
      current_rank:           daily_rank,
      rank_movement:          'stable',
      historical_highest_rank: daily_rank,
      historical_lowest_rank:  daily_rank,

      recurrence_severity:    'Low',
      improvement_status:     'New',

      last_failed_orders:     failed_orders,
      last_lost_gmv:          lost_gmv,
      last_fail_rate:         fail_rate,
      last_vendor_fault_cases: vendor_fault_cases,
      top_failure_reason:     talabat_reason,

      is_active:              true,
      email_required:         false,
      email_sent:             false,
      email_sent_date:        null,
      email_thread_id:        null,
      response_received:      false,
      response_classification: null,
      communication_status:   'none',
      vendor_action_required: false,
      vendor_action_completed: false,
      action_verification_status: null,
      recommended_action:     '',
    };

    newCases++;
  }

  // ── Alert triggering ────────────────────────────────────────────────────────
  const c = cases[vendor_key];
  const alertTriggered =
    c.last_lost_gmv >= LOST_GMV_THRESHOLD ||
    c.last_fail_rate >= FAIL_RATE_THRESHOLD ||
    c.last_vendor_fault_cases >= FAULT_THRESHOLD ||
    (c.is_key_vip && c.last_failed_orders >= KEY_VIP_THRESHOLD) ||
    ['High', 'Critical'].includes(c.recurrence_severity);

  c.email_required = alertTriggered;

  // ── Build history row ───────────────────────────────────────────────────────
  historyRows.push({
    date:                    RUN_DATE,
    vendor_key,
    vendor_name,
    cluster,
    city:                    c.city,
    am_name:                 c.am_name,
    am_email:                c.am_email,
    is_key_vip:              c.is_key_vip,
    daily_rank,
    cluster_risk_score:      clusterRiskScore,
    failed_orders,
    lost_gmv,
    fail_rate,
    vendor_fault_cases,
    talabat_reason,
    appearances:             c.appearances,
    consecutive_days:        c.consecutive_days,
    recurrence_severity:     c.recurrence_severity,
    improvement_status:      c.improvement_status,
    alert_triggered:         alertTriggered,
  });
}

// ── Mark inactive: not seen today AND last_seen_date < (date - 2 days) ───────
const cutoffDate = dateMinus(RUN_DATE, 2);
for (const [key, c] of Object.entries(cases)) {
  if (!seenTodayKeys.has(key) && c.last_seen_date && c.last_seen_date < cutoffDate) {
    c.is_active = false;
  }
}

// ── Persist ───────────────────────────────────────────────────────────────────
appendHistory(historyRows);
saveMasterTracker({ cases });

const alertsTriggered = Object.values(cases).filter(
  c => c.email_required && seenTodayKeys.has(c.vendor_key)
).length;

console.log(JSON.stringify({
  status:          'SUCCESS',
  vendorsUpserted: uniqueVendors.length,
  newCases,
  updatedCases,
  alertsTriggered,
  date:            RUN_DATE,
}));
