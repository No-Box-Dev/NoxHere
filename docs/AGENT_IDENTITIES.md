# Agent identities: implementation agreement

An organization owns an agent profile with an immutable ID, name, avatar and
descriptive role. A profile is neither a credential nor a run. Assignment does
not grant access. Project grants are explicit and credentials will be bound to
one agent and project. Human admin tokens must never be shared with agents.

## 1. Inert foundation (this PR)

Add CONTROL_DB `agent_profiles` and `agent_project_grants`, plus neutral typed
subject contracts. Profiles default to disabled; grants default to pending.
The only policy is `assigned_tasks_v1`. SQL enforces organization-consistent
references and immutable identity, and preserves revoked grants. SQL does not
prove that `created_by` is an authorized administrator: future management
handlers must require a freshly verified human admin and audit the action.

No routes, token bindings, auth-context changes, runtime policy activation,
backfill or seeded identities are included. Existing tokens, human auth and MCP
are unchanged. The contract is intentionally not accepted from public inputs.
Credential binding must not ship until restricted agent authorization exists.

Acceptance: apply the full migration chain to populated local fixtures; prove
old principals, memberships and tokens survive unchanged; reject foreign-org
agent/project links, duplicate current grants, identity changes and grant
revival. Empty new tables confer no authority.

## 2. Restricted authorization and stable task assignment

Bind dedicated credentials only after implementing the server-side agent policy:
read project work and update progress note, stage and completion report on tasks
currently assigned to that agent. Deny creation, reassignment, deletion and
configuration independently of broad `planning:write`. Intersect credential
scopes, current project grant, active profile, existing route/resource checks
and this policy. No agent admin privileges or creator fallback.

Current `services/planning/src/tasks.ts` allows owner, creator or administrator
edits. Preserve human behavior, but agents use a separate branch. Include current
assignee and revision in the mutation predicate so stale reads cannot authorize
updates after reassignment. Task/workflow ownership gains typed stable IDs;
legacy logins remain compatible and ambiguous backfills remain unresolved.
Old clients cannot overwrite agent ownership. Assignment never creates grants.

Acceptance: two organizations and two projects; foreign task IDs, forged actor
fields, stale revisions, concurrent reassignment, removed grants and revoked or
expired tokens fail. Credential rotation preserves identity. Disable revokes
credentials; re-enable never restores them. Deferred privileged work rechecks
authorization. Already committed work is not undone by revocation.

## 3. Durable activity and human acceptance

Gateway-resolved identity travels in verified signed assertions and Planning
RPC scope. Store each task mutation and its event-outbox entry atomically in
Planning, then retry idempotent delivery through PlatformEventV1. Add an agent
actor variant with immutable ID and historical display snapshot. Correlate
requests without building a full run UI. Never persist secrets in audit data.

Agent-reported completion is distinct from human acceptance/final completion.
An authorized human accepts the current assignment/revision; reassignment
invalidates stale pending acceptance without erasing its history. Durable
attribution proves who submitted an update, not that their claim is correct.

Acceptance: rollback leaves neither mutation nor event; retry produces one
logical event; historical attribution survives rename, rotation and disable;
agents cannot accept their own reports or forge a human actor.

## 4. UI, narrow MCP tools and rollout

Add Agents settings, project assignee choices, disabled status, Activity entries
and human acceptance. Extend MCP with self/assigned-task reads and one strict
task-update tool through existing gateway enforcement. Fixed routes, strict
fields, revisions and idempotency are mandatory; timeout means uncertain outcome
until reconciled. No identity/grant management MCP tools. Update OpenAPI, SDKs
and CLI parity with public API additions.

Acceptance: REST/MCP denial parity, human compatibility, local migration and
event replay fixtures. Deploy readers/consumers before gated writers; keep
legacy human/token behavior. Archived identities remain visible in history.

## Approval and release boundary

This is a review-only draft. Root review is required before merge. Main CI can
automatically deploy migrations; do not merge or dispatch deployment merely to
test this feature. Earlier MCP rollout approval does not authorize this feature.
Actual profile provisioning, project scopes/grants, credential creation and
secure connection configuration each require explicit later approval. No live
identity, permission, credential or deployment is authorized by this document.
