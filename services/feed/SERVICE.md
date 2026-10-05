# Feed service

Feed owns activity projections, summaries, narration, and release-note response
policy. The native Apple client remains in its separate repository and consumes
the NoxHere API.

- **Data:** Feed-owned D1 migrations in `migrations/`.
- **Outbound boundary:** provider-neutral transport commands through Connect.
- **Non-ownership:** native client code, authentication, provider credentials,
  Ticket planning, Cue incidents, and Spot capture.

Validate with `npm test`, `npm run docs:check`, and `npm run build` from this
directory.
