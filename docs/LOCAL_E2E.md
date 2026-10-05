# Local end-to-end environment

`npm run e2e:local` starts the complete Nox service topology on the local
Cloudflare runtime and makes real HTTP, RPC, D1, Queue, authentication, and
webhook calls. It does not deploy anything and it does not load production
provider secrets.

## Topology

| Local service | Port | Role |
|---|---:|---|
| NoxConnect Pages | 8788 | capability API behind a simulated private gateway boundary |
| Feedback compatibility Worker | 8790 | public feedback capture and response RPC |
| Activity compatibility Worker | 8791 | activity response RPC |
| Incidents compatibility Worker | 8792 | event ingestion, metrics, and response RPC |
| RPC smoke Worker | 8793 | disposable private-binding contract caller |
| NoxConnect cron Worker | 8794 | Queue consumer and scheduled background work |

All services use one newly created local persistence directory. NoxConnect's
migrations are the sole schema authority and are applied before any Worker is
started. The runner seeds a disposable organization, installation, repository,
project, and opaque connector identity. It does not create a browser/native
session or API token inside the capability runtime; those credentials belong to
the NoxConnect gateway.

## Prerequisites

- Node.js and dependencies installed in this repository.
- Dependencies installed in `services/cue`, `services/feed`, `services/spot`,
  and `services/ticket`.
- GitHub CLI authenticated as a member of the test organization. This performs
  a real identity and organization-membership check, but makes no provider
  writes.

Override service locations or the fixture scope when testing an external
checkout:

```bash
NOXCUE_DIR=/absolute/path/to/cue-service \
NOXFEED_SERVICE_DIR=/absolute/path/to/noxfeed/service \
NOXCONNECT_E2E_ORG=My-GitHub-Org \
NOXCONNECT_E2E_REPO=my-repository \
npm run e2e:local
```

If another local Worker already uses the default ports, shift the entire test
topology by one offset without changing any checked-in Worker configuration:

```bash
NOXCONNECT_E2E_PORT_OFFSET=100 npm run e2e:local
```

Every Worker also receives a random per-run development name. This keeps local
service bindings isolated from other Wrangler sessions using the production
service names.

Use `node scripts/local-e2e.mjs --allow-auth-skip` only when a public and
service-binding smoke run is useful without GitHub CLI authentication. Use
`--keep-state` to retain the fresh D1 state and per-Worker logs for diagnosis.
Failed runs always retain them and print their exact location. Successful runs
remove them.

## Checks performed

The runner builds the production app, applies every migration, starts every
Worker, and checks:

- developer documentation, its JavaScript, and the OpenAPI contract;
- all three product HTTP health endpoints and the cron runtime;
- private RPC contracts for Feedback, Incidents, and Activity;
- anonymous and direct-provider-bearer rejection, signed short-lived gateway
  assertions, connector identity resolution, and project-scope enforcement;
- project-scoped Incidents GitHub-issue configuration;
- all five service catalog, setup, health, and config contracts;
- ETag/`If-Match` config writes, missing preconditions, and stale revisions;
- project discovery from an installation record;
- Incidents source creation, one-time key creation, event ingestion through the
  NoxConnect service binding, idempotency, metrics, revocation, and rejection of
  the revoked key;
- Feedback site creation, shared-D1 public config, and Queue submission;
- invalid and valid HMAC-signed GitHub webhooks.

### Authorization-boundary assertions

The key checks use real HTTP requests and fresh D1 rows, not handler mocks. The
runner signs the same method-and-path-bound assertion that the NoxConnect gateway sends over
the private binding, verifies connector-side HMAC validation, resolves a real
encrypted connector identity, and exercises organization, project, capability,
cross-project, and filtered-feed enforcement. The gateway owns
separate lifecycle tests for browser/native sessions, CSRF, and API tokens.

## Deliberate external boundary

The local suite does not use production GitHub App, Slack, or AI credentials.
Consequently, it proves that provider-bound tasks are accepted by the local
Queue, but it does not create a real GitHub issue, send a Slack message, or run
paid AI narration. The final gate reuses the existing provider app identities
but constrains every write to a private test repository and dedicated test
Slack routes; it never targets a product repository or normal channel. The
executable provider gate and isolated topology are documented in
[`STAGING_ACCEPTANCE.md`](./STAGING_ACCEPTANCE.md).
