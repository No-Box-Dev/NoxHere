from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping, Protocol, Sequence
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

from ._operations import OPERATIONS

JsonValue = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
TransportResult = tuple[int, Mapping[str, str], bytes]


class Transport(Protocol):
    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> TransportResult: ...


class AsyncTransport(Protocol):
    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> Awaitable[TransportResult]: ...


class NoxHereApiError(RuntimeError):
    def __init__(self, status: int, operation_id: str, details: Any) -> None:
        super().__init__(f"NoxHere {operation_id} failed with HTTP {status}")
        self.status = status
        self.operation_id = operation_id
        self.details = details


@dataclass(frozen=True)
class Operation:
    operation_id: str
    method: str
    path: str
    namespace: str


def _snake(value: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", value).lower()


def _default_transport(method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> TransportResult:
    request = Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urlopen(request, timeout=30) as response:  # noqa: S310 - URL is bound to configured NoxHere origin
            return response.status, dict(response.headers.items()), response.read()
    except HTTPError as error:
        return error.code, dict(error.headers.items()), error.read()


async def _default_async_transport(method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> TransportResult:
    return await asyncio.to_thread(_default_transport, method, url, headers, body)


def _payload(headers: Mapping[str, str], body: bytes) -> Any:
    if not body:
        return None
    content_type = next((value for key, value in headers.items() if key.lower() == "content-type"), "")
    if "json" in content_type.lower():
        return json.loads(body)
    if content_type.lower().startswith("text/"):
        return body.decode()
    return body


class ResourceClient:
    def __init__(self, client: "NoxHereClient", operations: Sequence[Operation]) -> None:
        self._client = client
        self._operations = {_snake(operation.operation_id): operation.operation_id for operation in operations}
        self._operations.update({operation.operation_id: operation.operation_id for operation in operations})

    def __getattr__(self, name: str) -> Callable[..., Any]:
        operation_id = self._operations.get(name)
        if operation_id is None:
            raise AttributeError(name)

        def invoke(**kwargs: Any) -> Any:
            return self._client.request(operation_id, **kwargs)

        return invoke

    def operation_ids(self) -> tuple[str, ...]:
        return tuple(sorted(set(self._operations.values())))


class AsyncResourceClient:
    def __init__(self, client: "AsyncNoxHereClient", operations: Sequence[Operation]) -> None:
        self._client = client
        self._operations = {_snake(operation.operation_id): operation.operation_id for operation in operations}
        self._operations.update({operation.operation_id: operation.operation_id for operation in operations})

    def __getattr__(self, name: str) -> Callable[..., Awaitable[Any]]:
        operation_id = self._operations.get(name)
        if operation_id is None:
            raise AttributeError(name)

        async def invoke(**kwargs: Any) -> Any:
            return await self._client.request(operation_id, **kwargs)

        return invoke

    def operation_ids(self) -> tuple[str, ...]:
        return tuple(sorted(set(self._operations.values())))


def _request_parts(
    *,
    base_url: str,
    operations: Mapping[str, Operation],
    default_headers: Mapping[str, str],
    operation_id: str,
    path: Mapping[str, str | int] | None,
    query: Mapping[str, str | int | float | bool | Sequence[str | int | float | bool] | None] | None,
    body: JsonValue | str | bytes | None,
    headers: Mapping[str, str] | None,
) -> tuple[Operation, str, Mapping[str, str], bytes | None]:
    operation = operations.get(operation_id)
    if operation is None:
        raise ValueError(f"Unknown NoxHere operation: {operation_id}")
    values = dict(path or {})

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values or values[key] == "":
            raise ValueError(f"Missing path parameter: {key}")
        return quote(str(values[key]), safe="")

    operation_path = re.sub(r"\{([^}]+)\}", replace, operation.path)
    pairs: list[tuple[str, str]] = []
    for key, value in (query or {}).items():
        if value is None:
            continue
        items = value if isinstance(value, (list, tuple)) else [value]
        pairs.extend((key, str(item).lower() if isinstance(item, bool) else str(item)) for item in items)
    url = urljoin(base_url, operation_path)
    if pairs:
        url += "?" + urlencode(pairs)
    request_headers = {**default_headers, **dict(headers or {})}
    if body is None:
        encoded = None
    elif isinstance(body, bytes):
        encoded = body
    elif isinstance(body, str):
        encoded = body.encode()
    else:
        request_headers["Content-Type"] = "application/json"
        encoded = json.dumps(body, separators=(",", ":")).encode()
    return operation, url, request_headers, encoded


class NoxHereClient:
    def __init__(
        self,
        *,
        base_url: str = "https://app.noxhere.com",
        token: str | None = None,
        organization: str | None = None,
        project_id: str | None = None,
        csrf_token: str | None = None,
        headers: Mapping[str, str] | None = None,
        transport: Transport = _default_transport,
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self._transport = transport
        self._headers = dict(headers or {})
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        if organization:
            self._headers["X-Org"] = organization
        if project_id:
            self._headers["X-Project-ID"] = project_id
        if csrf_token:
            self._headers["X-CSRF-Token"] = csrf_token
        self._operations = {
            item[0]: Operation(operation_id=item[0], method=item[1], path=item[2], namespace=item[3])
            for item in OPERATIONS
        }
        resources = {
            namespace: ResourceClient(self, [operation for operation in self._operations.values() if operation.namespace == namespace])
            for namespace in ("workspace", "activity", "planning", "feedback", "incidents")
        }
        self.workspace = resources["workspace"]
        self.activity = resources["activity"]
        self.planning = resources["planning"]
        self.feedback = resources["feedback"]
        self.incidents = resources["incidents"]
        self.connect = self.workspace
        self.feed = self.activity
        self.ticket = self.planning
        self.spot = self.feedback
        self.cue = self.incidents

    def request(
        self,
        operation_id: str,
        *,
        path: Mapping[str, str | int] | None = None,
        query: Mapping[str, str | int | float | bool | Sequence[str | int | float | bool] | None] | None = None,
        body: JsonValue | str | bytes | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        operation, url, request_headers, encoded = _request_parts(
            base_url=self.base_url, operations=self._operations, default_headers=self._headers,
            operation_id=operation_id, path=path, query=query, body=body, headers=headers,
        )
        status, response_headers, response_body = self._transport(operation.method, url, request_headers, encoded)
        result = _payload(response_headers, response_body)
        if not 200 <= status < 300:
            raise NoxHereApiError(status, operation_id, result)
        return result

    def operation_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._operations))


class AsyncNoxHereClient:
    def __init__(
        self,
        *,
        base_url: str = "https://app.noxhere.com",
        token: str | None = None,
        organization: str | None = None,
        project_id: str | None = None,
        csrf_token: str | None = None,
        headers: Mapping[str, str] | None = None,
        transport: AsyncTransport = _default_async_transport,
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self._transport = transport
        self._headers = dict(headers or {})
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        if organization:
            self._headers["X-Org"] = organization
        if project_id:
            self._headers["X-Project-ID"] = project_id
        if csrf_token:
            self._headers["X-CSRF-Token"] = csrf_token
        self._operations = {
            item[0]: Operation(operation_id=item[0], method=item[1], path=item[2], namespace=item[3])
            for item in OPERATIONS
        }
        resources = {
            namespace: AsyncResourceClient(self, [operation for operation in self._operations.values() if operation.namespace == namespace])
            for namespace in ("workspace", "activity", "planning", "feedback", "incidents")
        }
        self.workspace = resources["workspace"]
        self.activity = resources["activity"]
        self.planning = resources["planning"]
        self.feedback = resources["feedback"]
        self.incidents = resources["incidents"]
        self.connect = self.workspace
        self.feed = self.activity
        self.ticket = self.planning
        self.spot = self.feedback
        self.cue = self.incidents

    async def request(
        self,
        operation_id: str,
        *,
        path: Mapping[str, str | int] | None = None,
        query: Mapping[str, str | int | float | bool | Sequence[str | int | float | bool] | None] | None = None,
        body: JsonValue | str | bytes | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        operation, url, request_headers, encoded = _request_parts(
            base_url=self.base_url, operations=self._operations, default_headers=self._headers,
            operation_id=operation_id, path=path, query=query, body=body, headers=headers,
        )
        status, response_headers, response_body = await self._transport(operation.method, url, request_headers, encoded)
        result = _payload(response_headers, response_body)
        if not 200 <= status < 300:
            raise NoxHereApiError(status, operation_id, result)
        return result

    def operation_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._operations))


def create_noxhere(**options: Any) -> NoxHereClient:
    return NoxHereClient(**options)


def create_async_noxhere(**options: Any) -> AsyncNoxHereClient:
    return AsyncNoxHereClient(**options)
