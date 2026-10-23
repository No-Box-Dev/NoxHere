# Native NoxHere capability matrix

Source baseline: `No-Box-Dev/NoxHere@69985fc1623ccda050d46cb6d03fe9b937a2ddfe`.
The seven user-facing areas are the product taxonomy, not seven artificial catch-all tools.

| Area | Implementable read surface | Existing authorization | Deliberately unavailable |
| --- | --- | --- | --- |
| Spots | Get one widget report by report ID, with evidence metadata/references | `feedback:read`; runtime report lookup and SQL bind org/project despite OpenAPI omission | Feed/listing; asset downloads; configuration and replies |
| Incidents | List the latest 50 unresolved OTel/runtime incidents from the project overview, projecting only incident data | `issues:read`; current GET project overview is admitted by both gateway scope mapping and connector allowlist | GET incident detail is not admitted; no status mutations, rules, source keys, or telemetry metrics |
| Work | List tasks, features, specs, repository issues; get spec/issue | `planning:read` for tasks/features/specs; `activity:read` for repository issues | Writes and absent feature/task detail routes |
| Growth | None | Gateway maps `growth:read`; SQL is project-filtered, but connector token allowlist rejects dashboard routes | No tools advertised until a separately approved authorization change and tests |
| Usage | None | Gateway maps `usage:read`; SQL is project-filtered, but connector token allowlist rejects dashboard routes | No tools advertised until a separately approved authorization change and tests |
| Activity | List activity feed/PRs; get PR | `activity:read` | Team administration, sending, mutation |
| Admin | None | Project tokens are not organization administrators; project/member/connection administration is a separate privileged surface | Project creation, people/connection management, tokens, secrets and permissions |

All discovery requires `services:read`. Baseline connection scopes remain `services:read`, `planning:read`, `activity:read`, `feedback:read`. The optional incident tool requires separately approved `issues:read` in the connection. This build grants no scopes and changes no underlying authorization.

## Safe implementation plan

1. Replace the unfinished grouped contract with explicit, consistent domain + list/get operations and two-line descriptions. Advertise only supported tools authorized by the current token.
2. Keep the native `/mcp` route, authenticate each request, and re-enter the complete existing gateway for every resource read. Derive project and organization only from token context.
3. Apply strict schemas, identical documented/runtime pagination bounds, bounded JSON, token redaction, no arbitrary paths/URLs, and no asset fetching. Incident project paths are bound internally.
4. Add contract/runtime tests, protocol conformance checks, native route tests, and source authorization reconciliation checks. Keep unsupported areas out of discovery even with broader token scopes.
5. Prepare a credential-free standalone private-plugin package using the supported Bearer API-key configuration. Keep endpoint configuration outside the installable directory until the route is deployed and verified.
6. Create only a feature-branch draft PR after confirming all current workflows are non-deploying for its events. No merge, workflow dispatch, staging/production deploy, plugin connection, token generation, grants, or live admin changes.

## Deployment boundary

Main CI success automatically triggers staging then production deployment. A merge is not a staging-only test. Deployment, authenticated staging verification, modern-MCP client compatibility, and credential connection remain explicit later gates.
