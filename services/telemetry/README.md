# Telemetry

Know how your app did today—and know immediately when it did not.

Telemetry accepts a deliberately small, governed event catalog:

- a registered user;
- an active user;
- an explicit error that is saved and delivered to Slack immediately;
- a standard feature result, or a NoxHere-registered `custom.*` feature result;
- a NoxHere-registered `custom.*` activity event that Telemetry aggregates into total and per-user statistics;

Each source key is scoped to one named environment. Telemetry validates the event's
environment at ingestion, stores environments separately, and gives teams
separate controls for collection, daily digests, and immediate Slack alerts.

```text
App event → Telemetry Worker → hashed user facts in NoxHere D1
                                ├─ aggregate user health → Slack daily brief
                                └─ detections → Slack now + deduplicated GitHub issue
```

## Immediate error

```json
{
  "type": "error.occurred",
  "environment": "production",
  "title": "Invoice generation failed",
  "idempotencyKey": "invoice-1842-attempt-3",
  "data": {
    "errorCode": "PDF_TIMEOUT",
    "fingerprint": "billing/pdf_timeout/generate_invoice",
    "component": "billing"
  }
}
```

Telemetry normally derives a readable incident key such as
`error.occurred/billing/pdf_timeout/generateinvoice`. A server-key caller may
provide `data.fingerprint` to override it when domain knowledge produces a more
stable key; browser keys cannot override grouping. NoxHere can route selected
project environments to GitHub. Repeats update the same open issue at the chosen
cadence, while a recurrence after human closure creates a new linked issue.

## User statistics

```ts
import { createTelemetry } from "@noxhere/sdk/telemetry/server";

const telemetry = createTelemetry({
  key: process.env.TELEMETRY_SERVER_KEY!,
  environment: "production",
  release: process.env.APP_RELEASE,
});

await telemetry.user.registered(user.id);
await telemetry.user.active(user.id);
```

Registration automatically counts as activity for that local day. Call
`userActive` for returning users when they perform a meaningful authenticated
action.

Both use `POST /v1/events` with a secret server key. Telemetry hashes the user ID,
deduplicates the facts, and derives the daily statistics. See
[`docs/EVENT_INGESTION.md`](./docs/EVENT_INGESTION.md) for the contract.

The daily Slack brief can add a one- or two-sentence AI observation above its
chart. Telemetry generates it centrally from the completed-day values, yesterday,
and the 30-day average. It uses the server-only `ANTHROPIC_API_KEY`; if the
provider is unavailable, the normal chart and statistics still post.

Telemetry is not an observability or general product-analytics system. It does not
collect logs, traces, OTLP, arbitrary metrics, sessions, funnels, or arbitrary
activity names and properties. Unknown feature names become one bounded
`UNREGISTERED_FEATURE` error; they never create new features or metrics.

## Detection-first SDK

Wrap the user-facing operation. Telemetry preserves the original result and never
attempts a repair:

```ts
import { createTelemetry } from "@noxhere/sdk/telemetry/browser";

const telemetry = createTelemetry({
  key: import.meta.env.VITE_TELEMETRY_BROWSER_KEY,
  environment: "production",
  release: __APP_VERSION__,
});

await telemetry.auth.signup(() => auth.signUp(input));
```

The SDK adds the occurrence time, runtime, sanitized URL, environment, release,
SDK version, duration, classification, and redacted error details. The ingest key resolves
the authoritative Telemetry source server-side, so an app cannot post across
projects by changing a payload field. Telemetry records the evidence and provides
likely causes and possible fixes to investigate. It never changes application
configuration, retries a product operation, or claims that an incident is fixed.

Install `@noxhere/sdk` and import the explicit `/telemetry/browser` or
`/telemetry/server` entry point. `@noxhere/telemetry-sdk` remains a compatibility shim.
The browser entry accepts only an origin-restricted `nox_pub_…` key; the server
entry accepts only a secret `nox_secret_…` key. Direct reports return a delivery
receipt without throwing into the host app. Wrapped operations report in the
background and preserve the application's original return value or error.

## Local development

```bash
npm install
npm run check
npm run dev
```

NoxHere owns migrations, organization identity, source settings, the metric
catalog, Slack OAuth/routing, digest scheduling, delivery retries, and retention.
The authoritative Telemetry schema migrations live in the platform-level
`migrations/` directory and are applied with the rest of the NoxHere
database; the old standalone reference copies were intentionally retired.
