import { getSheetsConfig } from './config_loader.js';
import { logStep } from './utils.js';

export async function appendToSheet({ sheetName, rows, traceId, dry_run = false }) {
  const config = getSheetsConfig();
  const resolvedSheet = config.sheets[sheetName] || sheetName;

  logStep('sheets.append', {
    traceId,
    sheet: resolvedSheet,
    rowCount: rows.length,
    dry_run,
  });

  if (dry_run || !config.spreadsheetId) {
    logStep('sheets.stub', {
      traceId,
      reason: dry_run ? 'dry_run' : 'no_spreadsheet_id_configured',
      sheet: resolvedSheet,
      sampleRow: rows[0] || null,
    });
    return {
      updated: false,
      stub: true,
      sheet: resolvedSheet,
      rowCount: rows.length,
      rows,
    };
  }

  // Production: use Google Sheets API
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const values = rows.map(row => config.headers.map(h => row[h] ?? ''));

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `'${resolvedSheet}'!A:N`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  logStep('sheets.appended', {
    traceId,
    sheet: resolvedSheet,
    updatedRange: response.data.updates?.updatedRange,
    updatedRows: response.data.updates?.updatedRows,
  });

  return {
    updated: true,
    sheet: resolvedSheet,
    rowCount: rows.length,
    updatedRange: response.data.updates?.updatedRange,
  };
}

export async function readSheet({ sheetName, range, traceId, dry_run = false }) {
  const config = getSheetsConfig();
  const resolvedSheet = config.sheets[sheetName] || sheetName;

  if (dry_run || !config.spreadsheetId) {
    logStep('sheets.read.stub', { traceId, sheet: resolvedSheet, reason: dry_run ? 'dry_run' : 'no_spreadsheet_id' });
    return { rows: [], stub: true };
  }

  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const fullRange = range || `'${resolvedSheet}'!A:N`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: fullRange,
  });

  const rows = response.data.values || [];
  logStep('sheets.read', { traceId, sheet: resolvedSheet, rowCount: rows.length });
  return { rows, stub: false };
}

export function buildMonitoringRow({ date, agentName, cityOrSegment, entityName, metrics, riskScore, riskLevel, findings, recommendations, status }) {
  return {
    'Date': date,
    'Agent Name': agentName,
    'City / Segment': cityOrSegment,
    'Entity Name': entityName,
    'Order Count': metrics?.orderCount ?? '',
    'Total Revenue': metrics?.totalRevenue ?? '',
    'Avg Order Value': metrics?.averageOrderValue ?? '',
    'Total Quantity': metrics?.totalQuantity ?? '',
    'Risk Score': riskScore ?? '',
    'Risk Level': riskLevel ?? '',
    'Findings': Array.isArray(findings) ? findings.join('; ') : (findings || ''),
    'Recommended Actions': Array.isArray(recommendations) ? recommendations.join('; ') : (recommendations || ''),
    'Status': status || 'Completed',
    'Timestamp': new Date().toISOString(),
  };
}
