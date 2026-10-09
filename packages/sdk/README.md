# `@noxhere/sdk`

One SDK for the complete NoxHere API. Its catalog is generated from the
repository's canonical OpenAPI contract and is grouped by functionality:

```ts
import { createNoxHere } from "@noxhere/sdk";

const nox = createNoxHere({ token: process.env.NOXHERE_TOKEN });
const services = await nox.workspace.listNoxServices();
```

The SDK is optional. The equivalent operation can always be called directly:

```ts
const response = await fetch(
  "https://app.noxhere.com/api/v1/services",
  { headers: { Authorization: `Bearer ${process.env.NOXHERE_API_TOKEN}` } },
);
if (!response.ok) throw await response.json();
const services = await response.json();
```

See the repository's [direct HTTP guide](../../public/docs/direct-api.md) and the
OpenAPI-generated operation examples in the developer reference.

Namespaces are `workspace`, `activity`, `planning`, `feedback`, `stats`, and
`incidents`. Compatibility aliases `connect`, `feed`, `ticket`, and `spot`
point to the corresponding objects. The deprecated `cue` facade combines the
`stats` and `incidents` operations so existing integrations continue to work.
Every operation is also available by its
OpenAPI operation ID through `nox.operations` and `nox.request()`.

Path parameters, queries, request bodies, responses, and exported component
models are generated from the same checked OpenAPI contract. Invalid operation
names and malformed inputs fail during TypeScript compilation.

Use `@noxhere/sdk/stats` or `@noxhere/sdk/incidents` for focused clients, or
`@noxhere/sdk/feedback` for a focused public feedback client.

Telemetry is part of the same SDK, with runtime-specific entry points so a
secret ingest key can never be included in a browser bundle:

```ts
import { createNoxCueFromEnv } from "@noxhere/sdk/telemetry/server";

const telemetry = createNoxCueFromEnv();

await telemetry.user.registered("user-42");
await telemetry.events.recordParsed("user-42", "record-7");

// Request-scoped identity adds only the opaque id to telemetry evidence.
const userTelemetry = telemetry.forUser("user-42");
await userTelemetry.auth.login(() => authenticate());
```

Environment bootstrap reads `NOXHERE_INGEST_KEY`,
`NOXHERE_IDENTITY_HASH_KEY`, `NOXHERE_IDENTITY_KEY_ID`,
`NOXHERE_ENVIRONMENT`, and `NOXHERE_RELEASE`. Set
`NOXHERE_TELEMETRY_MODE=memory` for a network-free test client and inspect
`capturedEvents()`. Delivery retries respect `Retry-After`, use a versioned user
agent, and report failure results without changing application outcomes. The
optional `createNoxCueSpanProcessor()` bridge accepts only OpenTelemetry spans
explicitly marked with `noxhere.event.name` and `noxhere.user.id`; it never
captures request spans automatically.

Browser applications import `@noxhere/sdk/telemetry/browser` and use a
`nox_pub_…` key. The compatibility function remains named `createNoxCue`, but
the implementation and wire contract now live only in this package.

Browser tracking accepts only the configured anonymous `website.*` events and
never creates cookies, sessions, fingerprints, or persistent identifiers.
Server identities are HMAC-SHA256 protected before serialization. Keep the
identity key stable—changing it resets user continuity.

`@noxhere/sdk/events` builds the shared versioned event envelope and rejects
oversized data or credential/private-identity fields. Its registered event
types are generated from the canonical platform contract. Each event keeps its
own typed `type` and custom `data` while the outer JSON remains consistent.

Browser apps can load their site-specific feedback widget without managing a
script tag:

```ts
import { installNoxHereWidget } from "@noxhere/sdk/widget";

await installNoxHereWidget({
  siteId: "site-1",
  reporter: {
    name: currentUser.name,
    email: currentUser.email,
    notifyOnResolution: true, // only after the user has consented
  },
});
```

Identity is passed only when the host application explicitly supplies it.
One page can install one site ID; conflicting or concurrent cross-site installs
are rejected so reports cannot be sent to the wrong project.
