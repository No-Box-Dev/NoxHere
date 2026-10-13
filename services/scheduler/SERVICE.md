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
- The 30-minute production trigger reconciles provider state and runs bounded
  recovery and health sweeps. Staging uses five minutes to exercise recovery.
- The 03:00 UTC maintenance ticks drain the bounded event-archive backlog.

Each path has a separate `service_heartbeats` component:
`background.queue`, `background.schedule`, `background.reports`,
`background.maintenance`, and `background.archive`. The public readiness API
returns HTTP 200 with `status: "degraded"` when only `backgroundWorker` is
unhealthy. Database, durable-delivery backlog, or required capability failures
still return HTTP 503 with `status: "not_ready"`.

## Secrets

`GITHUB_APP_PRIVATE_KEY` and `ENCRYPTION_KEY` are required in both production
and staging. `ANTHROPIC_API_KEY` and `TELEMETRY_INGEST_KEY` are optional. The
deployment workflow synchronizes configured GitHub repository secrets before
every Worker deployment and stops before deployment when a required value is
missing.

Validate with:

```sh
npx vitest run services/scheduler/src/__tests__
npx wrangler deploy --dry-run --config services/scheduler/wrangler.toml --env=""
```
