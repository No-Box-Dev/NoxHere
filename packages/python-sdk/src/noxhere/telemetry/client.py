from __future__ import annotations

# The transport intentionally accepts arbitrary provider objects and JSON values.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportPrivateUsage=false

import json
import math
import os
import re
import time
import traceback
import urllib.error
import urllib.request
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Mapping, Protocol, TypeVar, cast
from urllib.parse import urlsplit, urlunsplit

from ._contract import (
    AUTH_FEATURES,
    DEFAULT_ENDPOINT,
    DEFAULT_TIMEOUT_MS,
    MAX_BODY_BYTES,
    MAX_RESPONSE_BYTES,
    MAX_RETRY_AFTER_MS,
    MAX_TIMEOUT_MS,
    RETRY_DELAY_MS,
    SDK_VERSION,
)
from .types import DeliveryResult, Environment, ErrorDetails, Outcome, Primitive, Reason
from ._identity import protect_identity, valid_identity_key

T = TypeVar("T")
Feature = str
Classifier = Callable[[object], tuple[Outcome, Reason | None]]
TRACK_NAME = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,5}$")
IDENTITY_TRACK_NAMES = {
    "user.registered",
    "user.active",
    "subscription.trial_started",
    "subscription.paid_started",
    "subscription.cancelled",
    "records.parsed",
    "reports.generated",
}


class Response(Protocol):
    status: int
    headers: Mapping[str, str]

    def read(self, amount: int = -1) -> bytes: ...

    def close(self) -> None: ...


Transport = Callable[[urllib.request.Request, float], Response]


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _bounded(value: object, maximum: int) -> str | None:
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        return None
    normalized = str(value).strip()
    return normalized[:maximum] if normalized else None


_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
_BEARER = re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]+=*", re.I)
_JWT = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
_QUERY_SECRET = re.compile(r"([?&](?:token|key|secret|password|code)=)[^&#\s]+", re.I)
_NAMED_SECRET = re.compile(
    r"\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\s*[:=]\s*[^\s,;]+",
    re.I,
)


def _redact(value: str) -> str:
    value = _EMAIL.sub("[redacted-email]", value)
    value = _BEARER.sub("Bearer [redacted]", value)
    value = _JWT.sub("[redacted-token]", value)
    value = _QUERY_SECRET.sub(r"\1[redacted]", value)
    return _NAMED_SECRET.sub(r"\1=[redacted]", value)


