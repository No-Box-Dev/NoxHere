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
