# Cue service

- **Product area:** Incidents
- **Runtime:** `noxcue`
- **Owns:** event ingestion, feature-health policy, incident grouping,
  monitoring, metrics, digests, and browser/server/Python SDK contracts.
- **Does not own:** GitHub or Slack credentials and provider mutations.
- **Data:** Cue tables in the shared core D1 during the consolidation window.
- **Outbound boundary:** provider-neutral transport commands through the shared
  outbox.

Validate with `npm run check` from this directory.
