import { logStep } from './utils.js';

export async function persistAudit({ traceId, inputs, metrics, dry_run }) {
  const record = {
    traceId,
    timestamp: new Date().toISOString(),
    inputs,
    metrics,
    dry_run,
  };

  const dsn = process.env.AUDIT_DB_DSN;
  if (!dsn) {
    logStep('persistAudit.stub', { traceId, warning: 'AUDIT_DB_DSN is not configured; audit record will not be stored persistently.' });
    console.info('Audit record placeholder:', JSON.stringify(record, null, 2));
    return record;
  }

  logStep('persistAudit.unimplemented', { traceId, dsn });
  console.info('AUDIT_DB_DSN is configured, but persistence integration is not implemented in this scaffold.');
  return record;
}
