# NoxCue V1 ingestion

`POST /v1/events` accepts a closed catalog with `X-Nox-Ingest-Key`:
`user.registered`, `user.active`, `activity.occurred`, `feature.result`, and the immediate
`error.occurred` cue.

## Environments and delivery

Every source and ingest key belongs to exactly one environment: `production`,
`staging`, `development`, `preview`, `test`, or `local`. Send the environment at
the top level of every event. NoxCue rejects a mismatch with
`409 environment_mismatch`, which prevents a staging key from contaminating
production statistics. Older clients that omit it inherit the key's environment.

```json
{ "type": "user.registered", "environment": "production", "userId": "app-user-1842" }
```

NoxConnect exposes separate controls for each environment: accept and store
events, send the daily digest, and send immediate Slack alerts. Endpoint
checks also have their own switch; when immediate alerts are paused, checks and
status storage continue without Slack notifications.

## Feature results

NoxCue owns a closed standard catalog. V1 contains these auth journeys:

- `auth.signup`
- `auth.login`
- `auth.password_reset`
- `auth.email_verification`
- `auth.oauth`
- `auth.mfa`
- `auth.session_refresh`
- `auth.logout`

App-specific features use the `custom.*` namespace and must be registered in
NoxConnect before the app sends them. A linked source uses its project catalog,
so staging and production share the same definitions; an unlinked source has an
isolated catalog. Registration owns the display label and default user-impact
message. Sending a valid but unknown
name does not create a feature: NoxCue stores it through the error pipeline as
`UNREGISTERED_FEATURE` and returns `classification: "unregistered"`.
Feature keys are lowercase dot-separated identifiers; each segment may contain
letters, digits, and underscores.

```ts
await noxcue.observe("custom.journal.publish", () => publishJournal(input));
```

Every `failure` includes the bounded technical error object sent by the app.
NoxCue stores both the registered impact message and that technical error, and
includes both in the immediate Slack incident. Expected rejections do not carry
an error and do not alert.

```json
{
  "type": "feature.result",
  "environment": "production",
  "feature": "auth.signup",
  "outcome": "failure",
  "reason": "dependency_unavailable",
  "error": {
    "name": "AuthApiError",
    "message": "Authentication service timed out",
    "code": "AUTH_TIMEOUT",
    "status": 503
  }
}
```

## User statistics

Instrument the two lifecycle moments; do not calculate metrics in the app:

```ts
await noxcue.userRegistered(user.id);
await noxcue.userActive(user.id);
```

The wire events contain only the stable app user identifier and an optional
timestamp:

```json
{ "type": "user.registered", "environment": "production", "userId": "app-user-1842" }
```

NoxCue hashes the identifier before storage. It retains one registration fact
per source/user and one activity fact per source/user/local-day. A registration
also counts as activity on that local day, so a new integration produces DAU
from the same single call. NoxCue then derives
new users, total users, DAU, WAU, MAU, DAU/MAU, yesterday, and 30-day averages.

## Custom activity metrics

Register each `custom.*` activity name in the NoxCue project settings before
the app sends it. The app emits one event after a successful write; it does not
query or aggregate its own database:

```json
{
  "type": "activity.occurred",
  "environment": "production",
  "metric": "custom.journals.added",
  "userId": "app-user-1842",
  "eventId": "89195f9a-4a26-44e6-a147-9f2d003bc7f5"
}
```

`eventId` is required and makes retries idempotent. NoxCue hashes `userId`,
stores the event once, and derives a cumulative total plus cumulative events
per registered user. Unknown names become one `UNREGISTERED_METRIC` error and
never create a metric implicitly.

## Immediate error

```json
{
  "type": "error.occurred",
  "environment": "production",
  "title": "Invoice generation failed",
  "idempotencyKey": "invoice-1842-attempt-3",
  "message": "PDF generation timed out",
  "data": {
    "errorCode": "PDF_TIMEOUT",
    "fingerprint": "invoice:pdf-timeout",
    "component": "billing",
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
- 1,000 requests/minute per edge IP and per user/activity/feature source
- 30 immediate errors/minute per source
- 60 total submissions/minute per organization
- Exact browser origins; no wildcards

Cloudflare’s edge rate limiter is a permissive burst guard. Schema bounds,
idempotency, database uniqueness, and error cooldowns are authoritative.
