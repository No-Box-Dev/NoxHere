# Ticket service

Ticket owns planning and delivery workflow: features, specifications, priority,
links, and attachments. It is a private service consumed through Gateway and
does not own GitHub or Slack credentials.

- **Data:** the Ticket D1 migrations and specification attachment R2 bucket.
- **Outbound boundary:** provider-neutral commands executed by Connect.
- **Non-ownership:** authentication, connection credentials, Feed activity,
  Cue incidents, and Spot feedback capture.

Validate with `npm test`, `npm run typecheck`, and `npm run build` from this
directory.
