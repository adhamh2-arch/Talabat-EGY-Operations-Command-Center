import { getEnv, logStep } from './utils.js';

const LOOKER_API_VERSION = '4.0';

function buildUrl(path) {
  const baseUrl = getEnv('LOOKER_BASE_URL');
  return `${baseUrl}/api/${LOOKER_API_VERSION}${path}`;
}

async function authenticate() {
  const clientId = getEnv('LOOKER_CLIENT_ID');
  const clientSecret = getEnv('LOOKER_CLIENT_SECRET');
  const response = await fetch(buildUrl('/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!response.ok) {
    throw new Error(`Looker auth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Looker auth response missing access_token');
  }

  return data.access_token;
}

export async function lookerQuery({ cityId, runDate, traceId }) {
  const token = await authenticate();
  logStep('looker.authenticated', { traceId });

  const model = getEnv('LOOKER_MODEL', false) || 'Orders';
  const queryPayload = {
    model,
    view: model.toLowerCase(),
    fields: [
      'orders.id',
      'orders.created_date',
      'orders.total_revenue',
      'orders.city_id',
      'orders.quantity',
    ],
    filters: {
      'orders.city_id': String(cityId),
      'orders.created_date': runDate,
    },
    limit: 50000,
  };

  logStep('looker.queryPayload', { traceId, queryPayload });

  const queryResponse = await fetch(buildUrl('/queries'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `token ${token}`,
    },
    body: JSON.stringify(queryPayload),
  });

  if (!queryResponse.ok) {
    throw new Error(`Looker query creation failed: ${queryResponse.status} ${queryResponse.statusText}`);
  }

  const queryData = await queryResponse.json();
  if (!queryData.id) {
    throw new Error('Looker query response missing id');
  }

  const rowsResponse = await fetch(buildUrl(`/queries/${queryData.id}/run/json`), {
    method: 'GET',
    headers: { Authorization: `token ${token}` },
  });

  if (!rowsResponse.ok) {
    throw new Error(`Looker query execution failed: ${rowsResponse.status} ${rowsResponse.statusText}`);
  }

  const rows = await rowsResponse.json();
  logStep('looker.queryRows', { traceId, rowCount: Array.isArray(rows) ? rows.length : 0 });
  return Array.isArray(rows) ? rows : [];
}
