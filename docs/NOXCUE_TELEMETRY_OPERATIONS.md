# NoxCue telemetry operations

## Delivery contract

Use `track(name, ...)` for product activity. Python queues tracking on a single background worker; `close()` and the context manager flush pending work. TypeScript returns a promise. Telemetry errors are returned or swallowed by observation helpers and must never change the host application's outcome.

Each event has a UUID or deterministic idempotency key. Retries reuse the same identity. The SDK retries timeouts, HTTP 408, 429, and 5xx responses up to the configured retry count, respects bounded `Retry-After`, and does not retry ordinary 4xx rejection. Ingest inserts with source-scoped uniqueness, so duplicate delivery cannot double-count.

## Limits and browser policy

- JSON body: 32 KiB maximum.
- Event value: greater than zero and at most 1,000,000,000.
- Browser keys: `nox_pub_…`; anonymous `website.*` events only; exact configured origin and event-name allowlist required.
- Server keys: `nox_secret_…`; rejected whenever a browser `Origin` header is present.
- Ingest throttling: product/user events 1,000 per source per minute, errors 30 per source per minute and 60 per organization per minute, and all events 1,000 per IP per minute. A limited request receives HTTP 429 and `Retry-After: 60`.
- Browser telemetry creates no cookie, fingerprint, local-storage entry, session, or persistent identifier. Anonymous events cannot produce unique-visitor or per-user metrics.

Bot and volumetric abuse should additionally be controlled by Cloudflare WAF/bot rules at the route. Application limits remain authoritative even when edge rules are absent.

## Identity and rollout

Server clients require `NOXHERE_IDENTITY_HASH_KEY` (at least 32 UTF-8 bytes) and optionally `NOXHERE_IDENTITY_KEY_ID`. They send `h1_<key-id>_<base64url HMAC-SHA256>`. Changing the key or key id breaks continuity; rotate only with an explicit reporting boundary. Raw user IDs, emails, clinical/report content, payment details, cookies, and fingerprints are prohibited.

Use separate production keys for every service and separate sources for N1 App and N1 Website. Test and staging use their own non-production sources. Before production, approve the governance and contractual items in `NOXCUE_DATA_GOVERNANCE.md`, configure exact origins/event names, run `npm run telemetry:milestones:verify`, and send test-source events first.
