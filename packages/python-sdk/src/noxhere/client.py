from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping, Protocol, Sequence, cast
from urllib.error import HTTPError
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
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
    def __init__(self, status: int, operation_id: str, details: object, headers: Mapping[str, str] | None = None) -> None:
        details_record: Mapping[str, object] = cast(Mapping[str, object], details) if isinstance(details, Mapping) else {}
        structured: object | None = details_record.get("error")
        error: Mapping[str, object] = cast(Mapping[str, object], structured) if isinstance(structured, Mapping) else {}
        error_message: object | None = error.get("message")
        message = error_message if isinstance(error_message, str) else structured if isinstance(structured, str) else f"NoxHere {operation_id} failed with HTTP {status}"
        super().__init__(message)
        self.status = status
        self.operation_id = operation_id
        self.details: object = cast(object, details)
        error_code: object | None = error.get("code")
        self.code = error_code if isinstance(error_code, str) else "request_failed"
        normalized = {key.lower(): value for key, value in (headers or {}).items()}
        self.request_id = normalized.get("x-request-id") or normalized.get("x-nox-request-id")
        self.retry_after = _retry_after_seconds(normalized.get("retry-after"))
        self.retryable = _retryable_status(status)


class NoxHereTransportError(RuntimeError):
    retryable = True

    def __init__(self, operation_id: str, cause: BaseException) -> None:
        super().__init__(f"NoxHere {operation_id} could not reach the API")
        self.operation_id = operation_id
        self.__cause__ = cause


@dataclass(frozen=True)
class Operation:
    operation_id: str
    method: str
    path: str
    namespace: str
    change_safety: str
    servers: tuple[str, ...]


SDK_VERSION = "0.2.0"
MAX_RETRY_AFTER_SECONDS = 30.0


def _retryable_status(status: int) -> bool:
    return status in {408, 429} or status >= 500


def _retry_after_seconds(value: str | None) -> float | None:
    if not value:
        return None
    try:
        delay = float(value)
    except ValueError:
        try:
            delay = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError):
            return None
    return max(0.0, delay) if 0 <= delay <= MAX_RETRY_AFTER_SECONDS else None


def _safe_url(url: str, path: Mapping[str, str | int] | None) -> str:
    safe = url
    for key, value in (path or {}).items():
        if re.search(r"token|key|secret|password|code", key, re.I):
            safe = safe.replace(quote(str(value), safe=""), "[redacted]")
    safe = re.sub(r"([?&][^=]*(?:token|key|secret|password|code)[^=]*=)[^&]*", r"\1[redacted]", safe, flags=re.I)
    return safe


