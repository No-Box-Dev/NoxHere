from __future__ import annotations

import asyncio
import json
import unittest
from typing import Mapping

from noxhere import AsyncNoxHereClient, NoxHereApiError, NoxHereClient, NoxHereTransportError, models


class Recorder:
    def __init__(self, status: int = 200, response: object = None, headers: Mapping[str, str] | None = None) -> None:
        self.calls: list[tuple[str, str, Mapping[str, str], bytes | None]] = []
        self.status = status
        self.response = response
        self.headers = dict(headers or {"Content-Type": "application/json"})

    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None):
        self.calls.append((method, url, headers, body))
        return self.status, self.headers, json.dumps(self.response).encode()


class SequenceRecorder:
    def __init__(self, responses: list[tuple[int, Mapping[str, str], object]]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, str, Mapping[str, str], bytes | None]] = []

    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None):
        self.calls.append((method, url, headers, body))
        status, response_headers, response = self.responses.pop(0)
        return status, response_headers, json.dumps(response).encode()


class AsyncRecorder:
    def __init__(self, status: int = 200, response: object = None) -> None:
        self.calls: list[tuple[str, str, Mapping[str, str], bytes | None]] = []
        self.status = status
        self.response = response

    async def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None):
        self.calls.append((method, url, headers, body))
        return self.status, {"Content-Type": "application/json"}, json.dumps(self.response).encode()


class ClientTest(unittest.TestCase):
    def test_maps_every_operation_and_alias(self) -> None:
        client = NoxHereClient(transport=Recorder())
        self.assertGreater(len(client.operation_ids()), 100)
        self.assertIs(client.cue, client.incidents)
        self.assertIs(client.spot, client.feedback)

    def test_encodes_path_query_and_auth(self) -> None:
        recorder = Recorder(response={"ok": True})
        client = NoxHereClient(
            base_url="https://example.test/base/",
            token="nox_sk_test_secret",
            organization="no-box-dev",
            project_id="project-1",
            transport=recorder,
        )
        result = client.activity.get_issue(path={"repo": "owner/repo", "number": 42})
        self.assertEqual(result, {"ok": True})
        _, url, headers, _ = recorder.calls[0]
        self.assertEqual(url, "https://example.test/api/v1/issues/owner%2Frepo/42")
        self.assertEqual(headers["Authorization"], "Bearer nox_sk_test_secret")
        self.assertEqual(headers["X-Project-ID"], "project-1")

        client.activity.get_nox_feed(query={"repo": "owner/repo", "limit": 20})
        self.assertEqual(recorder.calls[1][1], "https://example.test/api/v1/feed?repo=owner%2Frepo&limit=20")

    def test_json_body_and_error(self) -> None:
        recorder = Recorder(status=403, response={"error": {"code": "permission_denied", "message": "Access denied"}}, headers={"Content-Type": "application/json", "X-Request-ID": "request-1"})
        client = NoxHereClient(transport=recorder)
        with self.assertRaises(NoxHereApiError) as raised:
            client.workspace.create_project(body={"name": "Demo"})
        self.assertEqual(raised.exception.status, 403)
        self.assertEqual(raised.exception.code, "permission_denied")
        self.assertEqual(raised.exception.request_id, "request-1")
        self.assertFalse(raised.exception.retryable)
        self.assertEqual(recorder.calls[0][2]["Content-Type"], "application/json")

    def test_retry_safety_context_server_and_hooks(self) -> None:
        recorder = SequenceRecorder([
            (503, {"Content-Type": "application/json", "Retry-After": "0"}, {"error": "busy"}),
            (200, {"Content-Type": "application/json"}, {"projects": []}),
        ])
        delays: list[float] = []
        client = NoxHereClient(transport=recorder, sleep=delays.append)
        self.assertEqual(client.workspace.list_projects(), {"projects": []})
        self.assertEqual(len(recorder.calls), 2)
        self.assertEqual(delays, [0.0])

        unsafe = Recorder(status=503, response={"error": "busy"})
        with self.assertRaises(NoxHereApiError):
            NoxHereClient(transport=unsafe, sleep=delays.append).workspace.create_project(body={"name": "Demo"})
        self.assertEqual(len(unsafe.calls), 1)

        idempotent = SequenceRecorder([
            (503, {"Content-Type": "application/json", "Retry-After": "0"}, {"error": "busy"}),
            (202, {"Content-Type": "application/json"}, {"apiVersion": 1, "feedback": {"id": "feedback-1", "status": "received", "duplicate": False, "createdAt": "2026-10-07T00:00:00Z"}}),
        ])
        result = NoxHereClient(transport=idempotent, sleep=delays.append).workspace.submit_developer_feedback(body={
            "area": "api", "category": "friction", "summary": "Unclear project",
            "details": "The selected project was unclear.", "idempotencyKey": "feedback-retry-1",
        })
        self.assertEqual(result["feedback"]["status"], "received")
        self.assertEqual(len(idempotent.calls), 2)
        self.assertEqual(idempotent.calls[0][3], idempotent.calls[1][3])

        observed: list[str] = []
        public = Recorder(response={"ok": True})
        scoped = NoxHereClient(token="nox_sk_secret", transport=public, on_request=lambda event: observed.append(str(event["url"]))).with_context(organization="No-Box-Dev", project_id="project-1")
        scoped.feedback.get_public_nox_spot_config(path={"siteId": "site-1"})
        self.assertEqual(public.calls[0][1], "https://api.noxspot.dev/api/spots/public/v1/sites/site-1/config")
        self.assertEqual(public.calls[0][2]["X-NoxHere-SDK"], "python/0.2.0")
        self.assertNotIn("Authorization", public.calls[0][2])
        self.assertNotIn("X-Org", public.calls[0][2])
        self.assertNotIn("X-Project-ID", public.calls[0][2])
        scoped.request("reopenResolvedNoxSpotReport", path={"token": "secret-token"}, body=b"payload")
        self.assertIn("[redacted]", observed[-1])
        self.assertNotIn("secret-token", observed[-1])

        scoped_project = scoped.with_context(project_id="project-2")
        scoped_project.workspace.list_projects()
        self.assertEqual(public.calls[-1][2]["X-Org"], "No-Box-Dev")
        self.assertEqual(public.calls[-1][2]["X-Project-ID"], "project-2")

        staging = Recorder(response={"ok": True})
        NoxHereClient(base_url="https://staging.example.test/root", token="secret", transport=staging).feedback.get_public_nox_spot_config(path={"siteId": "site-1"})
        self.assertEqual(staging.calls[0][1], "https://staging.example.test/api/spots/public/v1/sites/site-1/config")
        self.assertNotIn("Authorization", staging.calls[0][2])

    def test_generated_models_preserve_wire_field_names(self) -> None:
        self.assertIn("from", models.SearchWorkspaceQuery.__annotations__)
        self.assertNotIn("from_", models.SearchWorkspaceQuery.__annotations__)

    def test_rejects_bearer_credentials_over_non_loopback_http(self) -> None:
        recorder = Recorder(response={"ok": True})
        with self.assertRaisesRegex(ValueError, "require HTTPS"):
            NoxHereClient(base_url="http://example.test", token="secret", transport=recorder).workspace.list_projects()
        self.assertEqual(recorder.calls, [])
        NoxHereClient(base_url="http://127.0.0.1:8787", token="secret", transport=recorder).workspace.list_projects()
        self.assertEqual(len(recorder.calls), 1)


