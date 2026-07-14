import { getEnv, logStep } from './utils.js';

export async function notifySlack({ webhook, channelId, message }) {
  const resolvedWebhook = webhook || getEnv('NOTIFY_WEBHOOK');
  const resolvedChannelId = channelId || getEnv('NOTIFY_CHANNEL_ID');

  if (!resolvedWebhook) {
    throw new Error('Missing NOTIFY_WEBHOOK for Slack notification');
  }

  const payload = {
    channel: resolvedChannelId,
    text: message,
  };

  logStep('notify.slackPayload', { channel: resolvedChannelId, textLength: message.length });

  const response = await fetch(resolvedWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  logStep('notify.slackResponse', { ok: result.ok ?? true });
  return result;
}
