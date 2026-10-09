# Telemetry data governance

NoxHere telemetry accepts product counters and bounded operational diagnostics,
not customer content. Server SDKs transform every supplied user identifier with
HMAC-SHA256 before serialization. Browser events are anonymous and must not
contain identity, cookies, fingerprints, or session identifiers. Changing the
identity hashing key resets user continuity.

## Storage and access

Data is scoped by organization, project, source, and environment. Admin
authorization protects source, card, retention, deletion, and key operations.
Ingest secrets are displayed only during creation or rotation; NoxHere stores
only their SHA-256 hashes. Creation, rotation, revocation, last-use time, and
daily usage are auditable.

## Retention and deletion

Each source configures event retention from 7–730 days. Scheduled cleanup
deletes expired active-user, activity, and tracked-event rows. Deleting a source
cascades through its events, configuration, keys, usage, and audit rows.
Aggregate metric history and registrations currently remain until source
deletion. Backups follow the platform backup lifecycle and are restored only
for disaster recovery.

## Outputs and environments

Aggregate-only delivery suppresses per-event Slack and GitHub incident output.
Scheduled reports contain aggregates only. Production-stat reports can only use
production sources, so staging, test, preview, development, and local events do
not enter production statistics.

## Security and contractual status

Transport uses HTTPS and Cloudflare-managed encryption at rest. Organization
and project roles plus key audit records provide access control and operational
traceability. Data residency, the subprocessor list, incident-notification
terms, a DPA, and any BAA require business approval and publication before a
regulated production rollout. This documentation does not claim those
approvals.