class AsyncClientTest(unittest.IsolatedAsyncioTestCase):
    async def test_async_resources_use_the_same_generated_contract(self) -> None:
        recorder = AsyncRecorder(response={"events": [], "nextCursor": None})
        client = AsyncNoxHereClient(token="nox_sk_test_secret", transport=recorder)
        result = await client.activity.get_nox_feed(query={"limit": 10})
        self.assertEqual(result, {"events": [], "nextCursor": None})
        self.assertEqual(recorder.calls[0][0], "GET")
        self.assertEqual(recorder.calls[0][1], "https://app.noxhere.com/api/v1/feed?limit=10")

    async def test_async_timeout_is_bounded(self) -> None:
        async def never_responds(method: str, url: str, headers: Mapping[str, str], body: bytes | None):
            del method, url, headers, body
            await asyncio.sleep(60)
            raise AssertionError("unreachable")

        client = AsyncNoxHereClient(transport=never_responds, timeout=0.001, max_retries=0)
        with self.assertRaises(NoxHereTransportError):
            await client.activity.get_nox_feed(query={"limit": 1})

    async def test_async_context_and_public_credentials_are_safe(self) -> None:
        recorder = AsyncRecorder(response={"ok": True})
        client = AsyncNoxHereClient(token="secret", organization="org-1", project_id="project-1", transport=recorder)
        await client.with_context(project_id="project-2").feedback.get_public_nox_spot_config(path={"siteId": "site-1"})
        _, url, headers, _ = recorder.calls[0]
        self.assertEqual(url, "https://api.noxspot.dev/api/spots/public/v1/sites/site-1/config")
        self.assertNotIn("Authorization", headers)
        self.assertNotIn("X-Org", headers)


if __name__ == "__main__":
    unittest.main()
