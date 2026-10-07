from __future__ import annotations

import sys
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from noxhere.telemetry._identity import protect_identity, valid_identity_key  # noqa: E402

KEY = "identity-secret-key-that-is-at-least-32-bytes"


class IdentityTests(unittest.TestCase):
    def test_shared_hmac_vectors(self) -> None:
        self.assertEqual(
            protect_identity("user-42", KEY, "primary"),
            "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40",
        )
        self.assertEqual(
            protect_identity("café-user", KEY, "primary"),
            "h1_primary_oo5jm2f49W43w7VQ4KdKMEmT4w68Ire6CACVE6N8lO0",
        )

    def test_configuration_validation(self) -> None:
        self.assertTrue(valid_identity_key(KEY, "rotation-2"))
        self.assertFalse(valid_identity_key("short", "rotation-2"))
        self.assertFalse(valid_identity_key(KEY, "INVALID"))


if __name__ == "__main__":
    unittest.main()
