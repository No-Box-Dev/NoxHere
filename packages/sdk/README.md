# `@noxcue/sdk`

NoxCue detects whether important user-facing outcomes are working. It does not
collect arbitrary logs, traces, sessions, or analytics properties.

## Browser

```ts
import { createNoxCue } from "@noxcue/sdk/browser";

const noxcue = createNoxCue({
  key: import.meta.env.PUBLIC_NOXCUE_KEY,
});

await noxcue.auth.signup(() => auth.signUp(input));
```

Browser entry points accept only `nox_pub_…` keys. Configure the exact browser
origins in NoxConnect. They expose feature and error detection, but not trusted
user statistics or activity methods. Creating a client captures nothing by
default. Report known user-impacting actions explicitly. If an application
deliberately wants global browser listeners, it must opt in with
`captureUnhandled: true`. Do not put a server key in frontend code.

## Server

```ts
import { createNoxCue } from "@noxcue/sdk/server";

const noxcue = createNoxCue({
  key: process.env.NOXCUE_SERVER_KEY!,
});

await noxcue.user.registered(user.id);
await noxcue.activity("custom.journals.added", user.id);
```

Server entry points accept only `nox_secret_…` keys. Pass a platform
`waitUntil` function when wrapped feature reports must continue after the
application response is returned.

## Framework adapters

Fetch and Next.js-style handlers can report thrown errors and 5xx responses
without changing the response:

```ts
import { createNoxCue, withNoxCue } from "@noxcue/sdk/server";

const noxcue = createNoxCue({ key: process.env.NOXCUE_SERVER_KEY! });
export const POST = withNoxCue(noxcue, async (request) => save(request));
```

Cloudflare Pages can create the client from an environment binding:

```ts
import { createNoxCue, withNoxCuePages } from "@noxcue/sdk/server";

export const onRequest = withNoxCuePages(
  ({ env }) => createNoxCue({ key: env.NOXCUE_SERVER_KEY }),
  async (context) => handleRequest(context),
);
```

Express can keep its existing error flow:

```ts
app.use(noxCueExpressErrorHandler(noxcue));
```

## Delivery behavior

Direct event methods resolve to `{ ok, eventId, status?, error? }` and never
throw because NoxCue was unavailable. The SDK retries transient delivery twice
by default with the same event ID, keeps request timeouts short, redacts common credentials
and email addresses, strips URL query strings, and limits payload sizes.

The source key supplies the project and environment, so those values do not
need to be repeated in application code. Release is inferred on common hosting
platforms when available. Critical errors are sent immediately rather than held
for a batch; `flush()` tracks every background delivery for tests and shutdown.

Wrapped feature operations always preserve the application's original return
value or error. Call `await noxcue.flush()` in tests or long-running processes
when you want to wait for background feature reports.

Licensed under PolyForm Noncommercial 1.0.0.
Required Notice: Copyright © 2026 No-Box-Dev (https://github.com/No-Box-Dev/NoxCue)
