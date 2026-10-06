from __future__ import annotations

import asyncio
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable, Mapping, Protocol, cast
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


@dataclass(frozen=True, slots=True)
class NativeSessionState:
    access_token: str
    refresh_token: str
    access_expires_at: str
    user: object | None = None
    organizations: tuple[object, ...] = ()


@dataclass(frozen=True, slots=True)
class DeviceAuthorization:
    device_code: str
    verification_uri: str
    user_code: str | None = None
    verification_uri_complete: str | None = None
    expires_in: int | None = None
    interval: int | None = None


class NativeSessionStorage(Protocol):
    def load(self) -> NativeSessionState | None: ...
    def save(self, session: NativeSessionState) -> None: ...
    def clear(self) -> None: ...


class AsyncNativeSessionStorage(Protocol):
    def load(self) -> Awaitable[NativeSessionState | None]: ...
    def save(self, session: NativeSessionState) -> Awaitable[None]: ...
    def clear(self) -> Awaitable[None]: ...


AuthTransport = Callable[[str, Mapping[str, object]], Mapping[str, object]]
AsyncAuthTransport = Callable[[str, Mapping[str, object]], Awaitable[Mapping[str, object]]]


def _default_transport(base_url: str) -> AuthTransport:
    def send(path: str, payload: Mapping[str, object]) -> Mapping[str, object]:
        request = Request(
            urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
            data=json.dumps(payload, separators=(",", ":")).encode(),
            headers={"Accept": "application/json", "Content-Type": "application/json", "X-NoxHere-SDK": "python/0.2.0"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=30) as response:  # noqa: S310 - configured NoxHere origin
                body: object = json.loads(response.read() or b"{}")
        except HTTPError as error:
            body = json.loads(error.read() or b"{}")
            error_body: Mapping[str, object]
            error_body = cast(Mapping[str, object], body) if isinstance(body, dict) else cast(Mapping[str, object], {})
            raw_message: object | None = error_body.get("error")
            message = raw_message if isinstance(raw_message, str) else f"HTTP {error.code}"
            raise RuntimeError(str(message)) from error
        if not isinstance(body, dict):
            raise RuntimeError("NoxHere authentication returned a non-object response")
        return cast(Mapping[str, object], body)
    return send


def _async_default_transport(base_url: str) -> AsyncAuthTransport:
    sync = _default_transport(base_url)

    async def send(path: str, payload: Mapping[str, object]) -> Mapping[str, object]:
        return await asyncio.to_thread(sync, path, payload)
    return send


def _normalize(result: Mapping[str, object], previous: NativeSessionState | None = None) -> NativeSessionState:
    access = result.get("access_token")
    refresh = result.get("refresh_token")
    if not isinstance(access, str) or not access.startswith("nox_at_") or not isinstance(refresh, str) or not refresh.startswith("nox_rt_"):
        raise RuntimeError("Authentication completed without valid NoxHere session credentials")
    raw_expires = result.get("expires_in", 900)
    expires_in = float(raw_expires) if isinstance(raw_expires, (int, float, str)) else 900.0
    expires_at = datetime.fromtimestamp(time.time() + expires_in, timezone.utc).isoformat().replace("+00:00", "Z")
    raw_organizations = result.get("organizations")
    organizations = tuple(cast(list[object], raw_organizations)) if isinstance(raw_organizations, list) else previous.organizations if previous else ()
    return NativeSessionState(
        access_token=access,
        refresh_token=refresh,
        access_expires_at=expires_at,
        user=result.get("user", previous.user if previous else None),
        organizations=organizations,
    )


class NativeAuth:
    def __init__(self, *, client: str, base_url: str = "https://app.noxhere.com", storage: NativeSessionStorage | None = None, session: NativeSessionState | None = None, transport: AuthTransport | None = None, refresh_skew: float = 30.0, now: Callable[[], float] = time.time) -> None:
        self.client = client
        self._storage = storage
        self._memory = session
        self._transport = transport or _default_transport(base_url)
        self._refresh_skew = max(0.0, refresh_skew)
        self._now = now
        self._lock = threading.Lock()

    def _load(self) -> NativeSessionState | None:
        return self._storage.load() if self._storage else self._memory

    def _save(self, session: NativeSessionState) -> None:
        self._memory = session
        if self._storage:
            self._storage.save(session)

    def start(self) -> DeviceAuthorization:
        result = self._transport("/api/v1/auth/native/device/start", {"client": self.client})
        device_code, verification_uri = result.get("device_code"), result.get("verification_uri")
        if not isinstance(device_code, str) or not isinstance(verification_uri, str):
            raise RuntimeError("NoxHere returned an invalid device authorization")
        user_code = result.get("user_code")
        complete = result.get("verification_uri_complete")
        expires_in = result.get("expires_in")
        interval = result.get("interval")
        return DeviceAuthorization(
            device_code=device_code, verification_uri=verification_uri,
            user_code=user_code if isinstance(user_code, str) else None,
            verification_uri_complete=complete if isinstance(complete, str) else None,
            expires_in=expires_in if isinstance(expires_in, int) else None,
            interval=interval if isinstance(interval, int) else None,
        )

    def poll(self, device_code: str) -> NativeSessionState | None:
        result = self._transport("/api/v1/auth/native/device/poll", {"client": self.client, "device_code": device_code})
        if not result.get("access_token"):
            return None
        session = _normalize(result, self._load())
        self._save(session)
        return session

    def set_session(self, session: NativeSessionState) -> None:
        self._save(session)

    def current(self) -> NativeSessionState | None:
        return self._load()

    def access_token(self) -> str | None:
        with self._lock:
            session = self._load()
            if not session:
                return None
            expires_at = datetime.fromisoformat(session.access_expires_at.replace("Z", "+00:00")).timestamp()
            if expires_at > self._now() + self._refresh_skew:
                return session.access_token
            next_session = _normalize(self._transport("/api/v1/auth/native/refresh", {"refresh_token": session.refresh_token}), session)
            self._save(next_session)
            return next_session.access_token

    def revoke(self) -> None:
        session = self._load()
        if session:
            self._transport("/api/v1/auth/native/revoke", {"refresh_token": session.refresh_token})
        self._memory = None
        if self._storage:
            self._storage.clear()


class AsyncNativeAuth:
    def __init__(self, *, client: str, base_url: str = "https://app.noxhere.com", storage: AsyncNativeSessionStorage | None = None, session: NativeSessionState | None = None, transport: AsyncAuthTransport | None = None, refresh_skew: float = 30.0, now: Callable[[], float] = time.time) -> None:
        self.client = client
        self._storage = storage
        self._memory = session
        self._transport = transport or _async_default_transport(base_url)
        self._refresh_skew = max(0.0, refresh_skew)
        self._now = now
        self._lock = asyncio.Lock()

    async def _load(self) -> NativeSessionState | None:
        return await self._storage.load() if self._storage else self._memory

    async def _save(self, session: NativeSessionState) -> None:
        self._memory = session
        if self._storage:
            await self._storage.save(session)

    async def start(self) -> DeviceAuthorization:
        result = await self._transport("/api/v1/auth/native/device/start", {"client": self.client})
        device_code, verification_uri = result.get("device_code"), result.get("verification_uri")
        if not isinstance(device_code, str) or not isinstance(verification_uri, str):
            raise RuntimeError("NoxHere returned an invalid device authorization")
        return DeviceAuthorization(device_code=device_code, verification_uri=verification_uri)

    async def poll(self, device_code: str) -> NativeSessionState | None:
        result = await self._transport("/api/v1/auth/native/device/poll", {"client": self.client, "device_code": device_code})
        if not result.get("access_token"):
            return None
        session = _normalize(result, await self._load())
        await self._save(session)
        return session

    async def set_session(self, session: NativeSessionState) -> None:
        await self._save(session)

    async def current(self) -> NativeSessionState | None:
        return await self._load()

    async def access_token(self) -> str | None:
        async with self._lock:
            session = await self._load()
            if not session:
                return None
            expires_at = datetime.fromisoformat(session.access_expires_at.replace("Z", "+00:00")).timestamp()
            if expires_at > self._now() + self._refresh_skew:
                return session.access_token
            next_session = _normalize(await self._transport("/api/v1/auth/native/refresh", {"refresh_token": session.refresh_token}), session)
            await self._save(next_session)
            return next_session.access_token

    async def revoke(self) -> None:
        session = await self._load()
        if session:
            await self._transport("/api/v1/auth/native/revoke", {"refresh_token": session.refresh_token})
        self._memory = None
        if self._storage:
            await self._storage.clear()
