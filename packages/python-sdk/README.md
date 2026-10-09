# `noxhere`

The unified Python client for every NoxHere resource. Its complete operation
catalog is generated from the same OpenAPI contract as `@noxhere/sdk`.

Install the official distribution from [PyPI](https://pypi.org/project/noxhere/):

```bash
python -m pip install --upgrade noxhere
```

```python
from noxhere import NoxHereClient

nox = NoxHereClient(token="nox_sk_...")
services = nox.workspace.list_nox_services()
```

The SDK is optional. The equivalent operation can always be called directly:

```python
import os
import requests

response = requests.get(
    "https://app.noxhere.com/api/v1/services",
    headers={"Authorization": f"Bearer {os.environ['NOXHERE_API_TOKEN']}"},
    timeout=10,
)
response.raise_for_status()
services = response.json()
```

See the repository's [direct HTTP guide](../../public/docs/direct-api.md) and the
OpenAPI-generated operation examples in the developer reference.

Every path, query, body, and response model is generated from NoxHere's
OpenAPI contract and is available through `noxhere.models`. Async applications
use the same generated resources:

```python
from noxhere import AsyncNoxHereClient

nox = AsyncNoxHereClient(token="nox_sk_...")
page = await nox.activity.get_nox_feed(query={"limit": 25})
```

Namespaces are `workspace`, `activity`, `planning`, `feedback`, `stats`, and
`incidents`; `connect`, `feed`, `ticket`, and `spot` are direct compatibility
aliases. The deprecated `cue` facade combines Stats and Incidents operations.
Use `noxhere.stats.create_stats_client`, `noxhere.incidents.create_incident_client`, or
`noxhere.feedback.create_feedback_client` for focused clients.

Server telemetry is available from the same distribution:

```python
import os

from noxhere.telemetry import NoxCueClient

with NoxCueClient(
    key=os.environ["NOXHERE_TELEMETRY_KEY"],
    identity_hash_key=os.environ["NOXHERE_IDENTITY_HASH_KEY"],
    environment="production",
) as telemetry:
    telemetry.track("user.registered", user_id="user-42")
    telemetry.track("records.parsed", user_id="user-42", value=3)
```

`track()` queues delivery and returns immediately; leaving the context flushes
the queue. Identifiers are HMAC-SHA256 protected before JSON serialization and
the original value is never transmitted. Keep the identity key stable—changing
it resets user continuity. Compatibility helpers such as `user.registered()`
and `activity()` delegate to the same contract.

`noxcue` remains available as a deprecated forwarding package for existing
applications; new code should import `noxhere.telemetry`.

`noxhere.events.create_platform_event` builds the same common event envelope
as the TypeScript SDK. Versions, size limits, privacy keys, and the registered
event-type catalog are generated from the canonical platform event contract,
so contract changes make the SDK drift check fail until both languages are
regenerated.
