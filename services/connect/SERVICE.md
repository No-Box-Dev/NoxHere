# Connect service

- **Product area:** Connections
- **Runtime:** `noxconnect-capabilities`
- **Owns:** provider identity exchange, encrypted credentials, transactional
  email, and execution of scoped connection capabilities.
- **Does not own:** Feed, Ticket, Spot, or Cue presentation and policy.
- **Data:** shared NoxHere core D1 during the consolidation window.
- **Contracts:** versioned commands and receipts from `shared/`.

Validate with:

```sh
npx wrangler deploy --dry-run --config services/connect/wrangler.jsonc --env=""
```
