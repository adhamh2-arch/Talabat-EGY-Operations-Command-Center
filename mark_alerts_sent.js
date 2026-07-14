#!/usr/bin/env node
/**
 * mark_alerts_sent.js
 *
 * After Gmail drafts have been created via MCP, call this script to
 * flip alert_sent=no → alert_sent=yes in the tracker CSV for all
 * rows matching the run date.
 *
 * Usage:  node mark_alerts_sent.js 2026-06-24
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const TRACKER_PATH = join(__dirname, 'tracker', 'offenders_tracker.csv');

const RUN_DATE = process.argv[2];
if (!RUN_DATE) {
  console.error('Usage: node mark_alerts_sent.js <YYYY-MM-DD>');
  process.exit(1);
}

if (!existsSync(TRACKER_PATH)) {
  console.error('Tracker file not found:', TRACKER_PATH);
  process.exit(1);
}

const content = readFileSync(TRACKER_PATH, 'utf-8');
const lines   = content.split('\n');

const header = lines[0];
const cols   = header.split(',');
const dateIdx   = cols.indexOf('date');
const sentIdx   = cols.indexOf('alert_sent');
const trigIdx   = cols.indexOf('alert_triggered');

if (dateIdx === -1 || sentIdx === -1) {
  console.error('Tracker CSV missing expected columns (date, alert_sent).');
  process.exit(1);
}

let updated = 0;
const newLines = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;
  const parts = line.split(',');
  const lineDate = parts[dateIdx]?.trim();
  const triggered = parts[trigIdx]?.trim();
  const sent      = parts[sentIdx]?.trim();
  if (lineDate === RUN_DATE && triggered === 'yes' && sent === 'no') {
    parts[sentIdx] = 'yes';
    updated++;
    return parts.join(',');
  }
  return line;
});

writeFileSync(TRACKER_PATH, newLines.join('\n'));

console.log(JSON.stringify({
  status:    'SUCCESS',
  run_date:  RUN_DATE,
  rows_updated: updated,
  message:   `Marked ${updated} tracker row(s) as alert_sent=yes`,
}));
