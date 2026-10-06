"""Compatibility shim for the unified :mod:`noxhere.telemetry` SDK."""

from noxhere.telemetry import (
    DeliveryError,
    DeliveryResult,
    Environment,
    ErrorDetails,
    NoxCueClient,
    Outcome,
    Reason,
    __version__,
    create_noxcue,
    safe_error_details,
)

__all__ = [
    "DeliveryError",
    "DeliveryResult",
    "Environment",
    "ErrorDetails",
    "NoxCueClient",
    "Outcome",
    "Reason",
    "__version__",
    "create_noxcue",
    "safe_error_details",
]
