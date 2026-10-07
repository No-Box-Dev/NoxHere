from __future__ import annotations

import base64
import hashlib
import hmac
import re

PROTECTED_IDENTITY = re.compile(r"^h1_[a-z0-9-]{1,32}_[A-Za-z0-9_-]{43}$")


def valid_identity_key(key: str | None, key_id: str | None) -> bool:
    return bool(
        key
        and len(key.encode()) >= 32
        and key_id
        and re.fullmatch(r"[a-z0-9-]{1,32}", key_id)
    )


def protect_identity(value: str, key: str, key_id: str) -> str:
    if PROTECTED_IDENTITY.fullmatch(value):
        return value
    digest = hmac.new(key.encode(), value.encode(), hashlib.sha256).digest()
    encoded = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return f"h1_{key_id}_{encoded}"
