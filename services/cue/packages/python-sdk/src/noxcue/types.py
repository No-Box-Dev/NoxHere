from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias, TypedDict

Environment: TypeAlias = Literal[
    "production", "staging", "development", "preview", "test", "local"
]
Outcome: TypeAlias = Literal["success", "rejected", "failure"]
Reason: TypeAlias = Literal[
    "invalid_input",
    "invalid_credentials",
    "account_exists",
    "account_unverified",
    "account_locked",
    "verification_expired",
    "mfa_required",
    "rate_limited",
    "policy_rejected",
    "dependency_unavailable",
    "database_unavailable",
    "email_delivery_failed",
    "oauth_failed",
    "session_failed",
    "configuration_error",
    "timeout",
    "network_error",
    "internal_error",
    "unknown",
]
DeliveryError: TypeAlias = Literal[
    "invalid_configuration", "payload_too_large", "timeout", "network_error", "rejected"
]
Primitive: TypeAlias = str | int | float | bool


@dataclass(frozen=True, slots=True)
class DeliveryResult:
    ok: bool
    event_id: str
    status: int | None = None
    error: DeliveryError | None = None


class ErrorDetails(TypedDict, total=False):
    name: str
    message: str
    code: str
    status: int
    stack: str
