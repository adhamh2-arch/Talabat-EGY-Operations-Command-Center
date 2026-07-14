#!/usr/bin/env node
/**
 * step_recommend.js
 *
 * Generates action recommendations for all tracked vendors and stores
 * them back in master_tracker.json.
 *
 * Usage:  node step_recommend.js 2026-06-24
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadMasterTracker, saveMasterTracker } from './lib/master_tracker_store.js';
import { generateRecommendation } from './lib/recommendation_engine.js';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const MCP_DATA_DIR = join(__dirname, 'mcp_data');

const RUN_DATE = process.argv[2];
if (!RUN_DATE) {
  console.error('Usage: node step_recommend.js <YYYY-MM-DD>');
  process.exit(1);
}

// ── Load master tracker ───────────────────────────────────────────────────────
const data  = loadMasterTracker();
const cases = data.cases;

// ── Build talabat_reason map from scored_output (vendor_name → reason) ────────
const reasonMap = {};
const scoredFile = join(MCP_DATA_DIR, `scored_output_${RUN_DATE}.json`);

if (existsSync(scoredFile)) {
  try {
    const scored = JSON.parse(readFileSync(scoredFile, 'utf-8'));

    for (const cr of (scored.clusterResults || [])) {
      for (const v of (cr.topOffenders || [])) {
        const name = v.vendor || v.vendor_name || '';
        if (name && v.talabat_reason) {
          reasonMap[name] = v.talabat_reason;
        }
      }
    }
    for (const v of (scored.keyAccounts?.topOffenders || [])) {
      const name = v.vendor || v.vendor_name || '';
      if (name && v.talabat_reason) {
        reasonMap[name] = v.talabat_reason;
      }
    }
  } catch (err) {
    console.error(`[step_recommend] Warning: could not parse scored_output: ${err.message}`);
  }
}

// ── Generate recommendations for all cases ────────────────────────────────────
let vendorsWithRecommendations = 0;

for (const [key, c] of Object.entries(cases)) {
  // Update top_failure_reason from scored_output if available
  if (reasonMap[c.vendor_name]) {
    c.top_failure_reason = reasonMap[c.vendor_name];
  }

  // Generate recommendation
  const recommendation = generateRecommendation({
    top_failure_reason:  c.top_failure_reason || '',
    recurrence_severity: c.recurrence_severity || 'Low',
    consecutive_days:    c.consecutive_days || 1,
    cluster:             c.cluster || '',
  });

  c.recommended_action = recommendation;
  vendorsWithRecommendations++;
}

// ── Save ──────────────────────────────────────────────────────────────────────
saveMasterTracker({ cases });

console.log(JSON.stringify({
  status:                    'SUCCESS',
  vendorsWithRecommendations,
  date:                      RUN_DATE,
}));
