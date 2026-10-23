# Proposed feedback-report listing extension

Status: design only, not implemented or enabled in the native adapter. No security setting, route, scope, credential, deployment, or production data has changed.

## Verified current boundary

All findings use No-Box-Dev/NoxHere commit 69985fc1623ccda050d46cb6d03fe9b937a2ddfe.

- GET /api/v1/feedback/reports/{reportId} is already supported for a project-bound feedback:read token by gateway requiredScope, the connector's projectScopedApiTokenPathSupported GET allowlist, report-to-project lookup, and org/project-filtered report and evidence SQL. The OpenAPI security declaration omits that existing token support. The spots_get_report tool reconciles this specific existing read without changing authorization.
- GET /api/v1/feedback/project-overview is not token-allowlisted. It is a mixed GitHub-issue/feedback view, not a report-owned collection. Report, capture-event, and activity queries are partly filtered by repository sets rather than exact report/event project_id. Repository reassignment can make historical data provenance ambiguous. Do not simply authorize this route for tokens or advertise its counts as an all-report total.
- GET /api/v1/projects/{projectId}/feedback is connector-allowlisted but lacks a matching feedback scope in the inspected gateway requiredScope. Do not use it as a bypass.
- Asset download routes are separate from report metadata. No automatic download is needed for the first useful bug-report integration.

## Recommended smallest safe addition

Prefer a report-owned collection over widening the mixed overview. Proposed new route (not an existing documented endpoint): GET /api/v1/feedback/reports.

Proposed new MCP tool: spots_list_reports. Inputs: status (optional open, investigating, or resolved), limit (integer 1–100, default 25), and before (bounded opaque pagination cursor). No organization, project, arbitrary URL, asset ID, credential, or site override arguments.

The collection requires a selected active project, including for browser/native callers. There is no organization-wide fallback. It uses the existing feedback:read scope and private signed-assertion gateway path. Exact project scope comes only from validated authentication context.

Query only spot_reports with both org_id and project_id bound on every request. Order by updated_at DESC, id DESC, fetch limit + 1, and derive nextCursor from the last returned row. A cursor contains only validated timestamp and report ID; it cannot choose a tenant. Apply status as a bound enum filter. Do not join captures/events or infer report ownership from repo + issueNumber.

Return a fixed DTO: report ID, site ID, title, status, repo, linked issue number/URL, createdAt, updatedAt, and nextCursor. Omit reporter contact details, notification delivery errors/configuration, raw payloads, provider errors, browser logs, and screenshot bytes. A caller can use the existing report-by-ID tool for protected evidence metadata, or a linked issue read for its body. Returned text remains untrusted data. Retain defensive credential redaction and output size limits.

## Exact proposed change surface

1. Add functions/api/feedback/reports/index.ts for the project-required, report-owned collection and functions/api/v1/feedback/reports/index.ts as the canonical v1 wrapper, matching the existing route layout.
2. Add only GET /api/v1/feedback/reports (and its canonical compatibility normalization) to functions/lib/api-auth.js projectScopedApiTokenPathSupported. Do not broaden the feedback prefix, mutation allowlist, assets, overview, or incident routes. Existing gateway requiredScope already maps this prefix to feedback:read, so no new gateway scope category is needed.
3. Add focused collection authorization/DTO tests and route-contract tests. Keep all existing report/site/resource checks and signed assertions unchanged.
4. Update scripts/standardize-openapi.mjs with exact GET collection and detail automationScope entries for feedback:read, plus the collection's query/response schemas. Regenerate public/openapi.json and SDK catalogs using the repository's existing generation workflow. Detail is documentation reconciliation; collection is new access.
5. Only after the API extension is approved, implemented, reviewed, and validated, add the new operation to the MCP contract and update its tests and skill. This would add one separately approved tool to the available surface. Do not use a fabricated live endpoint before deployment verification.

## Required security tests

- The correct project's read-only token can list and read its reports; missing feedback:read, expired/revoked token, suspended org, disabled/archived project, or missing selected project fails closed.
- Foreign org/project reports stay hidden, including identical repo + issueNumber across projects and repository reassignment. No foreign capture text, activities, evidence, or notification metadata appears.
- Caller-supplied project/organization selectors conflict with token context and fail. Cursors cannot override tenant scope, inject SQL, bypass bounds, or produce inconsistent pagination at duplicate timestamps.
- Exact DTO and output bounds hold; all mutation verbs, overview routes, asset fetching, and incident operations remain unavailable through this tool.
- Browser/native existing behavior remains unchanged outside the explicitly new collection route. Generated docs and SDK auth declarations match actual gateway and connector admission.

## Approval consequence

Adding this collection grants every valid existing or future feedback:read project token access to the new listing for its own project, not merely this integration's connection token. It exposes report titles/statuses and linked issue references through a new API operation. Approve that narrowly scoped API access expansion and the target deployment separately from generating/storing the user's token. Existing report-by-ID access is not a new permission expansion.

No report edits, resolution emails, configuration writes, or asset downloads are included. Incident access is a separate decision and must not be inferred from feedback approval.

## Sources

- https://github.com/No-Box-Dev/NoxHere/blob/69985fc1623ccda050d46cb6d03fe9b937a2ddfe/services/gateway/src/control/auth.ts
- https://github.com/No-Box-Dev/NoxHere/blob/69985fc1623ccda050d46cb6d03fe9b937a2ddfe/functions/lib/api-auth.js
- https://github.com/No-Box-Dev/NoxHere/blob/69985fc1623ccda050d46cb6d03fe9b937a2ddfe/functions/_middleware.js
- https://github.com/No-Box-Dev/NoxHere/blob/69985fc1623ccda050d46cb6d03fe9b937a2ddfe/functions/api/feedback/reports/%5Bid%5D.ts
- https://github.com/No-Box-Dev/NoxHere/blob/69985fc1623ccda050d46cb6d03fe9b937a2ddfe/functions/api/feedback/project-overview.ts
- https://github.com/No-Box-Dev/NoxHere/blob/69985fc1623ccda050d46cb6d03fe9b937a2ddfe/scripts/standardize-openapi.mjs
