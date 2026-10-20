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
