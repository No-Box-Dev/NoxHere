# Error ingestion v1

NoxAlert v1 is event-driven. It accepts bounded browser error envelopes, groups
matching errors, and sends eligible notifications through the shared Nox Slack
outbox. It does not require an OpenTelemetry Collector or telemetry warehouse.

## Browser contract

```http
POST /v1/errors
Content-Type: application/json
X-Nox-Ingest-Key: nox_...
```

```json
{
  "version": 1,
  "service": "n1-care-frontend",
  "environment": "production",
  "release": "2026.08.14",
  "error": {
    "type": "TypeError",
    "message": "Cannot read properties of undefined",
    "stack": "TypeError: ..."
  },
  "page": {
    "url": "https://n1.care/checkout",
    "route": "/checkout"
  },
  "trace": {
    "traceId": "0123456789abcdef0123456789abcdef",
    "spanId": "0123456789abcdef"
  },
  "tags": {
    "component": "Checkout"
  }
}
```

Trace and span IDs are optional. Applications already using OpenTelemetry can
attach the active IDs without sending the full OTLP payload.

The React helper is initialized once near application startup:

```ts
import { createNoxAlert } from "./noxalert";

export const noxAlert = createNoxAlert({
  endpoint: "https://noxalert.example.com",
  ingestKey: import.meta.env.VITE_NOXALERT_INGEST_KEY,
  service: "n1-care-frontend",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});

noxAlert.installGlobalHandlers();
```

React error boundaries call `noxAlert.capture(error)` from `componentDidCatch`.
The global handlers cover uncaught errors and unhandled promise rejections.

## Project settings

The NoxAlert project screen exposes two sections.

### Ingestion

- Enabled
- Allowed browser origins, as exact origins such as `https://n1.care`
- Public write-only ingest keys, with create, rotate, last-used, and revoke

### Error rules

Each rule contains:

- Name and Slack destination
- Environments and services to include
- Additional `equals`, `starts with`, or `contains` conditions
- Exclusion conditions for known noise
- Notify after N occurrences within a time window
- Repeat notification interval

The form does not accept SQL or regular expressions. Conditions operate on a
fixed list of fields: service, environment, release, error type/message, page
URL, and route. Matching is case-insensitive. All include conditions must match;
any exclusion condition suppresses the error.

A sensible default rule is:

```json
{
  "name": "Production errors",
  "enabled": true,
  "filters": {
    "environments": ["production"],
    "services": [],
    "include": [],
    "exclude": []
  },
  "notifyAfterCount": 1,
  "windowSeconds": 300,
  "repeatAfterSeconds": 900
}
```

Filtering is always enforced by NoxAlert. Client-side suppression is only an
optimization and cannot override the saved project policy.

## Rate and noise controls

- 32 KiB maximum request body
- 120 requests/minute per source IP before authentication
- 600 accepted errors/minute per project key scope
- 50 enabled rules evaluated per project request (the settings UI caps projects at 20)
- Exact allowed-origin enforcement for browsers
- One aggregate D1 row per rule/fingerprint instead of one row per occurrence
- First matching error alerts immediately by default
- Identical errors update their occurrence count and notify no more than every
  15 minutes by default

The Cloudflare counters are abuse guards, not billing counters: they are local
to a Cloudflare location and intentionally eventually consistent. Durable
fingerprint grouping in D1 is the notification-storm control.
