from __future__ import annotations

import json
import unittest
from typing import Mapping

from noxhere import NoxHereApiError, NoxHereClient


class Recorder:
    def __init__(self, status: int = 200, response: object = None) -> None:
        self.calls: list[tuple[str, str, Mapping[str, str], bytes | None]] = []
        self.status = status
        self.response = response

    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None):
        self.calls.append((method, url, headers, body))
        return self.status, {"Content-Type": "application/json"}, json.dumps(self.response).encode()


class ClientTest(unittest.TestCase):
    def test_maps_every_operation_and_alias(self) -> None:
        client = NoxHereClient(transport=Recorder())
        self.assertEqual(len(client.operation_ids()), 149)
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
        result = client.activity.get_issue(path={"repo": "owner/repo", "number": 42}, query={"include": ["body", "labels"]})
        self.assertEqual(result, {"ok": True})
        _, url, headers, _ = recorder.calls[0]
        self.assertEqual(url, "https://example.test/api/v1/issues/owner%2Frepo/42?include=body&include=labels")
        self.assertEqual(headers["Authorization"], "Bearer nox_sk_test_secret")
        self.assertEqual(headers["X-Project-ID"], "project-1")

    def test_json_body_and_error(self) -> None:
        recorder = Recorder(status=403, response={"error": "denied"})
        client = NoxHereClient(transport=recorder)
        with self.assertRaises(NoxHereApiError) as raised:
            client.workspace.create_project(body={"name": "Demo"})
        self.assertEqual(raised.exception.status, 403)
        self.assertEqual(raised.exception.details, {"error": "denied"})
        self.assertEqual(recorder.calls[0][2]["Content-Type"], "application/json")


if __name__ == "__main__":
    unittest.main()
