#!/usr/bin/env node
/**
 * generate_data.js — Synthetic daily data generator
 *
 * Reads the most recent available cluster_data file from mcp_data/ and
 * produces a new one for the requested date by applying realistic random
 * variance.  Use this when Looker is not available.
 *
 * Usage:
 *   node generate_data.js                   # generates for today
 *   node generate_data.js 2026-07-01        # generates for a specific date
 *   node generate_data.js --list            # list available data files
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

if (!existsSync(MCP_DATA_DIR)) mkdirSync(MCP_DATA_DIR, { recursive: true });

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPrevDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function findLatestDataFile() {
  const files = readdirSync(MCP_DATA_DIR)
    .filter(f => /^cluster_data_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('No cluster_data files found in mcp_data/');
  return join(MCP_DATA_DIR, files[0]);
}

/** Apply variance: scale a number by (1 + drift) where drift ~ N(0, stdDev) */
function vary(value, stdDev = 0.04) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // Box-Muller
  return Math.max(0, value * (1 + z * stdDev));
}

function varyInt(value, stdDev = 0.04) {
  return Math.round(vary(value, stdDev));
}

function generateCityRow(city, prevRow) {
  const allOrders = varyInt(prevRow.all_orders, 0.03);
  const failRate = Math.max(0.001, vary(prevRow.vendor_fail_rate, 0.06));
  const failedOrders = Math.round(allOrders * failRate);
  const successfulOrders = allOrders - failedOrders;
  const gmvPerOrder = prevRow.gmv_lc / Math.max(prevRow.successful_orders || 1, 1);
  const gmv = successfulOrders * vary(gmvPerOrder, 0.02);
  const lostGmvPerFailed = prevRow.failed_orders > 0 ? prevRow.lost_gmv_lc / prevRow.failed_orders : 0;
  const lostGmv = failedOrders * vary(lostGmvPerFailed, 0.05);
  const partialRefundOrders = varyInt(prevRow.partial_refund_orders || 0, 0.08);
  const partialRefund = partialRefundOrders * vary((prevRow.partial_refund_lc || 0) / Math.max(prevRow.partial_refund_orders || 1, 1), 0.03);
  const vendorFaultCases = varyInt(prevRow.vendor_fault_cases || Math.round(failedOrders * 0.15), 0.08);

  return {
    city: prevRow.city,
    cluster: prevRow.cluster,
    all_orders: allOrders,
    failed_orders: failedOrders,
    successful_orders: successfulOrders,
    gmv_lc: +gmv.toFixed(2),
    lost_gmv_lc: +lostGmv.toFixed(2),
    vendor_fail_rate: +failRate.toFixed(6),
    partial_refund_lc: +partialRefund.toFixed(2),
    partial_refund_orders: partialRefundOrders,
    vendor_fault_cases: vendorFaultCases,
  };
}

function generateYesterdayRow(todayRow) {
  return {
    city: todayRow.city,
    cluster: todayRow.cluster,
    all_orders: varyInt(todayRow.all_orders, 0.025),
    failed_orders: varyInt(todayRow.failed_orders, 0.05),
    successful_orders: varyInt(todayRow.successful_orders || todayRow.all_orders - todayRow.failed_orders, 0.025),
    gmv_lc: +vary(todayRow.gmv_lc, 0.025).toFixed(2),
    lost_gmv_lc: +vary(todayRow.lost_gmv_lc, 0.05).toFixed(2),
    vendor_fail_rate: +Math.max(0.001, vary(todayRow.vendor_fail_rate, 0.05)).toFixed(6),
    partial_refund_lc: +vary(todayRow.partial_refund_lc || 0, 0.05).toFixed(2),
    partial_refund_orders: varyInt(todayRow.partial_refund_orders || 0, 0.08),
    vendor_fault_cases: varyInt(todayRow.vendor_fault_cases || 0, 0.08),
  };
}

function generateOffenderRow(prev) {
  const failedOrders  = varyInt(prev.failed_orders || prev.vendor_net_failed || 0, 0.06);
  const lostGmv       = vary(prev.lost_gmv_lc || 0, 0.06);
  const allOrders     = varyInt(prev.all_orders || prev.net_orders || 0, 0.03);
  const late    = varyInt(prev.late_delivery_cases    || 0, 0.10);
  const missing = varyInt(prev.missing_items_cases    || 0, 0.10);
  const quality = varyInt(prev.order_quality_cases    || 0, 0.10);

  const base = {
    vendor_id:           prev.vendor_id || '',
    vendor:              prev.vendor || prev.vendor_name || '',
    vendor_name:         prev.vendor || prev.vendor_name || '',
    city:                prev.city,
    am_name:             prev.am_name  || '',
    am_email:            prev.am_email || '',
    is_key_vip:          prev.is_key_vip || false,
    net_orders:          allOrders,
    all_orders:          allOrders,
    vendor_net_failed:   failedOrders,
    failed_orders:       failedOrders,
    lost_gmv_lc:         +lostGmv.toFixed(2),
    vendor_fail_rate:    +(failedOrders / Math.max(allOrders, 1)).toFixed(6),
    fail_rate:           +(failedOrders / Math.max(allOrders, 1)).toFixed(6),
    late_delivery_cases: late,
    missing_items_cases: missing,
    order_quality_cases: quality,
    vendor_fault_cases:  late + missing + quality,
    talabat_reason:      prev.talabat_reason || '',
    partial_refund_lc:   Math.round(vary(prev.partial_refund_lc || 0, 0.05)),
  };
  if (prev.gmv_lc !== undefined) base.gmv_lc = +vary(prev.gmv_lc, 0.03).toFixed(2);
  return base;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const arg = process.argv[2];

if (arg === '--list') {
  const files = readdirSync(MCP_DATA_DIR)
    .filter(f => /^cluster_data_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (files.length === 0) { console.log('No data files found.'); process.exit(0); }
  console.log('Available cluster_data files:');
  files.forEach(f => console.log(' ', f));
  process.exit(0);
}

const targetDate = arg || getToday();
const outputPath = join(MCP_DATA_DIR, `cluster_data_${targetDate}.json`);

if (existsSync(outputPath)) {
  console.error(`File already exists: cluster_data_${targetDate}.json`);
  console.error('Delete it first or choose a different date.');
  process.exit(1);
}

const sourceFile = findLatestDataFile();
const source = JSON.parse(readFileSync(sourceFile, 'utf-8'));
const prevDate = source.run_date;

console.log(`Generating cluster_data_${targetDate}.json from ${prevDate} data...`);

const todayCities = source.today.city_performance.map(row => generateCityRow(row.city, row));
const yesterdayCities = todayCities.map(generateYesterdayRow);

const topOffenders = {};
for (const [cluster, vendors] of Object.entries(source.top_offenders)) {
  topOffenders[cluster] = vendors.map(generateOffenderRow);
}

const output = {
  run_date: targetDate,
  comparison_date: getPrevDate(targetDate),
  source: `Generated by generate_data.js from ${prevDate} — mirrors Looker MCP shape. NOT real Looker data.`,
  today: { city_performance: todayCities },
  yesterday: { city_performance: yesterdayCities },
  top_offenders: topOffenders,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`✓ Written: mcp_data/cluster_data_${targetDate}.json`);
console.log(`  Cities: ${todayCities.length}`);
console.log(`  Clusters in top_offenders: ${Object.keys(topOffenders).join(', ')}`);
