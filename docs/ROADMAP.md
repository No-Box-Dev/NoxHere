# Delivery roadmap

## Milestone 1 — browser error vertical slice

- Land the shared error-control-plane schema through Unticket's migration pipeline.
- Add authenticated project settings for allowed origins, key create/rotate/revoke,
  error filters, thresholds, reminder interval, and Slack destination.
- Ship the small React/browser helper and global error handlers.
- Run one production error through filtering, grouping, the shared outbox, and Slack.
- Add rule preview, delivery status, audit entries, and a synthetic error button.

Exit condition: a user enables a project, copies its public ingest key, selects
production plus a Slack channel, triggers an error in React, and receives one
deduplicated Slack alert with an occurrence count.

## Milestone 2 — production hardening

- Incident acknowledgement, manual resolution, quiet-period auto-resolution,
  silences, and maintenance windows.
- Source-map upload and server-side stack symbolication.
- Rate-limit analytics, plan-specific quotas, abuse controls, and key rotation.
- Filter previews against recent grouped samples and a “why was this filtered?”
  diagnostic visible only to project administrators.
- Backup/restore drills, DLQ replay, synthetic canaries, SLOs, and runbooks.
- Webhook and email destinations where customer demand justifies them.

## Milestone 3 — general OpenTelemetry

- OTLP logs, metrics, and traces through an upstream OpenTelemetry Collector.
- An analytical telemetry store and constrained query adapters.
- Trace error-rate, latency percentile, metric threshold, missing-data, and SLO
  burn-rate alerts.
- Per-tenant retention, cost attribution, sampling, and cardinality controls.
