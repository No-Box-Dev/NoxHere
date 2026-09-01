# NoxCue

Know how your app did today—and know immediately when it did not.

NoxCue accepts a deliberately small, governed event catalog:

- a registered user;
- an active user;
- an explicit error that is saved and delivered to Slack immediately;
- a standard feature result, or a NoxConnect-registered `custom.*` feature result;
- a NoxConnect-registered `custom.*` activity event that NoxCue aggregates into total and per-user statistics;

```text
App event → NoxCue Worker → hashed user facts in NoxConnect D1
                                ├─ aggregate user health → Slack daily brief
                                └─ errors → delivery_outbox → Queue → Slack now
```

## Immediate error

```json
{
  "type": "error.occurred",
  "title": "Invoice generation failed",
  "idempotencyKey": "invoice-1842-attempt-3",
  "data": {
    "errorCode": "PDF_TIMEOUT",
    "fingerprint": "invoice:pdf-timeout",
    "component": "billing"
  }
}
```

## User statistics

```ts
await noxcue.userRegistered(user.id);
await noxcue.userActive(user.id);
```

Registration automatically counts as activity for that local day. Call
`userActive` for returning users when they perform a meaningful authenticated
action.

Both use `POST /v1/events` with a secret server key. NoxCue hashes the user ID,
deduplicates the facts, and derives the daily statistics. See
[`docs/EVENT_INGESTION.md`](./docs/EVENT_INGESTION.md) for the contract.

The daily Slack brief can add a one- or two-sentence AI observation above its
chart. NoxCue generates it centrally from the completed-day values, yesterday,
and the 30-day average. It uses the server-only `ANTHROPIC_API_KEY`; if the
provider is unavailable, the normal chart and statistics still post.

NoxCue is not an observability or general product-analytics system. It does not
collect logs, traces, OTLP, arbitrary metrics, sessions, funnels, or arbitrary
activity names and properties. Unknown feature names become one bounded
`UNREGISTERED_FEATURE` error; they never create new features or metrics.

## Local development

```bash
npm install
npm run check
npm run dev
```

NoxConnect owns migrations, organization identity, source settings, the metric
catalog, Slack OAuth/routing, digest scheduling, delivery retries, and retention.
Do not apply reference migrations from this repository to production.
