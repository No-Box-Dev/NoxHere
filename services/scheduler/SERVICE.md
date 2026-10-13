# Background service

- **Product area:** platform operations
- **Runtime:** `noxhere-orchestrator` (kept stable for zero-downtime deploys)
- **Owns:** queue consumption, reconciliation, recovery, projection work,
  retention, and scheduled digests.
- **Does not own:** capability presentation policy; it asks the owning service
  to render messages and then executes them through shared transports.
- **Data:** shared core D1, task queue, and event archive bucket.

The source directory keeps its historical `scheduler` path, while the service
is operated and documented as NoxHere's background Worker. Renaming the
deployed `noxhere-orchestrator` script would create a second Cloudflare Worker
and risk two consumers during cutover, so its runtime identifier stays stable.

## Execution model

- Queue events perform durable, retried asynchronous work.
- The one-minute trigger dispatches configured reports and digests.
- The one-minute trigger also closes and requeues reconciliations that outlive
  Cloudflare's 15-minute Queue consumer wall-time limit.
- The 30-minute production trigger runs bounded recovery and health sweeps and
  publishes one durable reconciliation message per organization. Queue
  consumers process organizations independently with retries and a five-minute
  CPU allowance. A partial unique D1 index enforces one unfinished
  reconciliation per organization. Staging uses five minutes to exercise
  recovery.
- The 03:00 UTC maintenance ticks drain the bounded event-archive backlog.

Each path has a separate `service_heartbeats` component:
`background.queue`, `background.schedule`, `background.reports`,
`background.reconciliation-recovery`, `background.maintenance`, and
`background.archive`. The public readiness API
returns HTTP 200 with `status: "degraded"` when only `backgroundWorker` is
unhealthy. Database, durable-delivery backlog, or required capability failures
still return HTTP 503 with `status: "not_ready"`.

## Secrets

`ANTHROPIC_API_KEY` and `TELEMETRY_INGEST_KEY` are optional. GitHub installation
tokens and encrypted provider operations run through the private Connections
binding, so neither `GITHUB_APP_PRIVATE_KEY` nor `ENCRYPTION_KEY` is copied to
this Worker. The deployment workflow synchronizes configured optional secrets
before every deployment.

Validate with:

```sh
npx vitest run services/scheduler/src/__tests__
npx wrangler deploy --dry-run --config services/scheduler/wrangler.toml --env=""
```
