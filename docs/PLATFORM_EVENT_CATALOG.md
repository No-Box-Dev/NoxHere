# Platform event contract and catalog

`PlatformEventV1` is the application-wide domain-event envelope. Activity, feedback, reliability, engagement, capability, and delivery functionality use the same top-level JSON. Only `type` and the validated fields inside `data` vary.

The executable contract lives in `packages/contracts/platform-events.ts`. Documentation does not override that schema.

## Envelope

| Field | Required | Meaning |
| --- | --- | --- |
| `specVersion` | yes | Envelope version. Version 1 is currently accepted. |
| `dataVersion` | yes | Version of the selected event type's `data` schema. Version 1 is currently accepted. |
| `id` | yes | Producer-generated UUID. |
| `type` | yes | Registered domain event discriminator. |
| `orgId` | yes | Owning organization. |
| `projectId` | yes | Owning application project. |
| `source` | yes | Technical component and optional configured source that observed the event. |
| `subject` | yes | Stable type and identifier for the affected entity. |
| `actor` | no | Member, GitHub user, anonymous hash, or system actor. |
| `context` | no | Environment, release, request, and URL context. |
| `message` | no | Human-readable presentation text; processing must never depend on it. |
| `occurredAt` | yes | ISO timestamp with an explicit offset. |
| `idempotencyKey` | yes | Producer-stable duplicate key. |
| `correlationId` | no | Groups events and commands in one workflow. |
| `causationId` | no | Identifies the event or command that directly caused this event. |
| `data` | yes | Strict payload selected by `type`. |

`receivedAt` is not supplied by a producer. Canonical persistence assigns it after accepting the event.

## Registered types

| Domain | Event types |
| --- | --- |
| Source control | `source_control.pull_request.opened`, `source_control.pull_request.merged`, `source_control.issue.created` |
| Feedback | `feedback.report.created`, `feedback.report.reopened`, `feedback.report.resolved` |
| Reliability | `reliability.error.detected`, `reliability.incident.opened`, `reliability.incident.resolved` |
| Engagement | `engagement.user.registered`, `engagement.user.active`, `engagement.activity.recorded` |
| Capability | `capability.execution.completed` |
| Delivery | `delivery.notification.queued`, `delivery.notification.delivered`, `delivery.notification.failed` |

Adding a type requires a strict data schema, a catalog entry, valid and invalid fixtures, and a deliberate data-version decision. Arbitrary `custom.*` event types are not accepted. Custom functionality belongs in a registered type with explicitly validated `data` fields.

## Privacy and safety

- Events are limited to 64,000 UTF-8 bytes before parsing or Queue publication.
- Tokens, cookies, passwords, API keys, private keys, and authorization fields are rejected at any nesting depth.
- Direct email and raw user-ID fields are rejected.
- Engagement subject IDs use the form `sha256:<64 lowercase hexadecimal characters>`.
- Anonymous actors may carry only an optional hashed identity.
- Error payloads contain bounded sanitized error fields; raw error objects and credentials are not part of the contract.
- Screenshots and other large artifacts are referenced by an asset ID instead of embedded.

## Evolution

Changing the common envelope requires a new `specVersion`. Changing a type-specific payload incompatibly requires a new `dataVersion` and a schema capable of discriminating that version. Adding an optional field without changing existing meaning may remain within the current data version, but still requires fixtures and compatibility tests.

Consumers must reject unsupported versions instead of interpreting them as the latest contract. Projectors must use `type` and `dataVersion`; they must not branch on human-facing `message` content.
