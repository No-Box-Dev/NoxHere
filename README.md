# NoxCue

Know how your app did today—and know immediately when it did not.

NoxCue accepts a deliberately small, closed event catalog:

- a registered user;
- an active user;
- an explicit error that is saved and delivered to Slack immediately;

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

Both use `POST /v1/events` with a secret server key. NoxCue hashes the user ID,
deduplicates the facts, and derives the daily statistics. See
[`docs/EVENT_INGESTION.md`](./docs/EVENT_INGESTION.md) for the contract.

NoxCue is not an observability or general product-analytics system. It does not
collect logs, traces, OTLP, arbitrary metrics, sessions, funnels, or arbitrary
activity names and properties.

## Local development

```bash
npm install
npm run check
npm run dev
```

NoxConnect owns migrations, organization identity, source settings, the metric
catalog, Slack OAuth/routing, digest scheduling, delivery retries, and retention.
Do not apply reference migrations from this repository to production.
