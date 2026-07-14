#!/usr/bin/env node
/**
 * parse_sheet_feed.js
 *
 * Reads a raw Google Sheets MCP export (JSON: { fileContent: string })
 * and normalises it into the cluster_data_YYYY-MM-DD.json format used
 * by mcp_bridge_runner.js.
 *
 * Usage:
 *   node parse_sheet_feed.js <sheet_raw_file> [run_date]
 *
 * Example:
 *   node parse_sheet_feed.js mcp_data/sheet_raw_2026-06-24.json 2026-06-24
 *   node parse_sheet_feed.js mcp_data/sheet_raw_2026-06-24.json   # auto-detect latest date
 *
 * The sheet_raw_file is produced by Claude calling:
 *   mcp__bd165437__read_file_content({ fileId: "1W_4kxTBPa6OzZYcjf3_1tXRNH1YUwzZXBnZBFcZyFys" })
 * and saving the result to mcp_data/sheet_raw_YYYY-MM-DD.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config', 'agents.config.json');
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

// ─── section start markers (from empirical analysis of the MCP output format) ────
const MARKERS = {
  city:       '\n\n| City Name | Local Order Date | GMV Value Point (LC)',
  vendor:     '\n\n| Vendor Id | Vendor Name (English) | City Name | Latest Vendor AM Name',
  failReason: '\n\n| Vendor Name (English) | City Name | Talabat Reason',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseNum(val) {
  if (!val || val === '-' || val === '') return 0;
  return parseFloat(String(val).replace(/,/g, '').trim()) || 0;
}

/** Handles "0.81%", "0.0081", "81" (treated as already decimal if < 1) */
function parseRate(val) {
  if (!val || val === '-' || val === '') return 0;
  const s = String(val).trim();
  if (s.endsWith('%')) {
    const pct = parseFloat(s) || 0;
    return pct / 100; // 0.81% → 0.0081
  }
  const n = parseFloat(s) || 0;
  return n > 1 ? n / 100 : n; // "1.31" → 0.0131,  "0.0081" → 0.0081
}

function parseBool(val) {
  return String(val || '').trim().toLowerCase() === 'yes';
}

/**
 * Extract a Markdown pipe-table section from the full content string.
 * Returns array of row objects keyed by column header.
 */
