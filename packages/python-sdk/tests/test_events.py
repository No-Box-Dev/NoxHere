from __future__ import annotations

import unittest
from typing import Mapping

from noxhere.events import JsonValue, PLATFORM_EVENT_TYPES, create_platform_event


class PlatformEventTests(unittest.TestCase):
    def test_builds_the_common_envelope(self) -> None:
        event = create_platform_event(
            id="e835cd8f-f73a-4206-a67d-11df7d3f60d7",
            type="feedback.report.created",
            org_id=7,
            project_id="project-1",
            source={"component": "feedback.widget", "sourceId": "site-1"},
            subject={"type": "feedback_report", "id": "report-1"},
            occurred_at="2026-10-06T12:00:00.000Z",
            idempotency_key="feedback:report-1:created",
            data={
                "category": "bug",
                "description": "The button is obscured",
                "notificationRequested": False,
            },
        )
        self.assertEqual(event["specVersion"], 1)
        self.assertEqual(event["dataVersion"], 1)
        self.assertIn("delivery.notification.delivered", PLATFORM_EVENT_TYPES)

    def test_rejects_private_and_oversized_data(self) -> None:
        def create(data: Mapping[str, JsonValue]):
            return create_platform_event(
                type="feedback.report.created",
                org_id=7,
                project_id="project-1",
                source={"component": "feedback.widget"},
                subject={"type": "feedback_report", "id": "report-1"},
                idempotency_key="feedback:report-1:created",
                data=data,
            )

        with self.assertRaisesRegex(ValueError, "private identities"):
            create({"email": "private@example.com"})
        with self.assertRaisesRegex(ValueError, "exceeds"):
            create({"description": "x" * 65_000})


if __name__ == "__main__":
    unittest.main()
