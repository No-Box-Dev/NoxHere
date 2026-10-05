# Architecture

A high-level map of how NoxHere fits together. For maintainer-level detail (every API route, config key, and convention), see [CLAUDE.md](./CLAUDE.md).

## Overview

```
Web / Apple apps / noxconnect CLI
                  │
                  ▼
          NoxHere public gateway
      identity · tenancy · authorization
                  │ private service binding
                  ▼
           NoxHere capability services
   feed · ticket · spot · cue · connect
                  │
                  ▼
       shared event + transport contracts
            GitHub · Slack · managed AI
```

- **Frontend** — `apps/web/` is the React 19 + TypeScript + Vite NoxHere SPA. TanStack Query reads NoxHere APIs; browser code does not receive GitHub or Slack tokens or call provider APIs directly. Capability pages are route-lazy-loaded.
- **API** — `services/gateway/` is the only public authority and forwards a short-lived signed assertion over a private binding. Compatibility capability handlers remain under `functions/api/` while traffic moves to the service directories; new code uses zod validation at the boundary and native D1 access (`DB.prepare().bind()`, `DB.batch()`).
- **Capabilities** — `services/feed/`, `services/ticket/`, `services/spot/`, `services/cue/`, and `services/connect/` own distinct domain behavior while sharing envelopes and transports from `packages/contracts/`.
- **Client SDKs** — `packages/sdk/` and `packages/python-sdk/` generate the same 149-operation catalog from `public/openapi.json`; resource namespaces follow the capability boundaries above.
- **Feedback widget** — `packages/spot-widget/` owns the browser capture source and tests. Its three compatibility bundles are published to R2 from this repository.
- **Database** — Cloudflare D1 (SQLite). Schema in `migrations/`, applied with `wrangler d1 migrations apply`.
- **Scheduler service** — `services/scheduler/` imports shared platform helpers, reconciles GitHub state every 30 minutes, and consumes the background-work queue.
- **Queue + R2** — durable background work (narration, bootstrap, repo sync) runs on a Cloudflare Queue with retries and a dead-letter queue; the `events` table is archived to R2 after 90 days.

## Multi-tenancy

NoxConnect is multi-tenant. Each GitHub organisation is an `org` row, and core tables (`repos`, `pull_requests`, `issues`, `members`, `config`, `features`, `teams`, `ai_settings`) carry an `org_id` foreign key. The public gateway resolves the caller and signs the bounded context; capability middleware (`functions/_middleware.js`) verifies that assertion and scopes every query by `org_id`. A project selector is optional for user sessions: omission is organization-wide and a supplied header, query value, URL project, or signed token project narrows the request. Multiple selectors must agree. New public endpoints put project identity in the URL; compatibility headers remain accepted while older clients migrate.

## Authentication and credentials

Credentials are separated by caller and cannot be substituted for one another:

- **Browser users** — the gateway creates an opaque, hashed-at-rest session in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie after GitHub OAuth or an email magic link. Browser mutations require a separate CSRF cookie/header proof.
- **CLI and native users** — the gateway brokers GitHub approval and returns a 15-minute `nox_at_…` access token plus a rotating 30-day `nox_rt_…` refresh token. The `noxconnect-cli` public client receives the same account identity and current organization memberships as the web application. Its OS-user credential is shared across local agents, while a process lock serializes login and refresh rotation. Provider credentials remain encrypted in the connectors service. Sign-out revokes the shared server session.
- **Native abuse control** — provider-facing device-start and legacy-exchange operations fail closed behind an atomic, per-IP D1 rate-limit window before they call GitHub. A native Cloudflare rate-limit binding can replace the D1 path when the API moves from Pages to a Worker. Device polling also enforces GitHub's per-code interval atomically.
- **Automation** — expiring `nox_sk_live_…` or `nox_sk_test_…` secrets are bound to one organization, exactly one enabled project, and explicit capability read/write scopes. Values are shown once, stored only as hashes, audited, rotatable, and revocable.
- **Public capture** — incident source keys and origin-bound feedback capture are limited to their ingestion contracts; they do not grant management access.
- **Internal services** — Workers use private versioned service bindings and receive bounded product data, never provider tokens.
- **Unsupported bearer formats** — the public gateway rejects raw GitHub bearer tokens as `unsupported_credential`. A narrowly scoped migration exchange may consume an existing installed credential once, but it is not API authentication.

## Data freshness: three redundant paths

GitHub data stays current via three mechanisms, in priority order:

1. **Webhooks** (`functions/api/webhook.js`) — real-time, HMAC-verified. The running source of truth.
2. **Cron reconcile** (every 30 min) — catches deletes (GitHub fires no delete webhooks), deliveries missed during deploys, and label changes on pre-install issues.
3. **Manual sync / backfill** — admin-triggered from the UI for first sync or recovery. Rate-limited to bound cost.

## Background work

Slow webhook follow-up (LLM narration, install bootstrap, repo backfill) is enqueued to the `noxconnect-tasks` Queue rather than run inline. The cron Worker's `queue()` handler dispatches by task type with retries; terminal failures are recorded to the `op_failures` table and surfaced to admins in Settings.

## Project routing

NoxConnect owns explicit project enablement, the shared repository-to-project map, and named project Slack destinations. GitHub repositories are mirror records, not projects by default: an admin must enable a NoxConnect project before it participates in routing. An enabled project can group multiple repositories; a repository belongs to at most one project. Activity resolves pull-request traffic by repository, while Incidents resolves its linked project after any source-specific override. Both then fall back to their organization route. An organization-wide Slack workspace can serve every project; a project-owned workspace is accepted only for that project.

## AI narration

A bounded server-side Anthropic integration narrates pull-request activity. NoxConnect owns the provider credential; customers can enable or disable managed AI through `ai_settings` but never supply keys or endpoints. Narration is paced and fails closed to deterministic summaries when unavailable. Provider credentials remain server-side and are never returned to the browser.

## Where to look

| Concern | Path |
|---|---|
| Web application | `apps/web/src/` |
| Public gateway | `services/gateway/src/` |
| Service ownership | `services/` |
| API routes | `functions/api/` |
| Shared server helpers | `functions/lib/` |
| TypeScript/Python SDKs | `packages/sdk/`, `packages/python-sdk/` |
| Feedback capture widget | `packages/spot-widget/` |
| Project routing core | `functions/lib/project-routing.ts`, `functions/api/projects/routing*` |
| DB schema | `migrations/` |
| Cron + queue consumer | `services/scheduler/src/` |
