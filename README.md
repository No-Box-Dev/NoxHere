# NoxAlert

NoxAlert turns application errors into actionable, deduplicated alerts. Slack
is the first notification channel. It is part of the Nox family and reuses
Unticket/Nox identity, projects, the shared D1 control plane, and the existing
encrypted Slack installation.

Version 1 is deliberately error-only and event-driven:

```text
React / browser
  NoxAlert.capture(error)
        │ bounded JSON + public project key
        ▼
NoxAlert Worker
  authenticate → rate limit → filter → fingerprint → group
        │
        ▼
shared Nox delivery outbox → unticket-tasks Queue/DLQ → Slack
```

There is no OpenTelemetry Collector or telemetry warehouse in this path. Apps
already using OpenTelemetry may attach trace and span IDs to an error, preserving
the link without requiring NoxAlert to ingest all telemetry. General OTLP logs,
metrics, and traces are a later data-plane milestone.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the reliability model and
[docs/ERROR_INGESTION.md](./docs/ERROR_INGESTION.md) for the browser contract,
filters, settings model, and rate limits.

## Status

- Deployable Cloudflare Worker with health endpoint
- Shared-Nox D1 schema contract
- Browser-error schema with strict field and payload bounds
- Public project-key authentication using stored SHA-256 hashes
- Exact browser-origin validation
- Cloudflare rate limits per source IP and project
- Safe include/exclude filter DSL without SQL or regex
- Stable fingerprint grouping and repeat suppression
- Durable Slack delivery through Unticket's shared outbox and Queue/DLQ
- Protected synthetic canary for Slack delivery verification
- Next: authenticated project/rule settings UI and a production end-to-end error test

## Local development

```bash
npm install
npm run check
npm run dev
```

Then request `http://localhost:8787/health`.

A framework-free React integration example is in
[examples/react/noxalert.ts](./examples/react/noxalert.ts).

The deployed `/canary` page intentionally throws a synthetic browser error and
routes it through the shared Nox delivery outbox. Its API requires the
`CANARY_TOKEN` Worker secret. NoxAlert never reads Slack credentials; Unticket's
existing `unticket-tasks` consumer owns decryption, retries, and delivery.

Do not apply `migrations/1100_noxalert_control_plane.sql` to production directly
from this repository. The shared database contract must be reviewed and landed
in `No-Box-Dev/unticket` first; Unticket remains the migration authority.

## Secrets

Use Wrangler secrets; never commit values:

- `CANARY_TOKEN` — bearer token protecting the synthetic canary API.

Browser ingest keys are write-only public credentials generated per project.
Only their SHA-256 hashes are stored in D1.
