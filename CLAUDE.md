# NoxHere maintainer guide

NoxHere is one application with separate capability modules. Feed, Ticket,
Spot, Cue, and Connect are not separate products or browser applications.

## Repository map

- `apps/web/` — the only NoxHere web application.
- `apps/cli/` — the separately distributed `noxconnect` CLI.
- `services/gateway/` — public identity, session, authorization, and SPA gateway.
- `services/connect/` — private provider credentials and connection capabilities.
- `services/feed/` — activity and release-note behavior.
- `services/ticket/` — planning, features, specs, and attachments.
- `services/spot/` — public feedback capture and resolution responses.
- `services/cue/` — event ingestion, product metrics, health, and incidents.
- `services/scheduler/` — scheduled reconciliation and queue consumption.
- `packages/contracts/` — neutral platform-event and outbound-transport contracts.
- `packages/sdk/` and `packages/python-sdk/` — generated unified public API clients.
- `packages/feedback-widget/` — feedback capture widget source, tests, and R2 bundles; the shipped browser API remains `NoxSpot`.
- `functions/` — compatibility and private API routes served by
  `workers/api-gateway/`; these remain live while handlers move to capability
  services.
- `migrations/` — append-only platform D1 migrations.
- `workers/legacy-bridge/` and `legacy-redirect/` — explicit compatibility
  deployments, not alternate applications.

The retired root `src/` frontend was removed. Do not recreate a second web
application at the repository root.

## Runtime boundaries

`services/gateway/` is the only public application authority. It authenticates
the caller, resolves tenant scope, and sends a short-lived signed assertion to
the private API. Browser code must not receive GitHub or Slack credentials or
call provider APIs directly.

Capability services own their domain behavior and may share neutral contracts;
they must not import another capability's implementation. The web boundary is
enforced by `npm --prefix apps/web run boundaries`, and provider-write
boundaries are enforced by the M4/M5 milestone checks.

All outbound Slack and GitHub writes use `TransportCommand` and the durable
transport outbox. Direct provider reads, OAuth, reconciliation, and inbound
webhooks remain separate concerns. All cross-capability events use
`PlatformEventV1`.

## Development

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run typecheck:functions
npm run lint
npm test
```

Each service has its own lockfile and checks. The complete fail-closed platform
gate is:

```bash
npm run milestones:verify
```

The local multi-service test builds `apps/web/` and exercises the Pages router,
all capability RPCs, D1 migrations, tenant isolation, event ingestion, public
capture, and webhook verification:

```bash
npm run e2e:local
```

## Change rules

- Add web UI only under the owning `apps/web/src/features/` directory. Shared
  shell and retrieval behavior belongs under `apps/web/src/app/`.
- Add public routes to OpenAPI and the CLI parity checks in the same change.
- Validate untrusted input at the boundary with Zod.
- Use parameterized D1 statements. Never interpolate request data into SQL.
- Never edit a released migration; add a new migration.
- Generate Worker binding types after changing Wrangler bindings.
- Store secrets with Wrangler secrets, never in source or Wrangler variables.
- Await promises or pass intentional background work to `ctx.waitUntil()`.
- Use structured JSON logs for new Worker logging.
- Keep compatibility adapters thin; canonical behavior belongs in the owning
  service or shared contract.

## Deployment

CI verifies migrations, docs, contracts, the active web app, every capability,
and Worker dry-run bundles. A successful `main` CI run triggers the staged
deployment workflow, which migrates and smokes staging before production.
Routine gateway deploys do not mutate the dashboard-managed custom-domain
route.

See `ARCHITECTURE.md`, `DEPLOY.md`, `docs/PLATFORM_EVENT_MILESTONES.md`, and the
individual `services/*/SERVICE.md` files for deeper operational detail.