def _safe_url(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return None
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
    except ValueError:
        return None


def _status_of(value: object) -> int | None:
    for attribute in ("status", "status_code", "statusCode"):
        status = (
            value.get(attribute)
            if isinstance(value, Mapping)
            else getattr(value, attribute, None)
        )
        if isinstance(status, int) and not isinstance(status, bool):
            return status
    return None


def safe_error_details(value: object) -> ErrorDetails:
    status = _status_of(value)

    def field(name: str) -> object | None:
        return (
            value.get(name)
            if isinstance(value, Mapping)
            else getattr(value, name, None)
        )

    raw_message = field("message")
    if raw_message is None and isinstance(value, BaseException):
        raw_message = str(value)
    message = _redact(
        _bounded(raw_message if raw_message is not None else value, 2_000)
        or "Unknown error"
    )
    raw_name = field("name") or type(value).__name__
    name = _redact(_bounded(raw_name, 120) or "Error")
    raw_code = field("code")
    code = _redact(
        _bounded(raw_code, 120)
        or (f"HTTP_{status}" if status is not None else "UNKNOWN")
    )
    details: ErrorDetails = {"name": name, "message": message, "code": code}
    if status is not None and 100 <= status <= 599:
        details["status"] = status
    if isinstance(value, BaseException) and value.__traceback__ is not None:
        stack = "".join(traceback.format_exception(value))[:8_000]
        if stack:
            details["stack"] = _redact(stack)
    return details


def _default_transport(request: urllib.request.Request, timeout: float) -> Response:
    try:
        return cast(Response, urllib.request.urlopen(request, timeout=timeout))
    except urllib.error.HTTPError as error:
        return cast(Response, error)


def _valid_endpoint(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        return parsed.scheme == "https" or (
            parsed.scheme == "http"
            and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        )
    except ValueError:
        return False


def _classify(feature: Feature, value: object) -> tuple[Outcome, Reason | None]:
    status = _status_of(value)
    if status == 429:
        return "rejected", "rate_limited"
    if status is not None and status >= 500:
        return "failure", "dependency_unavailable"
    if status is not None and status >= 400:
        if feature == "auth.login":
            return "rejected", "invalid_credentials"
        if feature == "auth.oauth":
            return "rejected", "oauth_failed"
        return "rejected", "invalid_input"
    if isinstance(value, TimeoutError):
        return "failure", "timeout"
    if isinstance(value, urllib.error.URLError):
        return "failure", "network_error"
    return "failure", "unknown"


class FeatureAPI:
    def __init__(self, client: NoxCueClient) -> None:
        self._client = client

    def result(
        self,
        feature: Feature,
        *,
        outcome: Outcome,
        reason: Reason | None = None,
        message: str | None = None,
        error: object | None = None,
        duration_ms: float | None = None,
        test: bool = False,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> DeliveryResult:
        if outcome == "failure" and error is None:
            raise ValueError("failure results require error")
        if outcome != "failure" and error is not None:
            raise ValueError("only failure results may include error")
        return self._client._post(
            self._client._feature_event(
                feature,
                outcome=outcome,
                reason=reason,
                message=message,
                error=error,
                duration_ms=duration_ms,
                test=test,
                occurred_at=occurred_at,
                idempotency_key=idempotency_key,
            )
        )

    def observe(
        self,
        feature: Feature,
        operation: Callable[[], T],
        *,
        classify: Classifier | None = None,
    ) -> T:
        started = time.perf_counter()
        evidence: object | None = None
        try:
            result = operation()
            evidence = (
                result.get("error")
                if isinstance(result, Mapping)
                else getattr(result, "error", None)
            )
            if not evidence:
                evidence = None
            if evidence is None and (_status_of(result) or 0) >= 400:
                evidence = result
            if evidence is None:
                outcome, reason = "success", None
            elif classify is not None:
                outcome, reason = classify(evidence)
            else:
                outcome, reason = _classify(feature, evidence)
            self._client._capture(
                self._client._feature_event(
                    feature,
                    outcome=outcome,
                    reason=reason,
                    error=evidence if outcome == "failure" else None,
                    duration_ms=(time.perf_counter() - started) * 1_000,
                )
            )
            return result
        except BaseException as error:
            outcome, reason = (
                classify(error) if classify is not None else _classify(feature, error)
            )
            self._client._capture(
                self._client._feature_event(
                    feature,
                    outcome=outcome,
                    reason=reason,
                    error=error,
                    duration_ms=(time.perf_counter() - started) * 1_000,
                )
            )
            raise


class AuthAPI:
    def __init__(self, feature: FeatureAPI) -> None:
        self._feature = feature

    def _observe(
        self, name: str, operation: Callable[[], T], classify: Classifier | None
    ) -> T:
        return self._feature.observe(name, operation, classify=classify)

    def signup(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.signup", operation, classify)

    def login(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.login", operation, classify)

    def password_reset(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.password_reset", operation, classify)

    def email_verification(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.email_verification", operation, classify)

    def oauth(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.oauth", operation, classify)

    def mfa(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.mfa", operation, classify)

    def session_refresh(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.session_refresh", operation, classify)

    def logout(
        self, operation: Callable[[], T], *, classify: Classifier | None = None
    ) -> T:
        return self._observe("auth.logout", operation, classify)


class UserAPI:
    def __init__(self, client: NoxCueClient) -> None:
        self._client = client

    def registered(
        self,
        user_id: str,
        *,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> DeliveryResult:
        return self._client.track(
            "user.registered", user_id=user_id, occurred_at=occurred_at, idempotency_key=idempotency_key
        )

    def active(
        self,
        user_id: str,
        *,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> DeliveryResult:
        return self._client.track(
            "user.active", user_id=user_id, occurred_at=occurred_at, idempotency_key=idempotency_key
        )


class NoxCueClient:
    """Thread-safe server client matching the TypeScript server SDK's wire behavior."""

    def __init__(
        self,
        *,
        key: str,
        identity_hash_key: str | None = None,
        identity_key_id: str | None = None,
        environment: Environment | None = None,
        release: str | None = None,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        max_retries: int = 2,
        enabled: bool = True,
        get_user: Callable[[], Mapping[str, object] | None] | None = None,
        transport: Transport | None = None,
    ) -> None:
        self.key = key
        self.identity_hash_key = identity_hash_key or os.environ.get(
            "NOXHERE_IDENTITY_HASH_KEY"
        )
        self.identity_key_id = (
            identity_key_id or os.environ.get("NOXHERE_IDENTITY_KEY_ID") or "primary"
        )
        self.environment: Environment | None = environment
        self.release = release
        self.endpoint = endpoint.strip()
        self.timeout_ms = min(MAX_TIMEOUT_MS, max(250, timeout_ms))
        self.max_retries = min(3, max(0, round(max_retries)))
        self._enabled = enabled
        self._get_user = get_user
        self._identified_user_id: str | None = None
        self._closed = False
        self._transport = transport or _default_transport
        self._configured = (
            enabled
            and key.startswith("nox_secret_")
            and len(key) >= len("nox_secret_") + 30
            and _valid_endpoint(self.endpoint)
        )
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="noxcue")
        self._pending: set[Future[DeliveryResult]] = set()
        self.feature = FeatureAPI(self)
        self.auth = AuthAPI(self.feature)
        self.user = UserAPI(self)

    def __enter__(self) -> NoxCueClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self.flush()
        self._closed = True
        self._executor.shutdown(wait=True)

    def identify(self, user: Mapping[str, object] | None) -> None:
        """Retain only the opaque id from a shared user identity object."""
        self._identified_user_id = _bounded(user.get("id"), 200) if user else None

    def _current_user_id(self) -> str | None:
        try:
            supplied = self._get_user() if self._get_user else None
            return _bounded(supplied.get("id"), 200) if supplied else self._identified_user_id
        except Exception:
            return self._identified_user_id

    def for_user(self, user_id: str) -> NoxCueClient:
        """Create a concurrency-safe client view scoped to one opaque user id."""
        return NoxCueClient(
            key=self.key,
            identity_hash_key=self.identity_hash_key,
            identity_key_id=self.identity_key_id,
            environment=self.environment,
            release=self.release,
            endpoint=self.endpoint,
            timeout_ms=self.timeout_ms,
            max_retries=self.max_retries,
            enabled=self._enabled,
            get_user=lambda: {"id": user_id},
            transport=self._transport,
        )

    def _context(self) -> dict[str, object]:
        result: dict[str, object] = {
            "runtime": "server",
            "sdkVersion": SDK_VERSION,
        }
        if self.environment:
            result["environment"] = self.environment
        release = _bounded(self.release, 120)
        if release:
            result["release"] = release
        return result

    def _post(self, raw_event: dict[str, object]) -> DeliveryResult:
        event_id = (
            raw_event.get("eventId")
            if isinstance(raw_event.get("eventId"), str)
            else str(uuid.uuid4())
        )
        if not self._configured or self._closed:
            return DeliveryResult(
                False, cast(str, event_id), error="invalid_configuration"
            )
        event = dict(raw_event)
        raw_user_value = event.get("userId")
        raw_user_id = raw_user_value if isinstance(raw_user_value, str) else None
        raw_data_value = event.get("data")
        raw_data = (
            dict(cast(Mapping[str, object], raw_data_value))
            if isinstance(raw_data_value, dict)
            else None
        )
        raw_affected_value = raw_data.get("affectedUser") if raw_data else None
        raw_affected_user = (
            raw_affected_value if isinstance(raw_affected_value, str) else None
        )
        if raw_user_id or raw_affected_user:
            if not valid_identity_key(self.identity_hash_key, self.identity_key_id):
                return DeliveryResult(
                    False, cast(str, event_id), error="invalid_configuration"
                )
            identity_hash_key = cast(str, self.identity_hash_key)
            if raw_user_id:
                event["userId"] = protect_identity(
                    raw_user_id, identity_hash_key, self.identity_key_id
                )
            if raw_affected_user and raw_data is not None:
                raw_data["affectedUser"] = protect_identity(
                    raw_affected_user, identity_hash_key, self.identity_key_id
                )
                event["data"] = raw_data
        body = json.dumps(
            {
                "version": 1,
                **({"environment": self.environment} if self.environment else {}),
                "eventId": event_id,
                **event,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode()
        if len(body) > MAX_BODY_BYTES:
            return DeliveryResult(False, cast(str, event_id), error="payload_too_large")
        total_attempts = self.max_retries + 1
        for attempt in range(total_attempts):
            request = urllib.request.Request(
                self.endpoint,
                data=body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-Nox-Ingest-Key": self.key,
                },
            )
            try:
                response = self._transport(request, self.timeout_ms / 1_000)
                try:
                    status = response.status
                    if 200 <= status < 300:
                        stored_id = cast(str, event_id)
                        try:
                            declared = int(
                                response.headers.get("content-length", "0") or "0"
                            )
                        except ValueError:
                            declared = 0
                        if declared <= MAX_RESPONSE_BYTES:
                            payload = response.read(MAX_RESPONSE_BYTES + 1)
                            if len(payload) <= MAX_RESPONSE_BYTES:
                                try:
                                    parsed = json.loads(payload)
                                    if isinstance(parsed, dict) and isinstance(
                                        parsed.get("eventId"), str
                                    ):
                                        stored_id = parsed["eventId"]
                                except (UnicodeDecodeError, json.JSONDecodeError):
                                    pass
                        return DeliveryResult(True, stored_id, status=status)
                    delay = (
                        self._retry_delay(response)
                        if status in {408, 429} or status >= 500
                        else None
                    )
                    if attempt == total_attempts - 1 or delay is None:
                        return DeliveryResult(
                            False, cast(str, event_id), status=status, error="rejected"
                        )
                finally:
                    response.close()
                time.sleep(min(MAX_RETRY_AFTER_MS / 1_000, delay * (2**attempt)))
            except Exception as error:
                if attempt == total_attempts - 1:
                    kind = (
                        "timeout"
                        if isinstance(error, TimeoutError)
                        else "network_error"
                    )
                    return DeliveryResult(False, cast(str, event_id), error=kind)
                time.sleep(min(MAX_RETRY_AFTER_MS, RETRY_DELAY_MS * (2**attempt)) / 1_000)
        return DeliveryResult(False, cast(str, event_id), error="network_error")

    @staticmethod
    def _retry_delay(response: Response) -> float | None:
        retry_after = response.headers.get("retry-after")
        if not retry_after:
            return RETRY_DELAY_MS / 1_000
        try:
            delay_ms = max(0, math.ceil(float(retry_after) * 1_000))
        except ValueError:
            try:
                delay_ms = max(
                    0,
                    round(
                        (parsedate_to_datetime(retry_after).timestamp() - time.time())
                        * 1_000
                    ),
                )
            except (TypeError, ValueError, OverflowError):
                return None
        return delay_ms / 1_000 if delay_ms <= MAX_RETRY_AFTER_MS else None

    def _capture(self, event: dict[str, object]) -> None:
        try:
            future = self._executor.submit(self._post, event)
        except RuntimeError:
            # Instrumentation must not change the observed application operation.
            return
        self._pending.add(future)
        future.add_done_callback(self._pending.discard)

    def _queue(self, event: dict[str, object]) -> DeliveryResult:
        raw_event_id = event.get("eventId")
        event_id = raw_event_id if isinstance(raw_event_id, str) else str(uuid.uuid4())
        event["eventId"] = event_id
        if not self._configured or self._closed:
            return DeliveryResult(False, event_id, error="invalid_configuration")
        raw_data = event.get("data")
        affected_user = cast(dict[str, object], raw_data).get("affectedUser") if isinstance(raw_data, dict) else None
        if (event.get("userId") or affected_user) \
                and not valid_identity_key(self.identity_hash_key, self.identity_key_id):
            return DeliveryResult(False, event_id, error="invalid_configuration")
        self._capture(event)
        return DeliveryResult(True, event_id)

    def flush(self) -> list[DeliveryResult]:
        pending = list(self._pending)
        return [future.result() for future in pending]

    def _feature_event(
        self,
        feature: Feature,
        *,
        outcome: Outcome,
        reason: Reason | None = None,
        message: str | None = None,
        error: object | None = None,
        duration_ms: float | None = None,
        test: bool = False,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, object]:
        if feature not in AUTH_FEATURES and not feature.startswith("custom."):
            raise ValueError(
                "feature must be a built-in auth feature or start with 'custom.'"
            )
        details = safe_error_details(error) if outcome == "failure" else None
        event: dict[str, object] = {
            "type": "feature.result",
            "feature": feature,
            "outcome": outcome,
        }
        user_id = self._current_user_id()
        if user_id:
            event["userId"] = user_id
        if reason:
            event["reason"] = reason
        if message:
            event["message"] = _redact(message[:2_000])
        elif details:
            event["message"] = details["message"]
        if details:
            event["error"] = details
        if duration_ms is not None:
            event["durationMs"] = max(0, min(120_000, math.floor(duration_ms + 0.5)))
        if test:
            event["test"] = True
        event["occurredAt"] = occurred_at or _utc_now()
        if idempotency_key:
            event["idempotencyKey"] = idempotency_key[:200]
        event["context"] = self._context()
        return event

    def error(
        self,
        error: object,
        *,
        title: str | None = None,
        message: str | None = None,
        url: str | None = None,
        component: str | None = None,
        affected_user: str | None = None,
        fatal: bool = False,
        unhandled: bool = False,
        fingerprint: str | None = None,
        attributes: Mapping[str, Primitive] | None = None,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> DeliveryResult:
        details = safe_error_details(error)
        data: dict[str, object] = {"errorCode": details["code"]}
        for key, value, maximum in (
            ("component", component, 120),
            ("affectedUser", affected_user or self._current_user_id(), 200),
            ("fingerprint", fingerprint, 200),
        ):
            bounded = _bounded(value, maximum)
            if bounded:
                data[key] = bounded
        data.update({"fatal": fatal, "unhandled": unhandled})
        clean_attributes: dict[str, Primitive] = {}
        for raw_key, raw_value in list((attributes or {}).items())[:96]:
            key = raw_key.strip()[:120]
            if re.fullmatch(r"[a-z](?:[a-z0-9_.-]|\[|\]){0,119}", key, re.I):
                clean_attributes[key] = (
                    _redact(raw_value.strip()[:300])
                    if isinstance(raw_value, str)
                    else raw_value
                )
        if clean_attributes:
            data["attributes"] = clean_attributes
        event: dict[str, object] = {
            "type": "error.occurred",
            "title": _bounded(title, 200) or details["message"][:200],
            "message": _redact(_bounded(message, 2_000) or details["message"]),
            "error": details,
            "context": self._context(),
            "occurredAt": occurred_at or _utc_now(),
            "data": data,
        }
        safe_url = _safe_url(url)
        if safe_url:
            event["url"] = safe_url
        if idempotency_key:
            event["idempotencyKey"] = idempotency_key[:200]
        return self._post(event)

    def test(self, feature: Feature = "auth.signup") -> DeliveryResult:
        return self._post(self._feature_event(feature, outcome="success", test=True))

    def _user_event(
        self,
        event_type: str,
        user_id: str,
        occurred_at: str | None,
        idempotency_key: str | None,
    ) -> DeliveryResult:
        event: dict[str, object] = {
            "type": event_type,
            "eventId": str(uuid.uuid4()),
            "userId": user_id[:200],
            "occurredAt": occurred_at or _utc_now(),
            "context": self._context(),
        }
        if idempotency_key:
            event["idempotencyKey"] = idempotency_key[:200]
        return self._queue(event)

    def track(
        self,
        name: str,
        *,
        user_id: str | None = None,
        value: int | float = 1,
        attributes: Mapping[str, Primitive] | None = None,
        event_id: str | None = None,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> DeliveryResult:
        delivery_id = event_id or str(uuid.uuid4())
        if not TRACK_NAME.fullmatch(name):
            return DeliveryResult(False, delivery_id, error="invalid_configuration")
        if (name in IDENTITY_TRACK_NAMES or name.startswith("custom.")) and not user_id:
            return DeliveryResult(False, delivery_id, error="invalid_configuration")
        if isinstance(value, bool) or not math.isfinite(value) or value <= 0 or value > 1_000_000_000:
            return DeliveryResult(False, delivery_id, error="invalid_configuration")
        if name.startswith("custom.") and value != 1:
            return DeliveryResult(False, delivery_id, error="invalid_configuration")
        if name in {"user.registered", "user.active"}:
            return self._user_event(name, cast(str, user_id), occurred_at, idempotency_key)
        clean_attributes: dict[str, Primitive] = {}
        for raw_key, raw_value in list((attributes or {}).items())[:96]:
            key = raw_key.strip()[:120]
            if re.fullmatch(r"[a-z](?:[a-z0-9_.-]|\[|\]){0,119}", key, re.I):
                clean_attributes[key] = _redact(raw_value[:300]) if isinstance(raw_value, str) else raw_value
        event: dict[str, object] = {
            "type": "activity.occurred" if name.startswith("custom.") else "activity.tracked",
            "eventId": delivery_id,
            "occurredAt": occurred_at or _utc_now(),
            "context": self._context(),
        }
        if name.startswith("custom."):
            event["metric"] = name
        else:
            event["name"] = name
            event["value"] = value
        if user_id:
            event["userId"] = user_id[:200]
        if clean_attributes:
            event["attributes"] = clean_attributes
        if idempotency_key:
            event["idempotencyKey"] = idempotency_key[:200]
        return self._queue(event)

    def activity(
        self,
        metric: str,
        user_id: str,
        *,
        event_id: str | None = None,
        occurred_at: str | None = None,
        idempotency_key: str | None = None,
    ) -> DeliveryResult:
        if not metric.startswith("custom."):
            raise ValueError("activity metric must start with 'custom.'")
        return self.track(
            metric,
            user_id=user_id,
            event_id=event_id,
            occurred_at=occurred_at,
            idempotency_key=idempotency_key,
        )


def create_noxcue(**options: Any) -> NoxCueClient:
    return NoxCueClient(**options)
