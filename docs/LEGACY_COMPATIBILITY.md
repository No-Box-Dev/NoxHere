# Legacy compatibility and retirement policy

NoxHere uses the capability names Planning, Activity, Feedback, Telemetry, and Connections. Retired product names are prohibited in active source, configuration, documentation, and schema objects. CI enforces this boundary.

## Approved exceptions

| Exception | Reason | Retirement gate |
| --- | --- | --- |
| Historical migrations containing NoxCue, NoxSpot, NoxTicket, NoxFeed, or `cue_*` | Released migrations are immutable and must continue to describe existing databases. | Never rewrite; new migrations must use capability names. |
| `noxfeed-mac` native-client identifier | Installed App Store clients send this stable protocol value. Removing it would break authentication for released clients. | A supported replacement release exists, production use is zero for 90 consecutive days, and support explicitly approves removal. |
| `dev.noboxdev.noxfeed` in the separate NoxHere Apple repository | Bundle, provisioning, and Keychain identifiers are part of the installed application identity. | Only through a dedicated Apple migration that preserves upgrades, entitlements, and Keychain access. |
| Archived NoxCue, NoxTicket, and NoxSpot GitHub repositories | Read-only provenance for released artifacts, migration history, and security review. | Retain archived. Deletion requires mirrored release artifacts, cleared inbound references, and an explicit owner decision. |
| Published `@noxcue/sdk` versions | Existing consumers must remain installable while they migrate. | Deprecate the package only after Playnist has shipped the unified NoxHere SDK and widget cutover. Do not unpublish historical versions. |

Exceptions are compatibility boundaries, not permission to add new dependencies on retired names. New code and storage must use unified capability terminology.

## Consumer cutover gate

Playnist currently remains the last known active consumer of `@noxcue/sdk`, `VITE_NOXCUE_PUBLIC_KEY`, and the `api.noxspot.dev` widget. Its cutover must preserve Telemetry delivery, browser error capture, identity propagation, Feedback screenshots, CSP restrictions, and deployment secrets. Playnist must add an equivalent legacy-name CI check before the old npm package is deprecated.

## Pre-migration database export retention

Ad hoc D1 exports contain production data and are recovery artifacts, not permanent archives.

- Store exports outside source repositories with owner-only permissions and retain their SHA-256 checksums.
- Retain a pre-migration export for at most 30 days after a successful production cutover.
- Confirm the migration ledger, row preservation, production smoke tests, and ecosystem health before deletion.
- Delete expired SQL exports securely; checksum and audit metadata may remain.
- Never use an expired export to reintroduce data already removed under an approved retention or erasure request.

The schema-standardization exports created on 2026-10-15 expire on 2026-11-14. They are stored under `/Users/jaspermiddendorp/noboxdev/archive/noxhere/schema-standardization-backup-20261015` and must be removed after the retention gate is satisfied.
