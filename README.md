# NoxConnect

NoxConnect is the public product, identity, API, web application, and CLI. A
person signs in once and uses the same account session across every
organization, project, and enabled capability.

The former NoxHere, NoxFeed, NoxTicket, NoxSpot, and NoxCue product names are
compatibility names during migration. Their capabilities now appear as
NoxConnect areas:

The separate one-page product site for [noxhere.com](https://noxhere.com) lives
in [`nox-site/`](./nox-site/) and deploys to its own static Cloudflare Pages
project. It deliberately shares no application bindings or credentials.
The retired `app.unticket.ai` host is a redirect-only deployment maintained in
[`legacy-redirect/`](./legacy-redirect/); it does not run the application or API.

- **Connections** — GitHub, Slack, provider credentials, and delivery
- **Activity** — current work, releases, and engineering activity
- **Planning** — features, backlog, specifications, and board stages
- **Feedback** — widgets, sites, reports, and screenshots
- **Incidents** — lifecycle events, feature health, alerts, and reports

**Hosted (free):** [app.noxhere.com](https://app.noxhere.com) · **Self-host:** see [DEPLOY.md](./DEPLOY.md) · **Architecture:** see [ARCHITECTURE.md](./ARCHITECTURE.md) · **Local E2E:** see [docs/LOCAL_E2E.md](./docs/LOCAL_E2E.md) · **Staging provider gate:** see [docs/STAGING_ACCEPTANCE.md](./docs/STAGING_ACCEPTANCE.md)

> **License:** NoxConnect is **source-available** under the [PolyForm Noncommercial License 1.0.0](./LICENSE) — free for any non-commercial use, modify and self-host freely, but **commercial use is not permitted**. It is not an OSI "open source" license. See [LICENSE](./LICENSE).

## Quick start (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:5173 only when maintaining the compatibility UI. The production public application and all user authentication belong to the NoxConnect gateway (currently deployed from the `NoxHere` compatibility repository). Authenticated connector requests arrive only through the gateway's private service binding with a signed internal assertion; GitHub provider tokens are never public API credentials.

## CLI

The standalone CLI lives in [`apps/cli`](./apps/cli) and uses one session per
operating-system user, shared across local agents and config directories:

```bash
npm run cli -- login
npm run cli -- use No-Box-Dev/project
npm run cli -- whoami
npm run cli -- incidents resolve inc_0123456789abcdef0123456789abcdef
```

The package and executable are both `noxconnect`:

```bash
npm install --global noxconnect
```

Incident actions use immutable `inc_…` IDs returned by incident reads. Error
fingerprints remain internal grouping data and are not resource URLs.

Set `VITE_API_TARGET` in `.env.local` to point the dev proxy at your own deployment. See [.env.example](./.env.example) for all configuration.

## Authentication boundary

- **NoxConnect gateway** owns GitHub sign-in, browser/CLI sessions, CSRF,
  tenant authorization, and project-scoped automation tokens. The gateway is
  still deployed from the `NoxHere` compatibility repository during cutover.
- **Connectors** completes private provider exchanges, encrypts provider
  credentials, and resolves only opaque connection IDs carried in verified
  gateway assertions.
- **Direct provider tokens are rejected** as public NoxConnect credentials.

Hosted browser sign-in creates an opaque HttpOnly session. `noxconnect login`
creates short-lived access and rotating refresh credentials for the person and
returns every organization they may access. Automation remains separate and
uses expiring tokens bound to one active project and explicit scopes. GitHub
access and refresh tokens remain encrypted only in the private connectors
service.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Radix UI, Lucide icons
- **Backend:** Cloudflare Pages Functions + D1 (SQLite), a sibling cron Worker, Cloudflare Queues + R2
- **Testing:** Vitest + Testing Library

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run e2e:local` | Build and exercise the complete local multi-service stack |
| `npm run e2e:provider:preflight` | Validate the explicit test repository, project, and Slack destination without writes |
| `npm run e2e:provider` | Run explicitly confirmed provider writes against those test-only destinations |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | Frontend type-check |
| `npm run typecheck:functions` | Backend (Functions + cron) type-check |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). To report a security issue, see [SECURITY.md](./SECURITY.md).

## Privacy

Self-hosted instances keep all data in your own Cloudflare account. For the hosted instance, see [PRIVACY.md](./PRIVACY.md) and [TERMS.md](./TERMS.md).
