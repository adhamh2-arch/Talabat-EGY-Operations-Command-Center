/**
 * lib/recurrence_detector.js
 *
 * Computes recurrence severity and improvement status for tracked vendors.
 */

/**
 * Compute recurrence severity based on total appearances and consecutive days.
 *
 * @param {number} appearances      - total number of distinct dates vendor appeared
 * @param {number} consecutiveDays  - current consecutive day streak
 * @returns {'Critical'|'High'|'Medium'|'Low'}
 */
export function computeRecurrenceSeverity(appearances, consecutiveDays) {
  const a = appearances || 0;
  const c = consecutiveDays || 0;

  if (a >= 10 || c >= 7) return 'Critical';
  if (a >= 5  || c >= 3) return 'High';
  if (a >= 2)            return 'Medium';
  return 'Low';
}

/**
 * Compute improvement status by comparing current vs previous risk score and failed orders.
 *
 * @param {number|null} currentRiskScore
 * @param {number|null} previousRiskScore
 * @param {number|null} currentFailedOrders
 * @param {number|null} previousFailedOrders
 * @returns {'Improving'|'Deteriorating'|'Stable'|'New'}
 */
export function computeImprovementStatus(
  currentRiskScore,
  previousRiskScore,
  currentFailedOrders,
  previousFailedOrders
) {
  // New vendor — no previous data
  if (previousRiskScore === null || previousRiskScore === undefined || previousRiskScore === 0) {
    return 'New';
  }

  const riskDelta = (currentRiskScore || 0) - (previousRiskScore || 0);
  const prevFailed = previousFailedOrders || 0;
  const currFailed = currentFailedOrders || 0;

  // Improving: risk decreased > 5 AND failed orders decreased
  if (riskDelta < -5 && currFailed < prevFailed) {
    return 'Improving';
  }

  // Deteriorating: risk increased > 5 OR failed orders increased > 10%
  if (riskDelta > 5) return 'Deteriorating';
  if (prevFailed > 0 && currFailed > prevFailed * 1.1) return 'Deteriorating';

  return 'Stable';
}
