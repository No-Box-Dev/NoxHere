# NoxAlert architecture

## Version 1 boundary

NoxAlert v1 receives browser errors and alerts on them immediately. It is not a
general telemetry store.

- The React integration sends a bounded error envelope to `POST /v1/errors`.
- The shared Nox D1 database stores projects, key hashes, rules, aggregate error
  groups, and delivery state.
- Unticket owns the Slack installation, token encryption, delivery queue,
  retries, and dead-letter queue.
- An OpenTelemetry Collector and ClickHouse are deferred until NoxAlert accepts
  general logs, metrics, and traces.

Applications already using OpenTelemetry can attach their active trace and span
IDs. NoxAlert preserves those identifiers on the grouped error without taking
ownership of the complete trace.

## Ingestion flow

1. An administrator enables NoxAlert for a Nox project, saves exact browser
   origins, creates a public write-only ingest key, and configures an error rule.
2. The browser helper catches an error and posts its bounded JSON envelope with
   the project key.
3. The Worker applies an IP rate limit before querying D1.
4. The key's SHA-256 hash resolves the immutable organization and project scope.
5. The Worker checks the exact browser origin and applies the project rate limit.
6. The error is validated against a strict schema and evaluated against enabled
   project rules.
7. Matching errors are fingerprinted from rule, service, environment, type,
   normalized message, and the first stack frame. Changing request IDs and
   numeric values do not create new groups.
8. A D1 upsert atomically increments the aggregate group. A notification claim
   prevents concurrent requests from producing parallel Slack messages.
9. The claimed notification is persisted in the shared `delivery_outbox` before
   publishing `deliver_slack` to `unticket-tasks`.
10. Unticket resolves the project's selected Slack destination and records the
    Slack receipt. Failed queue sends remain recoverable from the persisted
    outbox row.

## Filtering

Rules use a constrained JSON filter model. The user selects:

- Environments and services
- Include conditions
- Exclusion conditions
- Notification threshold and time window
- Repeat interval
- Slack destination

Fields are limited to service, environment, release, error type/message, page
URL, and route. Operators are `equals`, `starts_with`, and `contains`; matching
is case-insensitive. All include conditions must match, while any exclusion
condition suppresses an event. Raw SQL and regular expressions are not accepted.

Server-side filters are authoritative. Optional browser suppression only reduces
duplicate network traffic and cannot bypass or alter the saved policy.

## Rate and reliability controls

- Request body: 32 KiB maximum, enforced while streaming
- Source IP: 120 requests per 60 seconds before authentication
- Project: 600 requests per 60 seconds after authentication
- Browser helper: one identical local error per 10 seconds
- Default notification threshold: first occurrence within a five-minute window
- Default repeat interval: 15 minutes for an identical fingerprint
- One aggregate sample per rule/fingerprint; no append-only raw error stream

Cloudflare's Worker rate-limit counters are fast, local, and eventually
consistent. They protect the service from abuse but are not used for billing or
exact occurrence accounting. D1 grouping and the shared delivery outbox provide
the durable notification semantics.

## Security

- Browser keys are scoped, revocable, write-only public credentials.
- Only key hashes are stored.
- Tenant and project identity always come from the validated key, never payload
  fields.
- Browser origins are exact allow-list entries; wildcards are not supported.
- Payload fields, counts, lengths, and tags are bounded.
- Stack traces are retained only as one bounded sample per fingerprint and are
  not copied into Slack by default.
- Slack tokens never enter NoxAlert.

## Future OTEL data plane

When NoxAlert adds general logs, metrics, and traces, applications can send OTLP
to an upstream OpenTelemetry Collector and analytical store. That future path
will add batching, redaction, sampling, and high-volume retention. It is not
required merely to turn a browser error into a Slack alert.
