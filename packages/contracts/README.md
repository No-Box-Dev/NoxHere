# NoxHere contracts

Provider-neutral contracts shared across NoxHere services:

- `platform-events.ts` defines the unified event envelope and domain/type
  catalog.
- `transport-commands.ts` defines Slack and GitHub transport commands,
  receipts, callbacks, retry metadata, and runtime validation.
- `noxspot-defaults.ts` defines the shared Feedback widget presentation
  defaults used by the app and capture service.

Contracts may contain schemas, types, and inert defaults. They must not contain
network clients, credentials, persistence, or service business logic.
