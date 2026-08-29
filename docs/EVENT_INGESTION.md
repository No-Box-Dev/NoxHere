# NoxCue V1 ingestion

`POST /v1/events` accepts a closed catalog with `X-Nox-Ingest-Key`:
`user.registered`, `user.active`, and the immediate `error.occurred` cue.

## User statistics

Instrument the two lifecycle moments; do not calculate metrics in the app:

```ts
await noxcue.userRegistered(user.id);
await noxcue.userActive(user.id);
```

The wire events contain only the stable app user identifier and an optional
timestamp:

```json
{ "type": "user.registered", "userId": "app-user-1842" }
```

NoxCue hashes the identifier before storage. It retains one registration fact
per source/user and one activity fact per source/user/local-day, then derives
new users, total users, DAU, WAU, MAU, DAU/MAU, yesterday, and 30-day averages.

## Immediate error

```json
{
  "type": "error.occurred",
  "title": "Invoice generation failed",
  "idempotencyKey": "invoice-1842-attempt-3",
  "message": "PDF generation timed out",
  "data": {
    "errorCode": "PDF_TIMEOUT",
    "fingerprint": "invoice:pdf-timeout",
    "component": "billing",
    "environment": "production",
    "affectedUser": "opaque-user-reference",
    "fatal": false,
    "unhandled": true
  }
}
```

Errors are saved immediately. The first occurrence of a fingerprint is sent to
Slack; repeats notify only after the source cooldown while still contributing
to the daily totals. NoxCue hashes `affectedUser` before storing it in the
affected-user rollup.

## Limits

- 32 KiB request body
- 1,000 requests/minute per edge IP and per user-event source
- 30 immediate errors/minute per source
- 60 total submissions/minute per organization
- Exact browser origins; no wildcards

Cloudflare’s edge rate limiter is a permissive burst guard. Schema bounds,
idempotency, database uniqueness, and error cooldowns are authoritative.
