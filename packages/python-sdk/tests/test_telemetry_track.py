from __future__ import annotations

# Test doubles deliberately model urllib requests and arbitrary JSON values.
# pyright: reportUnknownParameterType=false, reportMissingParameterType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownVariableType=false, reportUnknownLambdaType=false

import json
import sys
import unittest
from pathlib import Path
from typing import Mapping

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from noxhere.telemetry import NoxCueClient  # noqa: E402

SERVER_KEY = "nox_secret_" + "b" * 32
IDENTITY_KEY = "identity-secret-key-that-is-at-least-32-bytes"


class Response:
    status = 202
    headers: Mapping[str, str] = {}

    def read(self, amount: int = -1) -> bytes:
        return b'{"eventId":"stored"}'

    def close(self) -> None:
        pass


class TrackTests(unittest.TestCase):
    def test_track_hashes_before_transport(self) -> None:
        requests = []

        def transport(request, _timeout):
            requests.append(request)
            return Response()

        with NoxCueClient(
            key=SERVER_KEY,
            identity_hash_key=IDENTITY_KEY,
            environment="production",
            transport=transport,
        ) as client:
            result = client.track("records.parsed", user_id="user-42", value=3)

        self.assertTrue(result.ok)
        body = requests[0].data.decode()
        self.assertNotIn("user-42", body)
        self.assertEqual(
            json.loads(body)["userId"],
            "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40",
        )

    def test_missing_hash_key_fails_without_transport(self) -> None:
        with NoxCueClient(
            key=SERVER_KEY,
            transport=lambda *_: self.fail("network called"),
        ) as client:
            result = client.track("reports.generated", user_id="raw-user")
        self.assertEqual(result.error, "invalid_configuration")


if __name__ == "__main__":
    unittest.main()
