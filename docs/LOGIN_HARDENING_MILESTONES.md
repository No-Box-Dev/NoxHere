# Login hardening milestones

This roadmap turns the production-login RCA into fail-closed delivery gates. `npm run login:milestones:verify` always runs every gate through the active milestone in order and stops at the first failure. A milestone advances only after its local gates and the corresponding staging validation pass.

| Milestone | Outcome | Promotion requirement |
| --- | --- | --- |
| M0 | Browser and native login baseline remains executable | Gateway and app login tests pass |
| M1 | Connections owns provider ingress and readiness | Provider and gateway boundary tests pass |
| M2 | Organization and project scope is mandatory and preserved | Gateway/core authorization tests pass |
| M3 | One authenticated bootstrap returns the complete scoped app model | Bootstrap, UI, type, OpenAPI, and SDK gates pass |
| M4 | Routes and service configuration come from one generated manifest | Generated output has no drift |
| M5 | Production-shaped login acceptance runs against staging | Authenticated staging acceptance passes |
| M6 | Only a verified staging release can be promoted and rolled back | Promotion and rollback drill passes |
| M7 | Every service exposes separate liveness and dependency readiness | Health-contract coverage passes |
| M8 | Retries are bounded and poison work is quarantined | Retry/quarantine policy tests pass |

The active milestone is declared in `scripts/login-hardening-milestones.config.mjs`. Future milestones deliberately name artifacts that do not exist yet, so `npm run login:milestones:verify:all` stops at the first unfinished milestone instead of implying that the roadmap is complete.

Production promotion remains additionally guarded by the deployment workflow: staging deploy, staging smoke/acceptance, production deploy, and production smoke. A failed or unavailable CI runner must leave the currently verified production release in place.

## Route and service topology changes

`config/platform-services.mjs` is the source of truth for public gateway route groups, worker names, deployment order, and gateway/core service bindings. After editing it, run `npm run routes:generate` and commit both generated artifacts. `npm run routes:check` fails when generated output or the corresponding Wrangler configuration drifts from that manifest. Runtime gateway routing imports the generated route table directly.

## Staging login acceptance

Every deployment now runs `npm run login:staging:acceptance` after the complete staging release and API-surface probe, but before production promotion. The harness provisions short-lived staging-only native and project automation credentials, proves unauthenticated requests fail with canonical JSON, switches one authenticated identity across two organizations, verifies each bootstrap scope, proves the automation token cannot escape its project, and removes the credentials in a `finally` cleanup. The gate accepts only the declared staging origin and the exact staged commit SHA.

## Verified promotion and rollback

Production cannot mutate until `scripts/promote-verified-release.mjs` has written a fresh receipt for the exact staged commit. The receipt records the successful smoke, full API-surface, login acceptance, readiness, and the single active 100%-traffic version of every staging Worker. Secret synchronization runs before the versioned deploys so those active versions remain attributable to the release SHA.

Immediately before the first production mutation, the same tool captures and verifies the currently active version of every production Worker. A failed promotion restores those exact targets in reverse deployment order and verifies each resulting deployment. Successful runs verify production health and version attribution again, then retain the staging receipt, rollback manifest, and final promotion receipt as a 30-day workflow artifact. Worker rollback restores code, assets, bindings, and compatibility settings; it does not revert D1, R2, KV, Queue, or Durable Object state, so migrations remain additive forward-only changes.
