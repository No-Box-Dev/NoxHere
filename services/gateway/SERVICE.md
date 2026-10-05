# Gateway service

The Gateway is NoxHere's only public authenticated facade. It owns browser and
native sessions, API tokens, tenant and project authorization, guest access,
and routing to private product services.

- **Public surface:** `app.noxhere.com`, `/api/*`, and authentication callbacks.
- **Data:** the NoxHere control D1 migrations in `migrations/`.
- **Private dependencies:** Connect identity and the platform compatibility API
  through Cloudflare service bindings.
- **Non-ownership:** provider credentials, product projections, and product
  business rules.

Validate with `npm test`, `npm run typecheck`, and `npm run build` from this
directory. The web assets must be built in `apps/web/dist` before deployment.
