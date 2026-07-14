import { getReportingConfig } from './config_loader.js';
import { logStep } from './utils.js';

export async function sendEmailReport({ subject, body, recipients, traceId, dry_run = false }) {
  const config = getReportingConfig();

  const resolvedRecipients = recipients || config.stakeholders
    .filter(s => s.receives.includes('daily_summary'))
    .map(s => s.email)
    .filter(Boolean);

  logStep('email.prepare', {
    traceId,
    subject,
    recipientCount: resolvedRecipients.length,
    bodyLength: body.length,
    dry_run,
  });

  if (dry_run || resolvedRecipients.length === 0) {
    logStep('email.stub', {
      traceId,
      reason: dry_run ? 'dry_run' : 'no_recipients_configured',
      subject,
      preview: body.slice(0, 200),
    });
    return {
      sent: false,
      stub: true,
      subject,
      recipients: resolvedRecipients,
      bodyLength: body.length,
    };
  }

  // Production: use Gmail API via Google Workspace
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
  });
  const gmail = google.gmail({ version: 'v1', auth: await auth.getClient() });

  const message = [
    `To: ${resolvedRecipients.join(', ')}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body,
  ].join('\n');

  const encoded = Buffer.from(message).toString('base64url');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  logStep('email.sent', { traceId, messageId: result.data.id, recipients: resolvedRecipients });

  return {
    sent: true,
    messageId: result.data.id,
    subject,
    recipients: resolvedRecipients,
  };
}

export function buildDailySummaryEmail({ date, portfolio, riskSummary, criticalIssues, agentSummaries }) {
  const subject = `[Ops Monitor] Daily Summary — ${date}`;

  let body = `<html><body style="font-family: Arial, sans-serif;">`;
  body += `<h2>Daily Operations Summary — ${date}</h2>`;

  body += `<h3>Performance Summary</h3>`;
  body += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">`;
  body += `<tr><td><b>Total Cities/Segments</b></td><td>${portfolio.entityCount}</td></tr>`;
  body += `<tr><td><b>Total Revenue</b></td><td>$${portfolio.totalRevenue?.toLocaleString() ?? 'N/A'}</td></tr>`;
  body += `<tr><td><b>Total Orders</b></td><td>${portfolio.totalOrders ?? 'N/A'}</td></tr>`;
  body += `<tr><td><b>Avg Order Value</b></td><td>$${portfolio.averageOrderValue?.toFixed(2) ?? 'N/A'}</td></tr>`;
  body += `</table>`;

  body += `<h3>Risk Summary</h3>`;
  body += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">`;
  body += `<tr><th>Level</th><th>Count</th></tr>`;
  for (const [level, count] of Object.entries(riskSummary || {})) {
    body += `<tr><td>${level}</td><td>${count}</td></tr>`;
  }
  body += `</table>`;

  if (criticalIssues?.length > 0) {
    body += `<h3 style="color: red;">Critical Issues</h3><ul>`;
    for (const issue of criticalIssues) {
      body += `<li><b>${issue.entity}</b>: ${issue.finding} (Score: ${issue.riskScore})</li>`;
    }
    body += `</ul>`;
  }

  if (agentSummaries?.length > 0) {
    body += `<h3>Agent Activity</h3>`;
    body += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">`;
    body += `<tr><th>Agent</th><th>Entities Processed</th><th>Issues Found</th><th>Status</th></tr>`;
    for (const a of agentSummaries) {
      body += `<tr><td>${a.name}</td><td>${a.entitiesProcessed}</td><td>${a.issuesFound}</td><td>${a.status}</td></tr>`;
    }
    body += `</table>`;
  }

  body += `<br><p style="color: gray; font-size: 12px;">Generated automatically by the Ops Monitoring System</p>`;
  body += `</body></html>`;

  return { subject, body };
}

export function buildWeeklyExecutiveEmail({ weekStart, weekEnd, trends, riskDistribution, escalations, recommendations }) {
  const subject = `[Ops Monitor] Weekly Executive Report — ${weekStart} to ${weekEnd}`;

  let body = `<html><body style="font-family: Arial, sans-serif;">`;
  body += `<h2>Weekly Executive Report</h2>`;
  body += `<p>${weekStart} — ${weekEnd}</p>`;

  body += `<h3>Performance Trends</h3>`;
  if (trends) {
    body += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">`;
    body += `<tr><th>Metric</th><th>This Week</th><th>Last Week</th><th>Change</th></tr>`;
    for (const t of trends) {
      body += `<tr><td>${t.metric}</td><td>${t.current}</td><td>${t.previous}</td><td>${t.change}</td></tr>`;
    }
    body += `</table>`;
  }

  body += `<h3>Risk Distribution</h3>`;
  if (riskDistribution) {
    body += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">`;
    body += `<tr><th>Level</th><th>Count</th><th>% of Total</th></tr>`;
    for (const r of riskDistribution) {
      body += `<tr><td>${r.level}</td><td>${r.count}</td><td>${r.percent}%</td></tr>`;
    }
    body += `</table>`;
  }

  if (escalations?.length > 0) {
    body += `<h3 style="color: red;">Escalations</h3><ul>`;
    for (const e of escalations) body += `<li>${e}</li>`;
    body += `</ul>`;
  }

  if (recommendations?.length > 0) {
    body += `<h3>Strategic Recommendations</h3><ul>`;
    for (const r of recommendations) body += `<li>${r}</li>`;
    body += `</ul>`;
  }

  body += `<br><p style="color: gray; font-size: 12px;">Generated automatically by the Observer Agent</p>`;
  body += `</body></html>`;

  return { subject, body };
}
