# Delivery roadmap

## Milestone 1 — vertical slice

- Land the `1100_noxalert_control_plane.sql` schema through Unticket's migration pipeline.
- Provision staging ClickHouse and a pinned OpenTelemetry Collector Contrib image.
- Add scoped ingest-key creation/revocation and collector authentication.
- Implement log-count rules end to end, including no-data behavior.
- Reuse Unticket's Slack installation and add channel selection.
- Add replay, DLQ inspection, audit log, and a synthetic canary alert.

Exit condition: a user can send OTLP logs, create a rule, receive one Slack firing message and one recovery message, and see the incident history.

## Milestone 2 — production hardening

- Metrics and trace rule adapters.
- Per-tenant quotas, retention, cost attribution, and cardinality guards.
- Collector persistent queues, autoscaling, availability-zone spread, and SLOs.
- Rule preview against historical data and safe query-cost estimation.
- Slack message updates/threads, acknowledgements, silences, and maintenance windows.
- Backup/restore drills and incident runbooks.

## Milestone 3 — richer routing

- Escalation policies and schedules.
- Webhook and email destinations; PagerDuty only when incident workflows justify it.
- Composite/SLO and burn-rate alerts.
- Optional stream evaluation for sub-minute latency.