function extractSection(content, startMarker) {
  const idx = content.indexOf(startMarker);
  if (idx === -1) return [];

  // Slice from the marker (skip the leading \n\n) to the next blank line
  const sliceStart = idx + 2; // skip "\n\n"
  const rest = content.slice(sliceStart);
  const endIdx = rest.indexOf('\n\n');
  const tableText = endIdx !== -1 ? rest.slice(0, endIdx) : rest;

  const lines = tableText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header row  "| Col1 | Col2 | Col3 |"
  const headers = lines[0]
    .split(' | ')
    .map(h => h.replace(/^\||\|$/g, '').trim())
    .filter(Boolean);

  // Skip alignment row "| :-: | :-: |"
  const dataLines = lines.slice(2);

  return dataLines.map(line => {
    const cells = line
      .split(' | ')
      .map(c => c.replace(/^\||\|$/g, '').replace(/\\_/g, '_').trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] !== undefined ? cells[i] : ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

/** Build city→cluster lookup (lowercase keys for resilience) */
function buildCityClusterMap() {
  const map = {};
  for (const [city, cluster] of Object.entries(config.cityToCluster || {})) {
    map[city.toLowerCase()] = cluster;
  }
  return map;
}

function clusterNameFor(key) {
  return config.clusters[key]?.name || key;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, rawFilePath, dateArg] = process.argv;
if (!rawFilePath) {
  console.error('Usage: node parse_sheet_feed.js <sheet_raw_file> [run_date]');
  process.exit(1);
}

const absPath = rawFilePath.startsWith('/') || rawFilePath.match(/^[A-Z]:/i)
  ? rawFilePath
  : join(__dirname, rawFilePath);

if (!existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(absPath, 'utf-8'));
const content = raw.fileContent || raw;
if (!content || typeof content !== 'string') {
  console.error('Expected { fileContent: string } but got unexpected format');
  process.exit(1);
}

console.log(`Parsing sheet raw file (${Math.round(content.length / 1024)}KB)...`);

// ── Extract sections ──────────────────────────────────────────────────────────
const cityRows       = extractSection(content, MARKERS.city);
const vendorRows     = extractSection(content, MARKERS.vendor);
const failReasonRows = extractSection(content, MARKERS.failReason);

console.log(`  City rows: ${cityRows.length}, Vendor rows: ${vendorRows.length}, Fail Reason rows: ${failReasonRows.length}`);

if (cityRows.length === 0 || vendorRows.length === 0) {
  console.error('Could not extract feed sections. Check the sheet_raw file format.');
  process.exit(1);
}

// ── Determine run date and comparison date from city data ─────────────────────
const allDates = [...new Set(cityRows.map(r => r['Local Order Date']).filter(Boolean))].sort();
if (allDates.length === 0) {
  console.error('No dates found in city feed.');
  process.exit(1);
}

const latestDate = allDates[allDates.length - 1];
const prevDate   = allDates.length > 1 ? allDates[allDates.length - 2] : null;
const runDate    = dateArg || latestDate;

console.log(`  Date range in feed: ${allDates[0]} → ${latestDate}`);
console.log(`  Run date: ${runDate}, comparison date: ${prevDate || 'N/A'}`);

// ── Build city performance rows for today and yesterday ───────────────────────
const cityClusterMap = buildCityClusterMap();

function normaliseCityPerf(rows, dateFilter) {
  const filtered = dateFilter ? rows.filter(r => r['Local Order Date'] === dateFilter) : rows;

  return filtered.map(r => {
    const cityName = r['City Name'];
    const clusterKey = cityClusterMap[cityName.toLowerCase()] || null;
    if (!clusterKey) return null; // city not in config — skip

    return {
      city:                  cityName,
      cluster:               clusterKey,
      all_orders:            parseNum(r['Net Orders']),
      failed_orders:         parseNum(r['Vendor Net Failed Orders']),
      successful_orders:     parseNum(r['Net Orders']) - parseNum(r['Vendor Net Failed Orders']),
      gmv_lc:                parseNum(r['GMV Value Point (LC)']),
      lost_gmv_lc:           parseNum(r['Lost GMV Amount (LC)']),
      vendor_fail_rate:      parseRate(r['Vendor Net Fail Rate']),
      partial_refund_lc:     parseNum(r['Partial Refund amount (LC)']),
      partial_refund_orders: parseNum(r['Partial Refund Orders']),
      vendor_fault_cases:    0, // will be filled in from vendor feed aggregation below
    };
  }).filter(Boolean);
}

const todayCityPerf = normaliseCityPerf(cityRows, latestDate);
const yesterdayCityPerf = prevDate ? normaliseCityPerf(cityRows, prevDate) : [];

// ── Build vendor-level map with fault cases, aggregated per city ──────────────
const cityFaultCasesMap = {}; // cityName → total vendor_fault_cases

for (const v of vendorRows) {
  const city = v['City Name'];
  const late    = parseNum(v['Vendor Fault Incoming Cases (Late Delivery)']);
  const missing = parseNum(v['Vendor Fault Incoming Cases (Missing Items)']);
  const quality = parseNum(v['Vendor Fault Incoming Cases (Order Quality)']);
  cityFaultCasesMap[city] = (cityFaultCasesMap[city] || 0) + late + missing + quality;
}

// Inject aggregated vendor_fault_cases back into city performance rows
for (const row of todayCityPerf) {
  row.vendor_fault_cases = cityFaultCasesMap[row.city] || 0;
}

// ── Build fail reason map: vendorName → top reason ────────────────────────────
const reasonMap = {}; // vendorName → { reason: count }
for (const r of failReasonRows) {
  const name   = r['Vendor Name (English)'];
  const reason = r['Talabat Reason'];
  const failed = parseNum(r['Vendor Net Failed Orders']);
  if (!name || !reason) continue;
  if (!reasonMap[name]) reasonMap[name] = {};
  reasonMap[name][reason] = (reasonMap[name][reason] || 0) + failed;
}

function topReason(vendorName) {
  const reasons = reasonMap[vendorName];
  if (!reasons) return '';
  return Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

// ── Build top offenders per cluster from vendor feed ─────────────────────────
const clusterVendors = {}; // clusterKey → [vendor rows]

for (const v of vendorRows) {
  const city = v['City Name'];
  const clusterKey = cityClusterMap[city.toLowerCase()];
  if (!clusterKey) continue;
  if (!clusterVendors[clusterKey]) clusterVendors[clusterKey] = [];
  clusterVendors[clusterKey].push(v);
}

// Key accounts: Is Key VIP Account (Yes / No) = Yes
const keyAccountVendors = vendorRows.filter(v => parseBool(v['Is Key VIP Account (Yes / No)']));

function buildOffenderRow(v, clusterKey) {
  const late    = parseNum(v['Vendor Fault Incoming Cases (Late Delivery)']);
  const missing = parseNum(v['Vendor Fault Incoming Cases (Missing Items)']);
  const quality = parseNum(v['Vendor Fault Incoming Cases (Order Quality)']);
  const netOrders = parseNum(v['Net Orders']);
  const netFailed = parseNum(v['Vendor Net Failed Orders']);

  return {
    vendor_id:           String(v['Vendor Id'] || v['Vendor ID'] || '').trim(),
    vendor:              v['Vendor Name (English)'],
    vendor_name:         v['Vendor Name (English)'],
    city:                v['City Name'],
    am_name:             v['Latest Vendor AM Name'] || '',
    am_email:            v['Latest Vendor AM Email'] || '',
    team_leader:         v['Team Leader Name'] || '',
    is_key_vip:          parseBool(v['Is Key VIP Account (Yes / No)']),
    is_tgo:              parseBool(v['Is TGO (Yes / No)']),
    is_food:             parseBool(v['Is Food (Yes / No)']),
    all_orders:          netOrders,
    net_orders:          netOrders,
    failed_orders:       netFailed,
    vendor_net_failed:   netFailed,
    lost_gmv_lc:         parseNum(v['Lost GMV Amount (LC)']),
    fail_rate:           parseRate(v['Vendor Net Fail Rate']),
    vendor_fail_rate:    parseRate(v['Vendor Net Fail Rate']),
    late_delivery_cases: late,
    missing_items_cases: missing,
    order_quality_cases: quality,
    vendor_fault_cases:  late + missing + quality,
    talabat_reason:      topReason(v['Vendor Name (English)']),
    contact_reason_l3:   '',
    partial_refund_lc:   0,
  };
}

function topN(vendors, n = 10) {
  return vendors
    .map(v => buildOffenderRow(v))
    .sort((a, b) => b.failed_orders - a.failed_orders)
    .slice(0, n);
}

const topOffenders = {};
for (const [clusterKey, vendors] of Object.entries(clusterVendors)) {
  topOffenders[clusterKey] = topN(vendors, 10);
}
topOffenders['key_accounts'] = topN(keyAccountVendors, 10);

// ── Assemble final cluster_data JSON ─────────────────────────────────────────
const output = {
  run_date: runDate,
  comparison_date: prevDate,
  source: `Google Sheets MCP — Sheet ID 1W_4kxTBPa6OzZYcjf3_1tXRNH1YUwzZXBnZBFcZyFys — MTD data as of ${latestDate}`,
  today:     { city_performance: todayCityPerf },
  yesterday: { city_performance: yesterdayCityPerf },
  top_offenders: topOffenders,
};

const outFile = join(MCP_DATA_DIR, `cluster_data_${runDate}.json`);
writeFileSync(outFile, JSON.stringify(output, null, 2));

console.log(`\n✓ Written: mcp_data/cluster_data_${runDate}.json`);
console.log(`  Today cities: ${todayCityPerf.length}`);
console.log(`  Yesterday cities: ${yesterdayCityPerf.length}`);
console.log(`  Clusters with offenders: ${Object.keys(topOffenders).join(', ')}`);
console.log(`  Total top offenders: ${Object.values(topOffenders).reduce((s, a) => s + a.length, 0)}`);
