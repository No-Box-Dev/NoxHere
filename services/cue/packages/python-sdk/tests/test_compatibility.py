from __future__ import annotations

import unittest

from noxcue import NoxCueClient, create_noxcue
from noxhere.telemetry import NoxCueClient as UnifiedNoxCueClient


class CompatibilityTests(unittest.TestCase):
    def test_legacy_package_forwards_to_unified_telemetry(self) -> None:
        self.assertIs(NoxCueClient, UnifiedNoxCueClient)
        client = create_noxcue(
            key="invalid",
            environment="test",
        )
        try:
            self.assertEqual(client.test().error, "invalid_configuration")
        finally:
            client.close()


if __name__ == "__main__":
    unittest.main()
