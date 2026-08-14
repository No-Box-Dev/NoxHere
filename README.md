# NoxAlert

NoxAlert receives OpenTelemetry data and turns it into actionable, deduplicated alerts. Slack is the first notification channel. It is part of the Nox family and reuses Unticket/Nox identity, projects, GitHub installations, the shared D1 control plane, and the existing encrypted Slack installation.

This repository starts with the architecture and the alert state machine. It intentionally does **not** implement a home-grown OTLP receiver: applications send standard OTLP to an OpenTelemetry Collector gateway, and the gateway writes telemetry to ClickHouse. NoxAlert owns alert rules, evaluation state, incidents, and delivery.

## Architecture

```text
OTel SDKs / agents
        │ OTLP/gRPC or OTLP/HTTP
        ▼
OpenTelemetry Collector gateway
  ├── auth, limits, redaction, batching, retry/backpressure
  └── ClickHouse exporter
        ▼
ClickHouse / ClickStack                 Unticket / shared Nox
  logs, metrics, traces                 identity, projects, Slack OAuth
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
               NoxAlert Worker
          scheduler → per-rule Durable Object
                       │
          shared Nox delivery outbox + Queue/DLQ
                       │
                       ▼
                     Slack
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the decisions and reliability model.

## Status

Foundation only; not production-deployed yet.

- Deployable Cloudflare Worker with health endpoint
- Shared-Nox D1 schema contract
- SQLite-backed, per-rule Durable Object state
- Tested firing, repeat, and recovery transitions
- Protected mock-error canary using Unticket's shared Slack outbox and Queue/DLQ
- Next: authenticated collector gateway and ClickHouse query adapters

Rules default to disabled at the database layer so an unsupported rule can never appear healthy while silently doing nothing.

## Local development

```bash
npm install
npm run check
npm run dev
```

Then request `http://localhost:8787/health`.

The deployed `/canary` page intentionally throws a synthetic browser error and
routes it through the shared Nox delivery outbox. Its API requires the
`CANARY_TOKEN` Worker secret. NoxAlert never reads Slack credentials; Unticket's
existing `unticket-tasks` consumer owns decryption, retries, and delivery.

Do not apply `migrations/1100_noxalert_control_plane.sql` to production directly from this repository. The shared database contract must be reviewed and landed in `No-Box-Dev/unticket` first; Unticket remains the migration authority.

## Secrets

Use Wrangler secrets; never commit values:

- `CANARY_TOKEN` — temporary bearer token protecting the mock-error canary API.
- `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` — evaluator data-plane access (added with the query adapter).
