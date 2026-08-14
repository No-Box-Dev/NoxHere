# NoxAlert architecture

## The central decision

NoxAlert separates its control plane from its telemetry data plane.

- The **control plane** is a Cloudflare Worker plus the shared Nox D1 database. It stores tenants, API-key hashes, projects, alert rules, incidents, delivery ledgers, and references to Unticket's Slack installation.
- The **data plane** is the upstream OpenTelemetry Collector plus ClickHouse/ClickStack. It receives OTLP, performs bounded processing, and stores high-cardinality logs, metrics, and traces.

D1 is deliberately not used for raw telemetry. A shared D1 database is a good relational coordination store but is the wrong shape and scale for append-heavy observability data.

## Request and evaluation flow

1. A customer creates a scoped ingest key in NoxAlert. Only its SHA-256 hash is stored.
2. Their SDK or local collector sends OTLP/gRPC or OTLP/HTTP to the NoxAlert Collector gateway.
3. The gateway authenticates before decoding expensive payloads, limits request size/rate, stamps the immutable tenant ID, redacts configured attributes, batches, and exports to ClickHouse with a persistent queue and retry policy.
4. A scheduler selects due rules from D1 and fans out by deterministic rule ID.
5. One SQLite-backed Durable Object per `{owner_id}:{rule_id}` serializes evaluation state, preventing overlapping evaluations and alert flapping.
6. The evaluator compiles a constrained rule DSL into parameterized ClickHouse queries. User-authored SQL is not accepted in v1.
7. A state transition creates an idempotent alert event and delivery row in D1, then enqueues delivery.
8. A queue consumer resolves the org's existing encrypted Slack token from `slack_settings`, posts Block Kit, and records the Slack timestamp. Retryable failures back off; terminal failures land in a DLQ and surface in the UI.

## Reliability semantics

- Collector ingestion is at-least-once. ClickHouse rows carry stable tenant/signal IDs so duplicate input can be identified.
- Rule evaluation is single-writer per rule and records `firing`, `repeated`, and `resolved` transitions.
- Incident/event creation uses deterministic idempotency keys.
- Queue delivery is at-least-once. Slack does not provide a general idempotency key for `chat.postMessage`, so the narrow crash window after Slack accepts a message but before D1 records its timestamp can produce a duplicate. We prefer a visible duplicate over a lost page; later notifications update the known Slack message/thread when possible.
- Every async path has a DLQ or persisted failure state. No `waitUntil` call is the sole durability mechanism.

## Multi-tenancy and security

- Tenant identity comes from a validated ingest key and is overwritten at the gateway; client-supplied tenant attributes are never trusted.
- Every D1 query includes `org_id` or `owner_id`. Every ClickHouse table and query includes the immutable tenant ID.
- Ingest, dashboard, and internal evaluator credentials are separate.
- Secrets live in Cloudflare secrets. Slack tokens remain encrypted using Unticket's AES-256-GCM format.
- Rule filters are a typed DSL compiled to bound query parameters. No raw SQL, arbitrary regex, or unbounded group-by is accepted initially.
- Attribute cardinality, retention, request bytes, and per-tenant ingest rate have enforceable quotas.

## Initial rule types

Ship a deliberately narrow set first:

1. Log count over a window, filtered by service, environment, severity, and exact/contains attribute predicates.
2. Trace error rate and latency percentile, grouped only by service/route.
3. Metric threshold for gauge and rate-of-change for monotonic sums.
4. Missing-data detection for each of the above.

Each rule supports consecutive breach/recovery counts, a repeat interval, and explicit no-data behavior. This prevents one-sample flapping and alert storms.

## Scale path

- Start with scheduled ClickHouse queries at 60-second resolution.
- Separate interactive ClickStack queries from evaluator capacity when load warrants it.
- Add a stream evaluator only for customers who need sub-minute alerts; keep the same rule/event/delivery contracts.
- Partition ClickHouse by day and tenant-aware ordering, apply TTLs per plan, and archive only when customer retention requires it.
- Scale Collector gateways horizontally and route trace-aware processors by trace ID. Observe collector queue fill, refused records, exporter failures, and end-to-end ingest lag.

## Ownership boundaries

- `No-Box-Dev/unticket`: shared D1 migrations, GitHub identity/install sync, org membership, Slack OAuth/token lifecycle.
- `No-Box-Dev/NoxAlert`: rule API/UI, evaluation, incident lifecycle, notification delivery, collector configuration.
- ClickHouse: telemetry retention and analytical queries; never the identity source of truth.
