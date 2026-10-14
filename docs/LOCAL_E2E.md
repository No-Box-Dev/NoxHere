# Local end-to-end environment

`npm run e2e:local` starts the complete Nox service topology on the local
Cloudflare runtime and makes real HTTP, RPC, D1, Queue, authentication, and
webhook calls. It does not deploy anything and it does not load production
provider secrets.

## Topology

| Local service | Port | Role |
|---|---:|---|
| NoxHere gateway | 8788 | public authentication, token lifecycle, and routing boundary |
| NoxHere core API | 8787 | private capability API behind the gateway |
| Feedback compatibility Worker | 8790 | public feedback capture and response RPC |
| Activity compatibility Worker | 8791 | activity response RPC |
| Incidents compatibility Worker | 8792 | event ingestion, metrics, and response RPC |
| RPC smoke Worker | 8793 | disposable private-binding contract caller |
| NoxHere background Worker | 8794 | Queue consumer and periodic maintenance |
| Planning Worker | 8795 | planning response RPC |
| Connections Worker | 8796 | provider identity, Slack, and email boundary |

All services use one newly created local persistence directory. The core and
gateway-control migrations are applied to fresh local D1 databases before any
Worker starts. The runner seeds a disposable organization, installation,
repository, project, opaque connector identity, browser session, and API token.

## Prerequisites

- Node.js and dependencies installed in this repository.
- Dependencies installed in `services/telemetry`, `services/activity`, `services/feedback`,
  and `services/planning`.
- GitHub CLI authenticated as a member of the test organization. This performs
  a real identity and organization-membership check, but makes no provider
  writes.

Override service locations or the fixture scope when testing an external
checkout:

```bash
TELEMETRY_DIR=/absolute/path/to/cue-service \
ACTIVITY_SERVICE_DIR=/absolute/path/to/activity/service \
NOXHERE_E2E_ORG=My-GitHub-Org \
NOXHERE_E2E_REPO=my-repository \
npm run e2e:local
```

If another local Worker already uses the default ports, shift the entire test
topology by one offset without changing any checked-in Worker configuration:

```bash
NOXHERE_E2E_PORT_OFFSET=100 npm run e2e:local
```

The suite registers the same service names used by checked-in bindings so the
local topology matches production. Use the port offset when another local suite
is running, and do not run two copies concurrently in the same Wrangler service
registry.

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
- real browser-session and unified API-token create, redacted list, capability
  use, usage timestamp, rotation, revocation, and lifecycle-history checks;
- project-scoped Incidents GitHub-issue configuration;
- all five service catalog, setup, health, and config contracts;
- ETag/`If-Match` config writes, missing preconditions, and stale revisions;
- project discovery from an installation record;
- Incidents source creation, one-time key creation, event ingestion through the
  NoxHere service binding, idempotency, metrics, revocation, and rejection of
  the revoked key;
- Feedback site creation, shared-D1 public config, and Queue submission;
- invalid and valid HMAC-signed GitHub webhooks.

### Authorization-boundary assertions

The key checks use real HTTP requests and fresh D1 rows, not handler mocks. The
runner authenticates through the public gateway using an opaque browser session
and a real one-time `nox_sk_test_…` token. It verifies the same
method-and-path-bound assertion sent over the private binding, connector-side
HMAC validation, encrypted connector identity resolution, organization and
project isolation, exact capability scopes, and immediate rejection of rotated
or revoked secrets.

## Deliberate external boundary

The local suite does not use production GitHub App, Slack, or AI credentials.
Consequently, it proves that provider-bound tasks are accepted by the local
Queue, but it does not create a real GitHub issue, send a Slack message, or run
paid AI narration. The final gate reuses the existing provider app identities
but constrains every write to a private test repository and dedicated test
Slack routes; it never targets a product repository or normal channel. The
executable provider gate and isolated topology are documented in
[`STAGING_ACCEPTANCE.md`](./STAGING_ACCEPTANCE.md).
