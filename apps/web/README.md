# NoxHere platform

This is the active frontend inside the unified NoxHere repository. Build and
deployment are orchestrated from the repository root; the former standalone
`NoxHereV2` checkout is no longer required.

This is the clean replacement frontend for NoxHere. It does not import UI code,
CSS, routes, or state from the previous application.

## UI system

The app uses the Nox ShadCN registry as its visual source of truth. Runtime
components are checked into `src/components/ui` and imported directly through
the `@/components/ui/*` alias, following ShadCN's source-ownership model. Brand
tokens live in `src/styles/nox-theme.css`; shared app chrome and reusable
components use those semantic tokens instead of service-specific theming.

When the branding registry is running locally on port 5173, `components.json`
links the `@nox` namespace to its generated registry components.

## Ownership

- **NoxHere** owns the application shell, authenticated session, project context,
  global retrieval, routing, and service discovery.
- **NoxHere** owns organizations, people, permissions, projects, repositories,
  external connections, and API access.
- Product features own their own operational data and settings. A feature may
  import shared platform code, but it may not import another feature directly.

The boundary rule is enforced by `npm run boundaries`.

## Local development

```sh
npm install
npm run dev
```

The application opens at `http://127.0.0.1:4180`. The existing NoxHere and
product APIs are the default data source. Vite proxies `/api` to
`NOX_API_ORIGIN` (by default `http://127.0.0.1:8787`).

Seeded data exists only in the explicit **Test Project**. When the local API is
unavailable or the browser has no authenticated NoxHere session, the shell
falls back to that project so the UI remains safe to exercise. Production
projects never fall back to seeded product records. Set
`VITE_DATA_SOURCE=fixture` only for isolated UI tests.

Planning reads and writes features through `/api/v1/features`, scoped with
`X-Org` and `X-Project-ID`. A feature owns its description and reference links.

## Verification

```sh
npm run check
npm run test:e2e
```

## Migration rule

The existing backend remains canonical unless a product requirement proves its
contract is wrong. Contract changes are made cleanly for the new application;
this repository does not maintain parallel legacy response shapes.
