# `noxhere`

The unified Python client for every NoxHere resource. Its 149-operation
catalog is generated from the same OpenAPI contract as `@noxhere/sdk`.

```python
from noxhere import NoxHereClient

nox = NoxHereClient(token="nox_sk_...")
projects = nox.workspace.list_projects()
incidents = nox.incidents.get_project_incidents(path={"projectId": "project-1"})
```

Every path, query, body, and response model is generated from NoxHere's
OpenAPI contract and is available through `noxhere.models`. Async applications
use the same generated resources:

```python
from noxhere import AsyncNoxHereClient

nox = AsyncNoxHereClient(token="nox_sk_...")
page = await nox.activity.get_nox_feed(query={"limit": 25})
```

Namespaces are `workspace`, `activity`, `planning`, `feedback`, and
`incidents`; `connect`, `feed`, `ticket`, `spot`, and `cue` are compatibility
aliases. Use `noxhere.incidents.create_incident_client` or
`noxhere.feedback.create_feedback_client` for focused clients.

Server telemetry is available from the same distribution:

```python
from noxhere.telemetry import NoxCueClient

with NoxCueClient(
    key=os.environ["NOXHERE_TELEMETRY_KEY"],
    environment="production",
) as telemetry:
    telemetry.user.registered("user-42")
```

`noxcue` remains available as a deprecated forwarding package for existing
applications; new code should import `noxhere.telemetry`.

`noxhere.events.create_platform_event` builds the same common event envelope
as the TypeScript SDK. Versions, size limits, privacy keys, and the registered
event-type catalog are generated from the canonical platform event contract,
so contract changes make the SDK drift check fail until both languages are
regenerated.
