# Unified event and transport development milestones

This roadmap converts the application to one domain-event envelope and one outbound Slack/GitHub transport without allowing a partially passing milestone to advance.

The executable source of truth is `scripts/platform-milestones.config.mjs`. CI runs every milestone from M0 through `activeMilestone` in order. The runner exits on the first missing setup file, failed command, signal, or non-zero exit status. There is no skip or continue-on-error option.

## Developer workflow

1. Start a milestone branch from a green main branch.
2. Change `activeMilestone` to the next sequential milestone. Do not jump over a milestone.
3. Add the required implementation and tests listed for that milestone.
4. Run `npm run milestones:verify` repeatedly. A failure is the current work item; do not start later milestone work.
5. Run the repository's normal CI checks.
6. Merge only after the active milestone and every prerequisite print `PASSED`.
7. Begin the following milestone in a new branch by advancing `activeMilestone` once.

Useful commands:

```bash
npm run milestones:list
npm run milestones:verify
npm run milestones:verify:all
```

`milestones:verify:all` is a roadmap preview. It intentionally stops at the first future milestone whose setup or tests do not exist yet. It does not mark anything complete.

## Gate invariants

- Milestones always execute in numerical order.
- A targeted run cannot select a milestone after the active milestone.
- Required files are checked before a milestone's commands run.
- Tests run serially and stop on the first failure.
- Every database milestone applies all migrations to a new local D1 directory.
- Provider boundary tests must prove application modules cannot bypass the transport layer.
- A milestone is complete only when its executable gates pass; documentation or a manual checkbox is not sufficient.
- Deployment is not part of a development milestone. Staging and production promotion happen only after M7 and the normal release checks pass.

## M0 — Baseline and enforced gates

Capture the current connection contract and Slack outbox behavior. Test the milestone runner itself, including missing setup and fail-fast behavior. Typecheck the Functions code.

Exit criteria:

- The runner refuses malformed manifests.
- The runner stops before tests when setup is incomplete.
- The runner stops immediately after the first failed gate.
- Existing connection-capability and outbox tests pass.
- CI invokes `milestones:verify`.

## M1 — Unified event envelope

Implement `PlatformEventV1`, its Zod discriminator, the neutral domain catalog, envelope fixtures, payload limits, and privacy validation.

Tests must cover every registered type, unknown types, invalid tenancy, timestamp validation, custom `data`, credential rejection, hashed identities, and envelope-versus-data versioning.

## M2 — Canonical event persistence

Add the append-only `platform_events` store, unique producer/idempotency constraint, tenant indexes, publisher, projection Queue task, and recovery scan.

Tests must cover duplicate publication, Queue failure after persistence, recovery, cross-organization isolation, malformed payloads, correlation/causation IDs, and a fresh migration run.

## M3 — Unified outbound transport

Replace product-specific capability commands with one neutral transport command and receipt. Generalize the existing delivery outbox for Slack and GitHub operations.

Tests must cover command validation, credential rejection, project scoping, atomic claims, duplicate commands, stale claims, retryable versus blocked errors, terminal receipts, and Queue recovery.

## M4 — Slack transport cutover

Move all Slack messages and updates behind the transport publisher and Slack adapter. Producers supply a functional route, never a channel, connection, or token.

Tests must cover route resolution, connection resolution, message validation, idempotency, Slack receipts, retryable provider errors, blocked configuration, and an automated source scan proving there are no direct Slack writes or direct `delivery_outbox` inserts outside the transport layer and migrations.

## M5 — GitHub transport cutover

Move outbound GitHub mutations behind the same transport lifecycle. GitHub reads, reconciliation, OAuth, and inbound webhooks remain separate concerns but share the central GitHub client.

Tests must cover issue create/update/comment, state changes, labels and assignments where used, idempotency markers, installation resolution, rate-limit handling, retry recovery, receipts, and an automated source scan proving application modules do not call GitHub mutation endpoints directly.

## M6 — Projections, replay, and delivery events

Project canonical events into activity, reliability, engagement, and feedback read models. Emit delivery completion/failure events and provide a bounded operator replay command.

Tests must cover projection idempotency, out-of-order delivery, partial projection failure, replay without duplicate Slack/GitHub actions, date/project/type bounds, tenant isolation, and resumable checkpoints.

## M7 — End-to-end cutover

Run the complete event-to-policy-to-transport path locally with fake provider adapters. Keep compatibility API adapters, remove branded internal routes and direct writes, and document recovery operations.

The local E2E must prove:

1. Activity, feedback, reliability, and engagement inputs produce the same envelope shape.
2. Duplicate input produces one canonical event.
3. A delivery policy creates one durable command.
4. Slack and GitHub adapters produce normalized receipts.
5. Retry and recovery do not duplicate external actions.
6. Cross-project access is rejected.
7. Compatibility endpoints translate into the canonical envelope.
8. No legacy provider bypass remains.

M7 also runs the full test suite, Functions typecheck, lint, and the dedicated local E2E. Only after this milestone is green should staging acceptance and deployment begin.
