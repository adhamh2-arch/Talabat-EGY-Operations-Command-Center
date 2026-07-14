---
name: city_agent
description: Compute daily city metrics via Looker, apply risk scoring, persist audit, notify.
runtime: nodejs18
schedule: cron(0 3 * * *)
timezone: Africa/Cairo  # Egypt local time, 09:00
inputs:
  - city_id
  - run_date
skills:
  - looker_query
  - compute_metrics
  - apply_risk_scoring
  - persist_audit
  - notify
retries:
  max_attempts: 3
  backoff: exponential
timeout_seconds: 1800
---

## Behavior

- Pull daily data for `city_id` and `run_date` from Looker using the `looker_query` skill and the `Orders` model.
- Compute metrics (inc. populations, incidents, KPIs) via `compute_metrics`.
- Apply risk scoring rules via `apply_risk_scoring` and flag high-risk results.
- Persist an audit record (inputs, outputs, score, metadata) via `persist_audit`.
- Notify stakeholders with summary and links via `notify`.

## Environment / Secrets

- LOOKER_BASE_URL: Looker host
- LOOKER_CLIENT_ID / LOOKER_CLIENT_SECRET: API credentials
- LOOKER_MODEL: Default Looker model to query (`Orders`)
- AUDIT_DB_DSN: Connection string for audit persistence, or alternate Looker persistence target if audit results are stored through Looker
- NOTIFY_WEBHOOK: Slack webhook or notification endpoint
- NOTIFY_CHANNEL_ID: Slack channel ID (`C0B9HE929HT`)

## Runtime notes

- Implemented in Node.js 18-compatible runtime. Use async/await and keep execution under `timeout_seconds`.
- Follow retry policy: up to `max_attempts` with exponential backoff for transient Looker/DB errors.
- Use structured logging and include a `trace_id` through query, compute, score, persist, and notify stages.

## Example prompts / invocations

- Run for a city and date:

  `run city_agent --city_id=123 --run_date=2026-06-09`

- Ad-hoc debug run (no notify):

  `run city_agent --city_id=123 --run_date=2026-06-09 --dry_run=true`

## Observability

- Emit structured logs for each step (query, compute, score, persist, notify).
- Include trace_id in the audit record for end-to-end tracing.

## Security & Data Handling

- Do not log raw PII. Mask or hash identifiable fields before logging.
- Redact sensitive fields in notifications.

## Outstanding clarification

- The audit persistence target is currently described generically. Confirm whether audit records should be stored in a true DB sink or persisted through Looker/Looker-managed storage.

## Next steps

- Once persistence target is confirmed, I can add a Node.js runtime scaffold, sample Looker query implementation, and lightweight validation test.
