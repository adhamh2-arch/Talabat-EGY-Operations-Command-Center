/**
 * lib/master_tracker_store.js
 *
 * Canonical storage layer for the Master Tracker.
 * All reads/writes go through these functions.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRACKER_DIR = join(__dirname, '..', 'tracker');
const MASTER_FILE = join(TRACKER_DIR, 'master_tracker.json');
const HISTORY_FILE = join(TRACKER_DIR, 'history.jsonl');
const COMM_LOG_FILE = join(TRACKER_DIR, 'communication_log.jsonl');
const ACTION_LOG_FILE = join(TRACKER_DIR, 'action_log.jsonl');

/**
 * Reads master_tracker.json.
 * Returns { cases: {}, lastUpdated: null } if file doesn't exist.
 */
export function loadMasterTracker() {
  if (!existsSync(MASTER_FILE)) {
    return { cases: {}, lastUpdated: null };
  }
  try {
    const raw = readFileSync(MASTER_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return {
      cases: data.cases || {},
      lastUpdated: data.lastUpdated || null,
    };
  } catch (err) {
    console.error(`[master_tracker_store] Failed to parse master_tracker.json: ${err.message}`);
    return { cases: {}, lastUpdated: null };
  }
}

/**
 * Writes { cases, lastUpdated } to master_tracker.json.
 */
export function saveMasterTracker(data) {
  const payload = {
    cases: data.cases || {},
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(MASTER_FILE, JSON.stringify(payload, null, 2));
}

/**
 * Appends each row as a JSON line to history.jsonl.
 * @param {object[]} rows
 */
export function appendHistory(rows) {
  if (!rows || rows.length === 0) return;
  const lines = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  appendFileSync(HISTORY_FILE, lines);
}

/**
 * Appends one entry as a JSON line to communication_log.jsonl.
 * @param {object} entry
 */
export function appendCommunicationLog(entry) {
  const line = JSON.stringify({ ...entry, logged_at: new Date().toISOString() }) + '\n';
  appendFileSync(COMM_LOG_FILE, line);
}

/**
 * Appends one entry as a JSON line to action_log.jsonl.
 * @param {object} entry
 */
export function appendActionLog(entry) {
  const line = JSON.stringify({ ...entry, logged_at: new Date().toISOString() }) + '\n';
  appendFileSync(ACTION_LOG_FILE, line);
}

/**
 * Returns array of cases where is_active === true.
 * @param {object} data - the full tracker data ({ cases, lastUpdated })
 */
export function getActiveCases(data) {
  const cases = data.cases || {};
  return Object.values(cases).filter(c => c.is_active === true);
}

/**
 * Returns cases where email_sent === true AND response_received === false.
 * @param {object} data
 */
export function getOpenCommunications(data) {
  const cases = data.cases || {};
  return Object.values(cases).filter(
    c => c.email_sent === true && c.response_received === false
  );
}

/**
 * Reads history.jsonl line by line, filters by vendor_key and date within last N days.
 * Returns array sorted oldest first (max last 30 days enforced).
 * @param {string} vendorKey
 * @param {number} days
 * @returns {Promise<object[]>}
 */
export async function readRecentHistory(vendorKey, days) {
  const actualDays = Math.min(days, 30);
  if (!existsSync(HISTORY_FILE)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - actualDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return new Promise((resolve, reject) => {
    const results = [];
    const rl = createInterface({
      input: createReadStream(HISTORY_FILE),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const obj = JSON.parse(line);
        if (obj.vendor_key === vendorKey && obj.date >= cutoffStr) {
          results.push(obj);
        }
      } catch {
        // skip malformed lines
      }
    });

    rl.on('close', () => resolve(results));
    rl.on('error', reject);
  });
}
