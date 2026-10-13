# Connect service

- **Product area:** Connections
- **Runtime:** `noxhere-connections`
- **Owns:** provider identity exchange, signed provider ingress, encrypted
  credentials, transactional email, and execution of scoped connection
  capabilities.
- **Does not own:** Feed, Ticket, Spot, or Telemetry presentation and policy.
- **Data:** shared NoxHere core D1 during the consolidation window.
- **Contracts:** versioned commands and receipts from `packages/contracts/`.

The background Worker invokes private RPC methods here for Slack health and
delivery, transport delivery, and Feedback resolution email preparation and
delivery. This keeps `ENCRYPTION_KEY` and encrypted provider credentials inside
their owning service instead of duplicating secrets across runtimes.

Public provider callbacks reach this private Worker only through the NoxHere
gateway service binding. Connections verifies GitHub, Slack, and Postmark
requests before dispatching them. The private API does not hold these provider
verification secrets.

Required deployment secrets:

- `GITHUB_WEBHOOK_SECRET`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `POSTMARK_WEBHOOK_SECRET`

`ENCRYPTION_KEY`, GitHub App credentials, and `POSTMARK_SERVER_TOKEN` remain
required for the existing identity, encrypted-token, and outbound-email
capabilities. The deployment workflow refuses to promote a release when any
provider-ingress secret is absent, and the public readiness probe verifies all
three provider boundaries without returning secret values.

Validate with:

```sh
npx wrangler deploy --dry-run --config services/connections/wrangler.jsonc --env=""
```
