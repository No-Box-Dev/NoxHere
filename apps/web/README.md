# NoxHere platform

This is the active frontend inside the unified NoxHere repository. Build and
deployment are orchestrated from the repository root; the former standalone
`NoxHereV2` checkout is no longer required.

This is the clean replacement frontend for NoxHere. It does not import UI code,
CSS, routes, or state from the previous application.

## Ownership

- **NoxHere** owns the application shell, authenticated session, project context,
  global retrieval, routing, and service discovery.
- **NoxConnect** owns organizations, people, permissions, projects, repositories,
  external connections, and API access.
- Product features own their own operational data and settings. A feature may
  import shared platform code, but it may not import another feature directly.

The boundary rule is enforced by `npm run boundaries`.

## Local development

```sh
npm install
npm run dev
```

The application opens at `http://127.0.0.1:4180`. The existing NoxConnect and
product APIs are the default data source. Vite proxies `/api` to
`NOX_API_ORIGIN` (by default `http://127.0.0.1:8787`).

Seeded data exists only in the explicit **Test Project**. When the local API is
unavailable or the browser has no authenticated NoxConnect session, the shell
falls back to that project so the UI remains safe to exercise. Production
projects never fall back to seeded product records. Set
`VITE_DATA_SOURCE=fixture` only for isolated UI tests.

NoxTicket reads and writes features through `/api/v1/features`, scoped with
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
