#!/usr/bin/env node
/**
 * step_gmail_monitor.js
 *
 * Finds all open communications (email_sent=true, response_received=false,
 * email_thread_id != null) and writes a payload for the MCP Gmail monitor step.
 *
 * Non-blocking: exits 0 even if no pending threads.
 *
 * Usage:  node step_gmail_monitor.js 2026-06-24
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadMasterTracker, getOpenCommunications } from './lib/master_tracker_store.js';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

const RUN_DATE = process.argv[2];
if (!RUN_DATE) {
  console.error('Usage: node step_gmail_monitor.js <YYYY-MM-DD>');
  process.exit(1);
}

if (!existsSync(MCP_DATA_DIR)) mkdirSync(MCP_DATA_DIR, { recursive: true });

// ── Load and filter ───────────────────────────────────────────────────────────
const data = loadMasterTracker();
const openComms = getOpenCommunications(data);

// Only include those with an actual thread ID
const pendingThreads = openComms
  .filter(c => c.email_thread_id)
  .map(c => ({
    thread_id:       c.email_thread_id,
    vendor_key:      c.vendor_key,
    vendor_name:     c.vendor_name,
    am_email:        c.am_email,
    email_sent_date: c.email_sent_date || null,
  }));

const outFile = join(MCP_DATA_DIR, `gmail_monitor_payload_${RUN_DATE}.json`);
writeFileSync(outFile, JSON.stringify({
  date:           RUN_DATE,
  pendingThreads,
}, null, 2));

console.log(JSON.stringify({
  status:             'SUCCESS',
  pendingThreadCount: pendingThreads.length,
  date:               RUN_DATE,
  output_file:        `mcp_data/gmail_monitor_payload_${RUN_DATE}.json`,
}));
