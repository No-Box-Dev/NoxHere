# NoxCue telemetry development milestones

This plan delivers the simplified NoxCue telemetry API and requirements 1–9:
one `track()` call, automatic server-side identity protection, anonymous browser
activity, browser abuse controls, isolated sources, N1 metrics, privacy controls,
key lifecycle management, and reliable TypeScript/Python releases.

The executable source of truth is
`scripts/noxcue-telemetry-milestones.config.mjs`. The active milestone and every
prerequisite run in order. The runner stops on the first missing file, failed
command, signal, or non-zero exit status. It has no skip or continue-on-error
mode.

The Noxhere App Store and the broader NoxTicket task-manager expansion are not
part of this plan.

## Status

| Milestone | State | Outcome |
| --- | --- | --- |
| M0 | Complete | Lock the existing telemetry behavior and enforce the new gates in CI. |
| M1 | Complete | Add one canonical `track()` contract and compatibility wrappers. |
| M2 | Complete | HMAC-protect every server-side identity before serialization. |
| M3 | Complete | Accept anonymous, allowlisted browser activity safely. |
| M4 | Complete | Isolate source configuration, environments, schedules, and reports. |
| M5 | Complete | Calculate and present the required N1 application metrics. |
| M6 | Complete | Add retention, deletion, access, audit, and aggregate-output controls. |
| M7 | Complete | Complete ingest-key creation, usage, rotation, and revocation controls. |
| M8 | Active | Harden, document, package, and release both SDKs together. |

The status table is descriptive. `activeMilestone` in the executable manifest
is authoritative.

## Developer workflow

1. Start from a green main branch and run `npm run telemetry:milestones:verify`.
2. Work only on the active milestone.
3. Add every required implementation file and test declared by that milestone.
4. Run the active verification repeatedly. A failure is the current work item;
   do not begin a later milestone.
5. Run the repository's normal CI checks.
6. Merge only after every gate through the active milestone prints `PASSED`.
7. In a new branch, advance `activeMilestone` by exactly one and begin the next
   milestone.

Commands:

```bash
npm run telemetry:milestones:list
npm run telemetry:milestones:verify
npm run telemetry:milestones:verify:all
```

`verify:all` previews the roadmap and intentionally stops at the first future
milestone whose implementation or tests do not exist. It never marks a future
milestone complete.

## Invariants

- Milestones execute in numerical order and cannot be skipped.
- Required files are checked before commands run.
- Gates execute serially and stop on the first failure.
- Database changes must apply to a fresh local D1 database.
- TypeScript and Python share wire fixtures for every cross-language behavior.
- Browser telemetry never accepts an identity, cookie, session, or fingerprint.
- Identified telemetry never serializes an unhashed application user ID.
- Public keys cannot submit trusted user, subscription, or distinct-user facts.
- Test and non-production sources never contribute to production reports.
- Telemetry failures never alter the instrumented application's outcome.
- Documentation and generated contracts are tested for drift.

## M0 — Baseline and enforced gates

Capture the current SDK and ingest behavior before changing the public API. Add
this roadmap, its executable manifest and runner, and enforce the active gate in
CI.

Exit criteria:

- The milestone manifest is sequential and has a valid active milestone.
- The existing TypeScript telemetry tests pass.
- The existing Python telemetry tests pass.
- The existing Cue ingest and activity-catalog tests pass.
- CI invokes `telemetry:milestones:verify`.
- A missing future setup file or failed command blocks immediately.

## M1 — One `track()` contract

Introduce the primary API in TypeScript and Python:

```ts
nox.track("records.parsed", { userId: "user-123", value: 3 });
nox.track("website.demo_clicked");
```

Define a versioned wire contract with `eventId`, `name`, `occurredAt`, `value`,
`environment`, optional protected identity, and bounded custom fields. Register
the initial user, subscription, application-activity, and website event names.
Keep the existing `user.registered()`, `user.active()`, `activity()`, and error
helpers as deprecated wrappers around the same implementation.

Tests must cover event-name registration, values, timestamps, payload bounds,
unknown fields, compatibility wrappers, idempotency keys, and byte-for-byte
TypeScript/Python fixture parity.

## M2 — Identity protection before transmission

Add `identityHashKey`/`NOXHERE_IDENTITY_HASH_KEY` and an identity key ID to the
trusted server SDKs. Convert every identity to
`h1_<key-id>_<base64url-hmac-sha256>` before request serialization. Apply the
same rule to registration, active-user, subscription, parsing, reporting,
custom activity, feature, and affected-user paths.

If an identified event has no valid hashing configuration, fail locally and do
not call the network. The original ID must never appear in request URLs,
headers, bodies, SDK logs, exceptions, or snapshots. Noxhere may hash the
protected identity again with the source ID before persistence to prevent
cross-source linkage.

