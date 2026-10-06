from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Mapping, Sequence, TypeAlias, cast

from ._events import (
    FORBIDDEN_PLATFORM_EVENT_KEYS,
    MAX_PLATFORM_EVENT_BYTES,
    PLATFORM_EVENT_DATA_VERSION,
    PLATFORM_EVENT_SPEC_VERSION,
    PLATFORM_EVENT_TYPES,
)

JsonValue: TypeAlias = (
    None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)
PlatformEventEnvelope: TypeAlias = dict[str, object]

_FORBIDDEN = frozenset(FORBIDDEN_PLATFORM_EVENT_KEYS)


def _normalized_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _forbidden_paths(
    value: object, path: str = "$", found: list[str] | None = None
) -> list[str]:
    result = found if found is not None else []
    if isinstance(value, Mapping):
        mapping = cast(Mapping[object, object], value)
        for raw_key, child in mapping.items():
            key = str(raw_key)
            child_path = f"{path}.{key}"
            if _normalized_key(key) in _FORBIDDEN:
                result.append(child_path)
            _forbidden_paths(child, child_path, result)
    elif isinstance(value, (list, tuple)):
        for index, child in enumerate(cast(Sequence[object], value)):
            _forbidden_paths(child, f"{path}[{index}]", result)
    return result


def create_platform_event(
    *,
    type: str,
    org_id: int,
    project_id: str,
    source: Mapping[str, JsonValue],
    subject: Mapping[str, JsonValue],
    idempotency_key: str,
    data: Mapping[str, JsonValue],
    id: str | None = None,
    occurred_at: str | None = None,
    actor: Mapping[str, JsonValue] | None = None,
    context: Mapping[str, JsonValue] | None = None,
    message: Mapping[str, JsonValue] | None = None,
    correlation_id: str | None = None,
    causation_id: str | None = None,
) -> PlatformEventEnvelope:
    """Build the common envelope; the API still validates type-specific data."""
    if type not in PLATFORM_EVENT_TYPES:
        raise ValueError(f"Unknown platform event type: {type}")
    if isinstance(org_id, bool) or org_id <= 0:
        raise ValueError("org_id must be a positive integer")
    if not project_id.strip() or not idempotency_key.strip():
        raise ValueError("project_id and idempotency_key are required")

    event: PlatformEventEnvelope = {
        "specVersion": PLATFORM_EVENT_SPEC_VERSION,
        "dataVersion": PLATFORM_EVENT_DATA_VERSION,
        "id": id or str(uuid.uuid4()),
        "type": type,
        "orgId": org_id,
        "projectId": project_id,
        "source": dict(source),
        "subject": dict(subject),
        "occurredAt": occurred_at
        or datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        ),
        "idempotencyKey": idempotency_key,
        "data": dict(data),
    }
    for key, value in (
        ("actor", actor),
        ("context", context),
        ("message", message),
        ("correlationId", correlation_id),
        ("causationId", causation_id),
    ):
        if value is not None:
            event[key] = dict(value) if isinstance(value, Mapping) else value

    private_paths = _forbidden_paths(event)
    if private_paths:
        raise ValueError(
            "Platform events cannot contain credentials or direct private identities: "
            + ", ".join(private_paths)
        )
    try:
        serialized = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as error:
        raise ValueError("Platform event must be JSON serializable") from error
    if len(serialized.encode()) > MAX_PLATFORM_EVENT_BYTES:
        raise ValueError(f"Platform event exceeds {MAX_PLATFORM_EVENT_BYTES} bytes")
    return event


__all__ = [
    "JsonValue",
    "MAX_PLATFORM_EVENT_BYTES",
    "PLATFORM_EVENT_DATA_VERSION",
    "PLATFORM_EVENT_SPEC_VERSION",
    "PLATFORM_EVENT_TYPES",
    "PlatformEventEnvelope",
    "create_platform_event",
]
