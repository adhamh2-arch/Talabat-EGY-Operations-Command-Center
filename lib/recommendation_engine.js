/**
 * lib/recommendation_engine.js
 *
 * Generates action recommendations for a vendor based on their top failure reason
 * and recurrence severity.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECO_CONFIG_PATH = join(__dirname, '..', 'config', 'recommendations.json');

// Inline defaults — used if config file doesn't exist
const DEFAULT_RECOMMENDATIONS = {
  reasons: {
    'Vendor Cancelled': [
      'Review peak-hour capacity and staffing plan',
      'Audit minimum order thresholds vs. kitchen capacity',
      'Conduct operational readiness review for high-volume periods',
      'Validate order acceptance rate settings in the app',
    ],
    'Restaurant Cancelled': [
      'Review peak-hour capacity and staffing plan',
      'Audit minimum order thresholds vs. kitchen capacity',
      'Conduct operational readiness review for high-volume periods',
      'Validate order acceptance rate settings in the app',
    ],
    'Late Delivery': [
      'Review kitchen preparation time vs. promised delivery SLA',
      'Audit rider assignment and handover delays at peak hours',
      'Validate dispatch timing relative to prep completion',
      'Conduct peak-period operational audit with AM on-site visit',
    ],
    'Delayed': [
      'Review kitchen preparation time vs. promised delivery SLA',
      'Audit rider assignment and handover delays at peak hours',
      'Validate dispatch timing relative to prep completion',
      'Conduct peak-period operational audit with AM on-site visit',
    ],
    'Missing Items': [
      'Implement per-SKU packaging checklist for kitchen staff',
      'Conduct staff retraining on order completeness verification',
      'Add QA checkpoint before handing order to rider',
      'Review inventory availability vs. active menu items',
    ],
    'Incomplete Order': [
      'Implement per-SKU packaging checklist for kitchen staff',
      'Conduct staff retraining on order completeness verification',
      'Add QA checkpoint before handing order to rider',
      'Review inventory availability vs. active menu items',
    ],
    'Order Quality': [
      'Implement food quality standards checklist at dispatch',
      'Review storage temperature compliance and cold-chain handling',
      'Conduct kitchen hygiene and food preparation audit',
      'Add supervisor sign-off for high-value orders',
    ],
    'Food Quality': [
      'Implement food quality standards checklist at dispatch',
      'Review storage temperature compliance and cold-chain handling',
      'Conduct kitchen hygiene and food preparation audit',
      'Add supervisor sign-off for high-value orders',
    ],
    'Vendor Closed': [
      'Align app listing hours with actual operating hours',
      'Implement automated availability toggle at open/close',
      'Review and update holiday/special hours schedule',
    ],
    'Closed': [
      'Align app listing hours with actual operating hours',
      'Implement automated availability toggle at open/close',
      'Review and update holiday/special hours schedule',
    ],
    '_default': [
      'Conduct comprehensive operational review with the vendor',
      'Identify root cause through AM field visit',
      'Review all fail reason categories for this vendor in Looker',
      'Assess peak-hour staffing and operational capacity',
    ],
  },
  urgencyPrefix: {
    High: '⚠️ Recurring issue — ',
    Critical: '🚨 CRITICAL recurring offender — ',
  },
  escalationThresholdDays: 3,
};

let _config = null;

function loadConfig() {
  if (_config) return _config;
  if (existsSync(RECO_CONFIG_PATH)) {
    try {
      _config = JSON.parse(readFileSync(RECO_CONFIG_PATH, 'utf-8'));
      return _config;
    } catch {
      // fall through to defaults
    }
  }
  _config = DEFAULT_RECOMMENDATIONS;
  return _config;
}

/**
 * Find matching reason key via case-insensitive partial match.
 * @param {object} reasons - the reasons map from config
 * @param {string} topFailureReason
 * @returns {string[]} array of action strings
 */
function findActions(reasons, topFailureReason) {
  if (!topFailureReason) return reasons['_default'] || [];

  const needle = topFailureReason.toLowerCase();

  // First: try exact match (case-insensitive)
  for (const [key, actions] of Object.entries(reasons)) {
    if (key === '_default') continue;
    if (key.toLowerCase() === needle) return actions;
  }

  // Second: partial match — reason contains key or key contains reason
  for (const [key, actions] of Object.entries(reasons)) {
    if (key === '_default') continue;
    const keyLower = key.toLowerCase();
    if (needle.includes(keyLower) || keyLower.includes(needle)) return actions;
  }

  return reasons['_default'] || [];
}

/**
 * Generate a recommendation string for a vendor.
 *
 * @param {object} vendor
 * @param {string} vendor.top_failure_reason
 * @param {string} vendor.recurrence_severity  - 'Low' | 'Medium' | 'High' | 'Critical'
 * @param {number} vendor.consecutive_days
 * @param {string} vendor.cluster
 * @returns {string}
 */
export function generateRecommendation(vendor) {
  const cfg = loadConfig();
  const { reasons, urgencyPrefix, escalationThresholdDays } = cfg;

  const actions = findActions(reasons, vendor.top_failure_reason || '');

  // Format as numbered list
  let recommendation = actions
    .map((action, idx) => `${idx + 1}. ${action}`)
    .join('\n');

  // Prepend urgency prefix for High / Critical
  const severity = vendor.recurrence_severity || 'Low';
  if (severity === 'Critical' && urgencyPrefix.Critical) {
    recommendation = urgencyPrefix.Critical + recommendation;
  } else if (severity === 'High' && urgencyPrefix.High) {
    recommendation = urgencyPrefix.High + recommendation;
  }

  // Escalation note for consecutive days
  const consecDays = vendor.consecutive_days || 0;
  const threshold = escalationThresholdDays || 3;
  if (consecDays >= threshold) {
    recommendation += `\nEscalation note: Vendor flagged for ${consecDays} consecutive days — escalate to Team Leader.`;
  }

  return recommendation;
}
