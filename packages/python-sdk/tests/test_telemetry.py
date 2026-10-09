from __future__ import annotations

# Test doubles deliberately model arbitrary urllib request/JSON values.
# pyright: reportUnknownParameterType=false, reportMissingParameterType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownVariableType=false, reportMissingTypeArgument=false, reportUnknownLambdaType=false

import json
import os
import sys
import unittest
from pathlib import Path
from typing import Mapping

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from noxhere.telemetry import NoxCueClient, create_noxcue, safe_error_details  # noqa: E402

SERVER_KEY = "nox_secret_" + "b" * 32
IDENTITY_HASH_KEY = "identity-secret-key-that-is-at-least-32-bytes"
FIXTURES = json.loads(
    (PACKAGE.parents[1] / "services" / "cue" / "packages" / "sdk-contract" / "wire-fixtures.json").read_text()
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
            identity_hash_key=IDENTITY_HASH_KEY,
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
                self.client.flush()
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
            key=SERVER_KEY, identity_hash_key=IDENTITY_HASH_KEY, environment="production", transport=transport
        ) as client:
            result = client.activity("custom.journals.added", "user-42")
        self.assertTrue(result.ok)
        self.assertEqual(calls[0]["eventId"], calls[1]["eventId"])

    def test_sets_a_versioned_user_agent(self) -> None:
        self.client.test()
        self.assertRegex(self.requests[-1][0].get_header("User-agent"), r"^noxhere-python/\d+\.\d+\.\d+$")

    def test_environment_bootstrap_and_memory_mode_never_use_network(self) -> None:
        previous = dict(os.environ)
        os.environ.update({
            "NOXHERE_INGEST_KEY": SERVER_KEY,
            "NOXHERE_IDENTITY_HASH_KEY": IDENTITY_HASH_KEY,
            "NOXHERE_ENVIRONMENT": "test",
            "NOXHERE_TELEMETRY_MODE": "memory",
        })
        try:
            client = create_noxcue(flush_at_exit=False, transport=lambda *_: self.fail("network called"))
            result = client.events.report_generated("user-42", "report-7")
            client.flush()
            self.assertTrue(result.ok)
            self.assertEqual(client.captured_events[0]["name"], "reports.generated")
            self.assertEqual(client.captured_events[0]["attributes"], {"reportId": "report-7"})
            self.assertNotIn("user-42", json.dumps(client.captured_events))
            client.close()
        finally:
            os.environ.clear()
            os.environ.update(previous)

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

    def test_identity_is_opaque_and_request_scoped(self) -> None:
        self.client.identify(
            {"id": "user-42", "name": "Ada", "email": "private@example.com"}
        )
        self.client.feature.result("auth.login", outcome="success")
        payload = self.payload()
        self.assertEqual(
            payload["userId"],
            "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40",
        )
        self.assertNotIn("private@example.com", json.dumps(payload))
        self.assertNotIn("Ada", json.dumps(payload))

        with self.client.for_user("user-99") as scoped:
            scoped.error(RuntimeError("failed"))
        scoped_payload = self.payload()
        self.assertEqual(
            scoped_payload["data"]["affectedUser"],
            "h1_primary_ofqGXPyat7KK5ahKDwoHUnwy2rtCkjQKU5qH04t8mXE",
        )

    def test_disabled_and_closed_clients_never_call_transport(self) -> None:
        client = NoxCueClient(
            key=SERVER_KEY,
            environment="production",
            enabled=False,
            transport=lambda *_: self.fail("network called"),
        )
        self.assertEqual(client.test().error, "invalid_configuration")
        scoped = client.for_user("user-42")
        try:
            self.assertEqual(scoped.test().error, "invalid_configuration")
        finally:
            scoped.close()
        client.close()
        self.assertEqual(client.test().error, "invalid_configuration")


if __name__ == "__main__":
    unittest.main()
