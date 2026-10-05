from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Mapping

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from noxcue import NoxCueClient, safe_error_details  # noqa: E402

SERVER_KEY = "nox_secret_" + "b" * 32
FIXTURES = json.loads(
    (PACKAGE.parent / "sdk-contract" / "wire-fixtures.json").read_text()
)


class MockResponse:
    def __init__(
        self,
        status: int = 202,
        body: bytes = b'{"eventId":"stored-event"}',
        headers: Mapping[str, str] | None = None,
    ) -> None:
        self.status = status
        self._body = body
        self.headers = headers or {}

    def read(self, amount: int = -1) -> bytes:
        return self._body[:amount] if amount >= 0 else self._body

    def close(self) -> None:
        pass


class SDKTests(unittest.TestCase):
    def setUp(self) -> None:
        self.requests = []

        def transport(request, timeout):
            self.requests.append((request, timeout))
            return MockResponse()

        self.client = NoxCueClient(
            key=SERVER_KEY,
            environment="production",
            release="app@abc123",
            transport=transport,
        )

    def tearDown(self) -> None:
        self.client.close()

    def payload(self, index: int = -1) -> dict:
        return json.loads(self.requests[index][0].data)

    def test_shared_wire_fixtures(self) -> None:
        for fixture in FIXTURES:
            with self.subTest(fixture["name"]):
                if fixture["operation"] == "user.registered":
                    self.client.user.registered(
                        fixture["arguments"]["userId"],
                        occurred_at=fixture["options"]["occurredAt"],
                        idempotency_key=fixture["options"]["idempotencyKey"],
                    )
                else:
                    self.client.activity(
                        fixture["arguments"]["metric"],
                        fixture["arguments"]["userId"],
                        event_id=fixture["options"]["eventId"],
                        occurred_at=fixture["options"]["occurredAt"],
                    )
                payload = self.payload()
                if "eventId" not in fixture["expected"]:
                    payload.pop("eventId")
                self.assertEqual(payload, fixture["expected"])

    def test_retries_with_the_same_event_identity(self) -> None:
        calls = []

        def transport(request, timeout):
            calls.append(json.loads(request.data))
            if len(calls) == 1:
                return MockResponse(503, b"busy", {"retry-after": "0"})
            return MockResponse()

        with NoxCueClient(
            key=SERVER_KEY, environment="production", transport=transport
        ) as client:
            result = client.activity("custom.journals.added", "user-42")
        self.assertTrue(result.ok)
        self.assertEqual(calls[0]["eventId"], calls[1]["eventId"])

    def test_rejects_wrong_key_without_network(self) -> None:
        client = NoxCueClient(
            key="nox_pub_" + "a" * 32,
            environment="production",
            transport=lambda *_: self.fail("network called"),
        )
        try:
            result = client.test()
        finally:
            client.close()
        self.assertEqual(result.error, "invalid_configuration")

    def test_redacts_error_evidence_and_url_query(self) -> None:
        error = RuntimeError(
            "Signup failed for person@example.com with api_key=private"
        )
        result = self.client.error(
            error,
            component="auth",
            fingerprint="auth/signup/provider",
            url="https://example.com/signup?token=private",
        )
        payload = self.payload()
        self.assertTrue(result.ok)
        self.assertEqual(payload["url"], "https://example.com/signup")
        self.assertEqual(
            payload["error"]["message"],
            "Signup failed for [redacted-email] with api_key=[redacted]",
        )
        self.assertNotIn("person@example.com", json.dumps(payload))
        self.assertNotIn("api_key=private", json.dumps(payload))

    def test_observe_preserves_the_original_error(self) -> None:
        original = RuntimeError("provider unavailable")

        def fail():
            raise original

        with self.assertRaises(RuntimeError) as raised:
            self.client.auth.signup(fail)
        self.assertIs(raised.exception, original)
        self.client.flush()
        self.assertEqual(self.payload()["type"], "feature.result")

    def test_safe_error_details(self) -> None:
        details = safe_error_details(ValueError("bad secret=hidden"))
        self.assertEqual(details["message"], "bad secret=[redacted]")


if __name__ == "__main__":
    unittest.main()
