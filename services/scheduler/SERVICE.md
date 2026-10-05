# Scheduler service

- **Product area:** platform operations
- **Runtime:** `noxconnect-orchestrator`
- **Owns:** queue consumption, reconciliation, recovery, projection work,
  retention, and scheduled digests.
- **Does not own:** capability presentation policy; it asks the owning service
  to render messages and then executes them through shared transports.
- **Data:** shared core D1, task queue, and event archive bucket.

Validate with:

```sh
npx vitest run services/scheduler/src/__tests__
npx wrangler deploy --dry-run --config services/scheduler/wrangler.toml --env=""
```
