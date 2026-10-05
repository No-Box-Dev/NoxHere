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

Use `@noxhere/sdk/incidents` for the focused incident client and existing
NoxCue event instrumentation, or `@noxhere/sdk/feedback` for a focused public
feedback client.
