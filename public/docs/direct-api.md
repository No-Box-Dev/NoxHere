# Direct HTTP API

The NoxHere SDKs are optional conveniences. Every supported operation remains
available through the HTTPS API described by [`/openapi.json`](/openapi.json).
The hosted base URL is `https://app.noxhere.com`; self-hosted installations use
their own gateway URL.

## Official SDKs

Install the unified Python SDK from
[`noxhere` on PyPI](https://pypi.org/project/noxhere/):

```bash
python -m pip install --upgrade noxhere
```

```python
from noxhere import NoxHereClient

nox = NoxHereClient(token="nox_sk_...")
services = nox.workspace.list_nox_services()
```

The TypeScript package is
[`@noxhere/sdk` on npm](https://www.npmjs.com/package/@noxhere/sdk):

```bash
npm install @noxhere/sdk
```

New Python integrations should use `noxhere`; the former `noxcue` package is
only a compatibility forwarder.

## Authentication

Use the credential intended for the caller:

- automation: `Authorization: Bearer $NOXHERE_API_TOKEN` with a project-bound
  `nox_sk_…` token;
- native applications: `Authorization: Bearer $NOXHERE_ACCESS_TOKEN` with a
  short-lived `nox_at_…` token, plus `X-Org` for organization operations;
- browser applications: the HttpOnly session cookie, plus `X-CSRF-Token` for
  mutations;
- incident ingestion: `X-Nox-Ingest-Key: $NOXHERE_INGEST_KEY`; and
- public NoxSpot capture: no platform bearer credential.

Never send GitHub or Slack credentials to the public API. Automation tokens
already carry their organization and project bounds, so `X-Org` and
`X-Project-ID` are optional and may only repeat those values.

## The same request, with or without an SDK

List the services available to an automation token directly:

```bash
curl --request GET \
  'https://app.noxhere.com/api/v1/services' \
  --header "Authorization: Bearer $NOXHERE_API_TOKEN"
```

```js
const response = await fetch("https://app.noxhere.com/api/v1/services", {
  headers: { Authorization: `Bearer ${process.env.NOXHERE_API_TOKEN}` },
});
if (!response.ok) throw await response.json();
const catalog = await response.json();
```

```python
import os
import requests

response = requests.get(
    "https://app.noxhere.com/api/v1/services",
    headers={"Authorization": f"Bearer {os.environ['NOXHERE_API_TOKEN']}"},
    timeout=10,
)
response.raise_for_status()
catalog = response.json()
```

The equivalent SDK calls are:

```ts
import { createNoxHere } from "@noxhere/sdk";

const nox = createNoxHere({ token: process.env.NOXHERE_API_TOKEN });
const catalog = await nox.workspace.listNoxServices();
```

```python
import os
from noxhere import NoxHereClient

nox = NoxHereClient(token=os.environ["NOXHERE_API_TOKEN"])
catalog = nox.workspace.list_nox_services()
```

## Errors and retries

All canonical `/api/v1/*` failures use the same envelope:

```json
{
  "apiVersion": 1,
  "error": {
    "code": "resource_not_found",
    "message": "The requested resource was not found"
  }
}
```

Branch on `error.code`, not `message`. Honor `Retry-After` on `429`. Before a
write, inspect the operation's `x-change-safety` value. Do not automatically
retry destructive or non-idempotent writes, and use the latest `ETag` as
`If-Match` when an operation requires revision protection.

## Complete reference

The [developer reference](/developers#operations) generates a copyable `curl`
command for every operation directly from OpenAPI. Required path, query,
header, authentication, body, and per-operation server information therefore
changes with the contract instead of being maintained as a separate route
list.

Use the raw OpenAPI document with any standard generator or HTTP client if the
official TypeScript and Python SDKs do not fit the target runtime.
