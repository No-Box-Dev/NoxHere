# `@noxhere/telemetry-sdk` (compatibility package)

This package forwards to `@noxhere/sdk/telemetry/browser` and
`@noxhere/sdk/telemetry/server`. New applications should install and import
`@noxhere/sdk`; the examples below remain valid for existing applications.

Telemetry detects whether important user-facing outcomes are working. It does not
collect arbitrary logs, traces, sessions, or analytics properties.

## Browser

```ts
import { createTelemetry } from "@noxhere/telemetry-sdk/browser";

const telemetry = createTelemetry({
  key: import.meta.env.PUBLIC_TELEMETRY_BROWSER_KEY,
  environment: "production",
  release: "my-app@1.4.0",
});

await telemetry.auth.signup(() => auth.signUp(input));
```

Browser entry points accept only `nox_pub_…` keys. Configure the exact browser
origins in NoxHere. They expose feature and error detection, but not trusted
user statistics or activity methods. Do not put a server key in frontend code.

## Server

```ts
import { createTelemetry } from "@noxhere/telemetry-sdk/server";

const telemetry = createTelemetry({
  key: process.env.TELEMETRY_SERVER_KEY!,
  environment: "production",
  release: process.env.APP_RELEASE,
  waitUntil: (promise) => executionContext.waitUntil(promise),
});

await telemetry.user.registered(user.id);
await telemetry.activity("custom.journals.added", user.id);
```

Server entry points accept only `nox_secret_…` keys. Pass a platform
`waitUntil` function when wrapped feature reports must continue after the
application response is returned.

## Delivery behavior

Direct event methods resolve to `{ ok, eventId, status?, error? }` and never
throw because Telemetry was unavailable. The SDK retries one transient delivery
with the same event ID, keeps request timeouts short, redacts common credentials
and email addresses, strips URL query strings, and limits payload sizes.

Wrapped feature operations always preserve the application's original return
value or error. Call `await telemetry.flush()` in tests or long-running processes
when you want to wait for background feature reports.

Licensed under PolyForm Noncommercial 1.0.0.
Required Notice: Copyright © 2026 No-Box-Dev (https://github.com/No-Box-Dev/NoxHere)

## Python parity

The sibling `packages/python-sdk` forwards to `noxhere.telemetry`. The unified
TypeScript and Python SDKs consume generated constants from
`packages/sdk-contract/contract.json` and execute the same wire fixtures in CI.
Run `npm run sdk:parity` from `services/telemetry` before changing the public SDK
contract.
