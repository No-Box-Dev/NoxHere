# Connect service

- **Product area:** Connections
- **Runtime:** `noxhere-connections`
- **Owns:** provider identity exchange, encrypted credentials, transactional
  email, and execution of scoped connection capabilities.
- **Does not own:** Feed, Ticket, Spot, or Telemetry presentation and policy.
- **Data:** shared NoxHere core D1 during the consolidation window.
- **Contracts:** versioned commands and receipts from `packages/contracts/`.

The background Worker invokes private RPC methods here for Slack health and
delivery, transport delivery, and Feedback resolution email preparation and
delivery. This keeps `ENCRYPTION_KEY` and encrypted provider credentials inside
their owning service instead of duplicating secrets across runtimes.

Validate with:

```sh
npx wrangler deploy --dry-run --config services/connections/wrangler.jsonc --env=""
```
