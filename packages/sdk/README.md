# `@noxhere/sdk`

One SDK for the complete NoxHere API. Its catalog is generated from the
repository's canonical OpenAPI contract and is grouped by functionality:

```ts
import { createNoxHere } from "@noxhere/sdk";

const nox = createNoxHere({ token: process.env.NOXHERE_TOKEN });
const projects = await nox.workspace.listProjects();
const incidents = await nox.incidents.getProjectIncidents({
  path: { projectId: "project-1" },
});
```

Namespaces are `workspace`, `activity`, `planning`, `feedback`, and
`incidents`. Compatibility aliases `connect`, `feed`, `ticket`, `spot`, and
`cue` point to the same objects. Every operation is also available by its
OpenAPI operation ID through `nox.operations` and `nox.request()`.

Path parameters, queries, request bodies, responses, and exported component
models are generated from the same checked OpenAPI contract. Invalid operation
names and malformed inputs fail during TypeScript compilation.

Use `@noxhere/sdk/incidents` for the focused incident client or
`@noxhere/sdk/feedback` for a focused public feedback client.

Telemetry is part of the same SDK, with runtime-specific entry points so a
secret ingest key can never be included in a browser bundle:

```ts
import { createNoxCue } from "@noxhere/sdk/telemetry/server";

const telemetry = createNoxCue({
  key: process.env.NOXHERE_TELEMETRY_KEY!,
  environment: "production",
});

await telemetry.user.registered("user-42");

// Request-scoped identity adds only the opaque id to telemetry evidence.
const userTelemetry = telemetry.forUser("user-42");
await userTelemetry.auth.login(() => authenticate());
```

Browser applications import `@noxhere/sdk/telemetry/browser` and use a
`nox_pub_…` key. The compatibility function remains named `createNoxCue`, but
the implementation and wire contract now live only in this package.

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
