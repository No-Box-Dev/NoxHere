from __future__ import annotations

import unittest

from telemetry import TelemetryClient, create_telemetry
from noxhere.telemetry import TelemetryClient as UnifiedTelemetryClient


class CompatibilityTests(unittest.TestCase):
    def test_legacy_package_forwards_to_unified_telemetry(self) -> None:
        self.assertIs(TelemetryClient, UnifiedTelemetryClient)
        client = create_telemetry(
            key="invalid",
            environment="test",
        )
        try:
            self.assertEqual(client.test().error, "invalid_configuration")
        finally:
            client.close()


if __name__ == "__main__":
    unittest.main()
