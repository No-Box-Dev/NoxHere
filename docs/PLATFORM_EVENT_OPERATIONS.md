# Unified event and transport operations

NoxConnect is one application. Activity, Feedback, Incidents, and Planning are capabilities that share the same tenant/project identity, event envelope, and outbound transport lifecycle.

## Runtime path

1. Producers validate and persist `PlatformEventV1` in `platform_events`.
2. Queue task `project_platform_event` projects the immutable fact into the appropriate read model.
3. Slack and GitHub producers validate a `platform.transport-command` and persist it in `transport_outbox`.
4. Queue task `deliver_transport` resolves provider credentials and destinations inside the adapter, performs the mutation, and stores a normalized receipt.
5. Queue task `finalize_transport` applies product state that depends on the receipt. Finalization retries never replay the provider mutation.
6. The scheduled delivery-event sweep publishes queued and terminal transport states back through `PlatformEventV1`.

The cron recovery sweep requeues stale or failed event projections, transport commands, transport callbacks, and missing delivery lifecycle events.

## Replay

Replay is dry-run by default and is always scoped to an organization and project:

```sh
node scripts/replay-platform-events.mjs --org-id 7 --project-id checkout
```

Review the generated bounded `UPDATE`, then choose one target explicitly:

```sh
node scripts/replay-platform-events.mjs --org-id 7 --project-id checkout --types feedback.report.created,feedback.report.resolved --limit 500 --local --execute
```

Use `--remote --execute` only during an approved production operation. A run can reset at most 5,000 events. Replay does not delete projection data; idempotent fact inserts and event-time guards rebuild current state without allowing an older event to rewind it.

## Failure handling

- `pending`, `queued`, `processing`, and `failed` event rows are recoverable. A projected row is immutable unless explicitly selected for replay.
- Retryable transport failures remain `retrying`; missing configuration becomes `blocked`; exhausted attempts become `failed`.
- Provider receipts are committed before callbacks. If callback processing fails, retry the callback rather than the provider command.
- Never put provider tokens, resolved Slack channels, GitHub installation IDs, emails, or raw user identities into event or transport envelopes.

Run `npm run milestones:verify` before deployment. The active milestone stops immediately on the first failed migration, boundary, test, type, lint, or local E2E gate.
