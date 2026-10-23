# Native NoxHere MCP

This change adds a native, read-only MCP transport to the existing NoxHere gateway. It does not deploy the route, create or connect a plugin, generate credentials, grant scopes, or add an authorization policy. The standalone private-plugin scaffold is credential-free and deliberately not installable as a server connection until the endpoint is verified.

## Product surface

The taxonomy is Spots, Incidents, Work, Growth, Usage, Activity and Admin. These are product areas, not seven generic tools. See [the capability matrix](NATIVE_MCP_CAPABILITIES.md) for source evidence and unavailable actions.

| Area | Tools | Required read scope |
| --- | --- | --- |
| Spots | `spots_get_report` | `feedback:read` |
| Incidents | `incidents_list` | `issues:read`, optional and separately approved |
| Work | `work_list_tasks`, `work_list_features`, `work_list_specs`, `work_get_spec` | `planning:read` |
| Work | `work_list_issues`, `work_get_issue` | `activity:read` |
| Activity | `activity_list_events`, `activity_list_pull_requests`, `activity_get_pull_request` | `activity:read` |
| Growth, Usage, Admin | None in this release | No authorization expansion |

All MCP requests require `services:read`. The baseline connection therefore exposes ten tools with `services:read`, `planning:read`, `activity:read`, and `feedback:read`. Adding an explicitly approved `issues:read` scope exposes the eleventh tool, `incidents_list`. The adapter accepts the existing native write-equivalent scope rule but always dispatches GET; a broad token cannot enable write tools or unsupported domains.

Spots are widget reports. Read-by-ID already works in the pinned runtime despite an OpenAPI authentication omission. Evidence is metadata and protected references, not downloaded files. A Spot feed is not available. The [separate listing proposal](NATIVE_MCP_SPOTS_LISTING_PROPOSAL.md) is design only: the existing overview is not an approved shortcut.

Incidents are runtime/OTel errors, not repository issues. The existing overview returns the latest 50 unresolved errors ordered by last seen; the adapter exposes only that errors array and explicit coverage metadata. It discards the overview's telemetry metrics, sources and project metadata. It does not offer incident detail, history, status changes or rules. This route is already admitted by native `issues:read` and the connector GET allowlist; adding this mapping does not grant the connection that scope.

Growth and Usage have project-filtered dashboard handlers but lack connector automation-token admission. Admin is organization-level privileged management. None are advertised as tools, even if a token contains similarly named scopes.

## Native boundary

`POST /mcp` enters `services/gateway/src/mcp/mcp.ts`. Cloudflare `assets.run_worker_first` includes `/mcp`, so the SPA cannot consume MCP requests.

For each request, the adapter authenticates the presented `nox_sk_` bearer through the existing gateway `authenticate()` against a synthetic services GET. That checks token expiry/revocation, enabled project, native scope and token type. Discovery never reads project content; it does not independently run the connector's organization/resource middleware. Do not claim schema discovery proves a live content read will succeed.

Every tool call re-enters the full existing `handleRequest()` with a fixed GET path. The existing gateway signs the private assertion and removes the original bearer before forwarding. The private API middleware remains responsible for suspended-organization checks, project-enabled checks, selector/resource checks and handler admission. No direct connector proxy or direct SQL bypass is introduced.

Organization and project come only from authenticated token context. Caller cookies, tenant headers, URLs, HTTP methods and credential arguments are not forwarded. The incident project path is bound internally. No credentials, identities, sessions or project responses are cached between requests.

## Protocol and limits

