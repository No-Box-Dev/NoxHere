# `noxhere`

The unified Python client for every NoxHere resource. Its 149-operation
catalog is generated from the same OpenAPI contract as `@noxhere/sdk`.

```python
from noxhere import NoxHereClient

nox = NoxHereClient(token="nox_sk_...")
projects = nox.workspace.list_projects()
incidents = nox.incidents.get_project_incidents(path={"projectId": "project-1"})
```

Namespaces are `workspace`, `activity`, `planning`, `feedback`, and
`incidents`; `connect`, `feed`, `ticket`, `spot`, and `cue` are compatibility
aliases. Use `noxhere.incidents.create_incident_client` or
`noxhere.feedback.create_feedback_client` for focused clients.
