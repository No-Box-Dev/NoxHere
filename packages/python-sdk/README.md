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

from noxhere.telemetry import create_noxcue

with create_noxcue() as telemetry:
    telemetry.user.registered("user-42")
    telemetry.events.record_parsed("user-42", "record-7")
```

`create_noxcue()` reads `NOXHERE_INGEST_KEY`, `NOXHERE_IDENTITY_HASH_KEY`,
`NOXHERE_IDENTITY_KEY_ID`, `NOXHERE_ENVIRONMENT`, and `NOXHERE_RELEASE`.
`track()` queues delivery and returns immediately; process shutdown or leaving
the context flushes the queue. Delivery failures are returned or retained for
`flush()` and never raised into the host application. Set
`NOXHERE_TELEMETRY_MODE=memory` in tests, then inspect
`telemetry.captured_events` without making network calls. Identifiers are
HMAC-SHA256 protected before JSON serialization and
the original value is never transmitted. Keep the identity key stable—changing
it resets user continuity. Compatibility helpers such as `user.registered()`
and `activity()` delegate to the same contract. The typed `events` helpers keep
built-in event names out of application strings while event timing remains an
explicit decision at the call site.

`noxcue` remains available as a deprecated forwarding package for existing
applications; new code should import `noxhere.telemetry`.

`noxhere.events.create_platform_event` builds the same common event envelope
as the TypeScript SDK. Versions, size limits, privacy keys, and the registered
event-type catalog are generated from the canonical platform event contract,
so contract changes make the SDK drift check fail until both languages are
regenerated.