- MCP revision `2026-07-28`, stateless Streamable HTTP POST.
- `server/discover`, `tools/list`, and `tools/call` only. Legacy `initialize` clients are not supported.
- Validate Origin, Content-Type, Accept, per-request protocol metadata and matching MCP routing headers. GET/DELETE/SSE sessions are not offered.
- Zod validates the JSON-RPC boundary and each strict tool schema. List and detail are distinct tools; unknown fields and tenant overrides fail closed.
- Request body limit: 16 KiB. Upstream JSON and projected/redacted data limits: 1 MiB each. Structured output is also serialized as text per MCP guidance.
- One 15-second wall-clock deadline covers authentication, request-body reads, native dispatch and response-body reads. Expiry returns a safe HTTP 504 protocol error and propagates cancellation; caller cancellation returns HTTP 408. Late responses are cancelled. Dependencies that ignore abort may continue internally, so this bounds adapter response time, not backend execution time.
- Proposed request budgets use atomic `CONTROL_DB` counters: 120/minute per trusted ingress IP before token lookup; 60/minute per authenticated token and 120/minute per organization/project after authentication, including discovery. All counters use the database clock and one-minute fixed windows; bursts can straddle a window boundary. Denied authenticated attempts consume both budgets. Exhaustion returns 429 with Retry-After; missing ingress identity, missing schema or backend failure returns a safe 503. No process-local counter is used.
- Counter keys are purpose-separated SHA-256 digests, never raw IPs, credentials or tenant names. Expiry is 24 hours from the counter's current window; at most 100 expired rows are deleted per pre-auth request. Cleanup is opportunistic: idle deployments retain expired rows until later requests. This is not a guaranteed 24-hour erasure service. Shared host proxies/NATs share an IP budget.
- `page_size` is capped at 200 in the schema and runtime. Activity's limit is at most 200. Incident coverage is at most 50. Non-paginated REST collections may exceed the byte limit and be rejected; never silently truncate and claim completeness.
- Token patterns, credential-named fields, credential URL query values, and the exact connection bearer are redacted from JSON keys and values. Free text cannot be assumed secret-free.
- No writes, arbitrary URLs, credential/configuration routes, automatic asset downloads, external credential forwarding or external messaging.

## Private-plugin configuration

`plugins/noxhere/` contains the portable manifest and workflow skill. `plugins/noxhere-mcp.template.json` is intentionally outside that directory and contains a non-URL placeholder. Do not package or save it as a working connection.

After an authorized deployment and authenticated endpoint verification, replace the placeholder with the verified HTTPS `/mcp` URL and save the result as `plugins/noxhere/mcp.json`. Keep:

- Portable transport: `type: streamable-http`.
- Host-specific authentication: `extensions.com.openai.auth.type: api_key`, `headerScheme: bearer`.
- No credential values, authorization headers, environment secrets or session data in the package.

Use the host's supported secure API-key connection flow. Verify that the actual connection UI supports secure entry and that a read succeeds; no credential-entry UI is promised by this scaffold. The generic Agent Plugins MCP JSON Schema does not currently include OpenAI's supported server extension, so generic-schema success is not claimed. Host ingestion and actual client compatibility are separate gates.

## Validation and release gates

Run the gateway's own locked dependency and verification workflow from a complete checkout:

```sh
npm ci --prefix services/gateway
npm --prefix services/gateway test
npm --prefix services/gateway run typecheck
npm run build:web
npm --prefix services/gateway run build
```

Gateway build is a Wrangler dry-run, not deployment. The new gateway tests cover adapter protocol/security, product-domain contracts, page bounds, incident projection, existing authorization reconciliation and real native gateway dispatch with signed tenant assertions. They do not prove deployed database configuration or host connection behavior.

Before activation, review the proposed budgets and retention policy, and apply the append-only gateway migration `0006_mcp_rate_limits.sql` through the authorized release pipeline. No live migration was applied during local validation. The existing pipeline applies CONTROL_DB migrations before gateway rollout. Verify that public ingress supplies and overwrites `CF-Connecting-IP`; missing identity fails closed, and a caller must not be able to select that header. Confirm deployed counter behavior, shared-host IP behavior and any effective edge abuse protection: database admission still costs writes and is not a replacement for edge DDoS controls. Existing Feedback/Telemetry limiters do not protect MCP. No provider settings or new bindings were changed. Verify that the 15-second adapter deadline is suitable for the host and that downstream services honor abort where supported. Then verify staging reads and denials with an approved project token: authorized content, foreign project/report, missing scope, disabled project, suspended organization, expiry/revocation, untrusted origins, bounded responses, absence of secrets, actual MCP headers and client compatibility. Do not activate new scopes to make a test pass without approval.

A feature branch and draft PR are review-only under the inspected workflows. Main CI success automatically runs staging and then production deployment. Never merge merely to test staging. Merging, any deployment, workflow dispatch, token generation, scope changes and plugin connection require their own authorization.

## Sources

Runtime baseline: `69985fc1623ccda050d46cb6d03fe9b937a2ddfe`.

- `services/gateway/src/control/auth.ts`
- `functions/lib/api-auth.js`, `functions/_middleware.js`
- `functions/api/feedback/reports/[id].ts`
- `functions/api/v1/projects/[id]/incidents.ts`, `functions/api/telemetry/project-overview.ts`
- `apps/web/src/app/service-registry.ts`
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