Tests must include shared cryptographic vectors, malformed keys, missing keys,
Unicode identities, rotation key IDs, every identity-bearing event path, and a
wire recorder that searches the complete outbound request for the original ID.

## M3 — Anonymous browser activity and abuse controls

Add count-only browser activity for `nox_pub_` keys. Browser types and runtime
validation must reject `userId`, protected identities, identity hash keys,
subscription state, user totals, and distinct-user facts.

Add source-configured event-name allowlists and retain exact origin matching.
Enforce bounded payloads plus per-key, per-source, and per-IP limits. Limited
requests return `429` with `Retry-After`. Apply Cloudflare abuse controls
without creating application cookies, persistent IDs, sessions, or
fingerprints.

The initial website catalogue is:

- `website.page_visited`
- `website.demo_clicked`
- `website.signup_clicked`
- `website.pricing_clicked`
- `website.login_clicked`
- `website.contact_clicked`

Tests must cover approved and rejected origins, event allowlists, forbidden
identity fields, public/secret key separation, payload limits, each rate-limit
dimension, Retry-After behavior, and proof that browser storage is untouched.

## M4 — Source and environment isolation

Make keys, allowed events, cards, labels, ordering, schedules, report titles,
Slack destinations, and environment policies source-scoped. Support separate
N1 App and N1 Website production sources plus independent staging and test
sources.

Non-production sources must not deliver to a production-only statistics route.
The required report titles are `N1 App — Production Stats` and
`N1 Website — Website Activity`.

Tests must send matching fixtures to multiple sources and prove that storage,
metrics, configuration, schedules, Slack routing, revocation, and environment
validation remain isolated.

## M5 — N1 metrics and report cards

Implement explicit subscription transitions and calculate:

- new and total users;
- new and total trial users;
- new and total paid users;
- trial-to-paid conversion;
- explicit subscription churn;
- DAU and MAU;
- records parsed and reports generated;
- both application activities per active user;
- cumulative distinct users for identified custom activities; and
- conversion between two identified activities.

Anonymous activity produces event counts only. Add source-level card enablement,
ordering, independent daily/cumulative labels, optional per-active-user cards,
and a deterministic limit of 14 cards in at most six Slack presentation groups.

Tests must use seeded user journeys and compare every value with a manually
specified expected result, including duplicates, retries, period boundaries,
late events, anonymous events, zero denominators, and source isolation.

## M6 — Privacy, retention, and governance controls

Publish and enforce a data inventory covering wire fields, database columns,
logs, backups, Slack/GitHub output, staff visibility, residency, encryption,
subprocessors, and deletion behavior.

Add source-level retention settings, scheduled pruning, complete source
deletion, role-gated access, immutable configuration audit records, and an
aggregate-only Slack policy for N1 sources. Document DPA availability and
record the legal decision on whether a BAA is applicable; do not imply that
hashed identities are anonymous or that Noxhere accepts PHI.

Automated gates must validate the retention schedule, deletion coverage,
authorization boundaries, audit entries, forbidden log/output fields, and the
machine-readable data inventory. Legal and security review remains an explicit
human approval recorded alongside the release evidence.

## M7 — Ingest-key lifecycle

Complete `nox_secret_` and `nox_pub_` management with source/environment scope,
show-once secrets, hash-only storage, last-used timestamps, daily usage history,
and immutable create/rotate/revoke audit events. Rotation creates a replacement
key and permits a bounded overlap before independent revocation.

The customer-owned identity HMAC key is never transmitted to or stored by
Noxhere.

Tests must cover one-time display, database and response leakage, wrong-source
and wrong-environment use, public/secret permissions, concurrent rotation,
overlap expiry, immediate revocation, audit history, and independent service
keys.

## M8 — SDK operations and release

Make `track()` non-blocking in Python, retain bounded background delivery and
`flush()`, and guarantee that delivery failures cannot change application
results. Align TypeScript behavior, document retries, `Retry-After`, delivery,
deduplication, idempotency, shutdown, test sources, and exact ingest limits.

Publish TypeScript and Python from the same version tag. Generate checksums,
build provenance, signed release artifacts, compatibility notes, and install
tests using the built packages rather than the source tree.

The final local integration test must exercise identified server tracking,
anonymous browser tracking, source/environment isolation, aggregation, report
rendering, throttling, retry/deduplication, revocation, retention, and deletion
through the real local service boundaries with fake external providers.

M8 passes only when the full repository suite, SDK generation/drift checks,
type checks, package builds, clean-install tests, Cue build, and local
integration test all pass.