def _snake(value: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", value).lower()


def _default_transport(method: str, url: str, headers: Mapping[str, str], body: bytes | None, timeout: float = 30.0) -> TransportResult:
    request = Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - URL is bound to configured NoxHere origin
            return response.status, dict(response.headers.items()), response.read()
    except HTTPError as error:
        return error.code, dict(error.headers.items()), error.read()


async def _default_async_transport(method: str, url: str, headers: Mapping[str, str], body: bytes | None, timeout: float = 30.0) -> TransportResult:
    return await asyncio.to_thread(_default_transport, method, url, headers, body, timeout)


def _transport_with_timeout(timeout: float) -> Transport:
    def transport(method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> TransportResult:
        return _default_transport(method, url, headers, body, timeout)
    return transport


def _async_transport_with_timeout(timeout: float) -> AsyncTransport:
    async def transport(method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> TransportResult:
        return await _default_async_transport(method, url, headers, body, timeout)
    return transport


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
        transport: Transport | None = None,
        timeout: float = 30.0,
        max_retries: int = 2,
        retry_delay: float = 0.25,
        on_request: Callable[[Mapping[str, object]], None] | None = None,
        on_response: Callable[[Mapping[str, object]], None] | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self._timeout = max(0.001, timeout)
        self._transport: Transport = transport or _transport_with_timeout(self._timeout)
        self._max_retries = max(0, max_retries)
        self._retry_delay = max(0.0, retry_delay)
        self._on_request = on_request
        self._on_response = on_response
        self._sleep = sleep
        self._base_url_input = base_url
        self._token = token
        self._organization = organization
        self._project_id = project_id
        self._csrf_token = csrf_token
        self._initial_headers = headers
        self._provided_transport = transport
        self._headers = dict(headers or {})
        self._headers.setdefault("Accept", "application/json")
        self._headers["X-NoxHere-SDK"] = f"python/{SDK_VERSION}"
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        if organization:
            self._headers["X-Org"] = organization
        if project_id:
            self._headers["X-Project-ID"] = project_id
        if csrf_token:
            self._headers["X-CSRF-Token"] = csrf_token
        self._operations = {
            item[0]: Operation(operation_id=item[0], method=item[1], path=item[2], namespace=item[3], change_safety=item[4], servers=item[5])
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
        if operation.servers:
            url = url.replace(self.base_url.rstrip("/"), operation.servers[0].rstrip("/"), 1)
        safe_to_retry = operation.change_safety in {"safe_read", "idempotent_with_event_key"}
        for attempt in range(1, self._max_retries + 2):
            started = time.monotonic()
            event = {"operationId": operation_id, "method": operation.method, "url": _safe_url(url, path), "attempt": attempt}
            if self._on_request:
                self._on_request(event)
            try:
                status, response_headers, response_body = self._transport(operation.method, url, request_headers, encoded)
            except (OSError, TimeoutError) as error:
                retrying = safe_to_retry and attempt <= self._max_retries
                if self._on_response:
                    self._on_response({**event, "durationMs": (time.monotonic() - started) * 1000, "retrying": retrying, "errorCode": "network_error"})
                if not retrying:
                    raise NoxHereTransportError(operation_id, error) from error
                self._sleep(self._retry_delay * 2 ** (attempt - 1))
                continue
            result = _payload(response_headers, response_body)
            retrying = not 200 <= status < 300 and safe_to_retry and _retryable_status(status) and attempt <= self._max_retries
            if self._on_response:
                self._on_response({**event, "status": status, "durationMs": (time.monotonic() - started) * 1000, "retrying": retrying})
            if 200 <= status < 300:
                return result
            error = NoxHereApiError(status, operation_id, result, response_headers)
            if not retrying:
                raise error
            self._sleep(error.retry_after if error.retry_after is not None else self._retry_delay * 2 ** (attempt - 1))
        raise AssertionError("unreachable")

    def operation_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._operations))

    def with_context(self, *, organization: str | None = None, project_id: str | None = None) -> "NoxHereClient":
        return NoxHereClient(
            base_url=self._base_url_input, token=self._token, organization=organization,
            project_id=project_id, csrf_token=self._csrf_token, headers=self._initial_headers,
            transport=self._provided_transport, timeout=self._timeout, max_retries=self._max_retries,
            retry_delay=self._retry_delay, on_request=self._on_request, on_response=self._on_response,
            sleep=self._sleep,
        )


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
        transport: AsyncTransport | None = None,
        timeout: float = 30.0,
        max_retries: int = 2,
        retry_delay: float = 0.25,
        on_request: Callable[[Mapping[str, object]], None] | None = None,
        on_response: Callable[[Mapping[str, object]], None] | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self._timeout = max(0.001, timeout)
        self._transport: AsyncTransport = transport or _async_transport_with_timeout(self._timeout)
        self._max_retries = max(0, max_retries)
        self._retry_delay = max(0.0, retry_delay)
        self._on_request = on_request
        self._on_response = on_response
        self._base_url_input = base_url
        self._token = token
        self._organization = organization
        self._project_id = project_id
        self._csrf_token = csrf_token
        self._initial_headers = headers
        self._provided_transport = transport
        self._headers = dict(headers or {})
        self._headers.setdefault("Accept", "application/json")
        self._headers["X-NoxHere-SDK"] = f"python/{SDK_VERSION}"
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        if organization:
            self._headers["X-Org"] = organization
        if project_id:
            self._headers["X-Project-ID"] = project_id
        if csrf_token:
            self._headers["X-CSRF-Token"] = csrf_token
        self._operations = {
            item[0]: Operation(operation_id=item[0], method=item[1], path=item[2], namespace=item[3], change_safety=item[4], servers=item[5])
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
        if operation.servers:
            url = url.replace(self.base_url.rstrip("/"), operation.servers[0].rstrip("/"), 1)
        safe_to_retry = operation.change_safety in {"safe_read", "idempotent_with_event_key"}
        for attempt in range(1, self._max_retries + 2):
            started = time.monotonic()
            event = {"operationId": operation_id, "method": operation.method, "url": _safe_url(url, path), "attempt": attempt}
            if self._on_request:
                self._on_request(event)
            try:
                status, response_headers, response_body = await asyncio.wait_for(self._transport(operation.method, url, request_headers, encoded), timeout=self._timeout)
            except (OSError, TimeoutError, asyncio.TimeoutError) as error:
                retrying = safe_to_retry and attempt <= self._max_retries
                if self._on_response:
                    self._on_response({**event, "durationMs": (time.monotonic() - started) * 1000, "retrying": retrying, "errorCode": "timeout" if isinstance(error, (TimeoutError, asyncio.TimeoutError)) else "network_error"})
                if not retrying:
                    raise NoxHereTransportError(operation_id, error) from error
                await asyncio.sleep(self._retry_delay * 2 ** (attempt - 1))
                continue
            result = _payload(response_headers, response_body)
            retrying = not 200 <= status < 300 and safe_to_retry and _retryable_status(status) and attempt <= self._max_retries
            if self._on_response:
                self._on_response({**event, "status": status, "durationMs": (time.monotonic() - started) * 1000, "retrying": retrying})
            if 200 <= status < 300:
                return result
            error = NoxHereApiError(status, operation_id, result, response_headers)
            if not retrying:
                raise error
            await asyncio.sleep(error.retry_after if error.retry_after is not None else self._retry_delay * 2 ** (attempt - 1))
        raise AssertionError("unreachable")

    def operation_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._operations))

    def with_context(self, *, organization: str | None = None, project_id: str | None = None) -> "AsyncNoxHereClient":
        return AsyncNoxHereClient(
            base_url=self._base_url_input, token=self._token, organization=organization,
            project_id=project_id, csrf_token=self._csrf_token, headers=self._initial_headers,
            transport=self._provided_transport, timeout=self._timeout, max_retries=self._max_retries,
            retry_delay=self._retry_delay, on_request=self._on_request, on_response=self._on_response,
        )


def create_noxhere(**options: Any) -> NoxHereClient:
    return NoxHereClient(**options)


def create_async_noxhere(**options: Any) -> AsyncNoxHereClient:
    return AsyncNoxHereClient(**options)
