# Spot service

- **Product area:** Feedback
- **Runtime:** `noxspot-api`
- **Owns:** origin-bound capture, screenshots, feedback rendering, browser
  telemetry, and public resolution responses.
- **Does not own:** GitHub or Slack credentials and provider mutations.
- **Data:** Spot tables in core D1 and the feedback screenshot R2 bucket.
- **Outbound boundary:** provider-neutral GitHub and Slack commands through the
  shared outbox.

Validate with `npm test`, `npm exec tsc -- --noEmit`, and `npm run build` from
this directory.
