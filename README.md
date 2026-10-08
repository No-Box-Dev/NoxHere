# NoxHere

NoxHere is the public product, identity, API, and web application. A
person signs in once and uses the same account session across every
organization, project, and enabled capability.

Feed, Ticket, Spot, Cue, and Connect are capability areas inside NoxHere rather
than separate products:

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

> **License:** NoxHere is **source-available** under the [PolyForm Noncommercial License 1.0.0](./LICENSE) — free for any non-commercial use, modify and self-host freely, but **commercial use is not permitted**. It is not an OSI "open source" license. See [LICENSE](./LICENSE).

## Quick start (local dev)

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4180. The production application and all user authentication belong to the NoxHere gateway in `services/gateway/`. Authenticated connector requests arrive only through the gateway's private service binding with a signed internal assertion; GitHub provider tokens are never public API credentials.

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

## API clients

Every operation in [`public/openapi.json`](./public/openapi.json) is callable
directly over HTTPS; an SDK is never required. See the
[direct HTTP guide](./public/docs/direct-api.md) for `curl`, `fetch`, and Python
`requests` examples. The generated SDKs provide typed convenience clients over
the same contract:

- TypeScript: [`@noxhere/sdk`](https://www.npmjs.com/package/@noxhere/sdk) with focused `feedback` and `incidents` entry points (`npm install @noxhere/sdk`).
- Python: [`noxhere`](https://pypi.org/project/noxhere/) with matching resource namespaces (`python -m pip install --upgrade noxhere`).

Both expose `workspace`, `activity`, `planning`, `feedback`, and `incidents`.
The former product names remain as compatibility aliases only.

Set `VITE_API_TARGET` in `.env.local` to point the dev proxy at your own deployment. See [.env.example](./.env.example) for all configuration.

## Authentication boundary

- **NoxHere Gateway** owns GitHub sign-in, browser/CLI sessions, CSRF,
  tenant authorization, and project-scoped automation tokens.
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
- **Backend:** Cloudflare Workers + D1 (SQLite), private service bindings, Cloudflare Queues + R2
- **Testing:** Vitest + Testing Library

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | NoxHere web development server |
| `npm run dev:full` | Build the web app and run the public gateway locally |
| `npm run build` | Production web and public gateway builds |
| `npm run e2e:local` | Build and exercise the complete local multi-service stack |
| `npm run e2e:provider:preflight` | Validate the explicit test repository, project, and Slack destination without writes |
| `npm run e2e:provider` | Run explicitly confirmed provider writes against those test-only destinations |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | Active NoxHere frontend type-check |
| `npm run typecheck:functions` | Backend (Functions + cron) type-check |
| `npm run test:sdk` | Unified TypeScript/Python tests and generated-contract checks |
| `npm run build:sdk` | Verify and build the unified SDK contract |
| `npm run test:feedback-widget` | Feedback capture-widget suite |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). To report a security issue, see [SECURITY.md](./SECURITY.md).

## Privacy

Self-hosted instances keep all data in your own Cloudflare account. For the hosted instance, see [PRIVACY.md](./PRIVACY.md) and [TERMS.md](./TERMS.md).
