# NoxHere contracts

Provider-neutral contracts shared across NoxHere services:

- `platform-events.ts` defines the unified event envelope and domain/type
  catalog.
- `transport-commands.ts` defines Slack and GitHub transport commands,
  receipts, callbacks, retry metadata, and runtime validation.
- `feedback-defaults.ts` defines the shared Feedback widget presentation
  defaults used by the app and capture service.
- Project branding is stored under `settings.branding`, exposed through the
  NoxHere service-config API, and consumed by Feedback widget configuration.
- `native-clients.ts` is the compatibility contract for CLI and installed
  Apple authentication clients, including the narrower legacy exchange set.

Contracts may contain schemas, types, and inert defaults. They must not contain
network clients, credentials, persistence, or service business logic.
