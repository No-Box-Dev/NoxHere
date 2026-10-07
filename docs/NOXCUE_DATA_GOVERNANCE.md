# NoxCue data governance

NoxCue accepts product counters and operational diagnostics, not customer content. Server SDKs transform every supplied user identifier with HMAC-SHA256 before serialization. Ingest rejects raw identifiers and stores a second, source-scoped SHA-256 derivative. Browser events are anonymous and must not contain an identity, cookie, fingerprint, or session identifier.

## Storage and access

The authoritative inventory is `docs/noxcue-data-inventory.json`. Data is scoped by organization, project, source, and environment. Admin authorization protects source, card, retention, deletion, and key operations. Key material is displayed only in the creation/rotation response; only SHA-256 key hashes are stored. Creation, rotation, revocation, last-use time, and daily usage are auditable.

## Retention and deletion

Each source configures event retention from 7–730 days. The scheduler deletes expired active-user, activity, and tracked-event rows using that source's setting. Deleting a source cascades through event, configuration, key, usage, and audit tables. Aggregate metric history and registrations currently live until source deletion; customers needing a shorter policy must delete the source or request erasure. Backups follow the platform backup lifecycle and must not be used to restore data that has passed its approved retention except for disaster recovery.

## Outputs

`aggregateOnlySlack` suppresses per-event Slack and GitHub incident delivery. Scheduled reports contain aggregates only. Production-stat reports can only be configured on production sources, so staging, test, preview, development, and local facts cannot enter a production-stat source.

## Security and legal review

Transport uses HTTPS and Cloudflare-managed encryption at rest. Organization/project RBAC and the key audit tables provide access and operational traceability. Data residency, subprocessor list, incident-notification terms, DPA, and any BAA are contractual/platform decisions and must be approved and published by the business before a regulated production rollout; this repository does not claim those approvals.
