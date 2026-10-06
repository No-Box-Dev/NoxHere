from __future__ import annotations

import asyncio
import unittest
from concurrent.futures import ThreadPoolExecutor
from typing import Mapping

from noxhere import AsyncNativeAuth, NativeAuth, NativeSessionState


EXPIRED = NativeSessionState(
    access_token="nox_at_old",
    refresh_token="nox_rt_old",
    access_expires_at="2020-01-01T00:00:00Z",
)


class NativeAuthTest(unittest.TestCase):
    def test_device_flow_and_single_refresh(self) -> None:
        calls: list[tuple[str, Mapping[str, object]]] = []

        def transport(path: str, body: Mapping[str, object]) -> Mapping[str, object]:
            calls.append((path, body))
            if path.endswith("/start"):
                return {"device_code": "device-1", "user_code": "ABCD", "verification_uri": "https://app.noxhere.com/device"}
            if path.endswith("/poll"):
                return {"access_token": "nox_at_initial", "refresh_token": "nox_rt_initial", "expires_in": 900}
            return {"access_token": "nox_at_rotated", "refresh_token": "nox_rt_rotated", "expires_in": 900}

        auth = NativeAuth(client="test-client", session=EXPIRED, transport=transport)
        self.assertEqual(auth.start().device_code, "device-1")
        self.assertEqual(auth.poll("device-1").access_token, "nox_at_initial")  # type: ignore[union-attr]
        auth.set_session(EXPIRED)
        def access(_: int) -> str | None:
            return auth.access_token()
        with ThreadPoolExecutor(max_workers=3) as executor:
            tokens = list(executor.map(access, range(3)))
        self.assertEqual(tokens, ["nox_at_rotated"] * 3)
        self.assertEqual(sum(path.endswith("/refresh") for path, _ in calls), 1)


class AsyncNativeAuthTest(unittest.IsolatedAsyncioTestCase):
    async def test_async_start_preserves_device_authorization_fields(self) -> None:
        async def transport(path: str, body: Mapping[str, object]) -> Mapping[str, object]:
            del path, body
            return {
                "device_code": "device-1",
                "verification_uri": "https://app.noxhere.com/device",
                "verification_uri_complete": "https://app.noxhere.com/device?code=ABCD",
                "user_code": "ABCD",
                "expires_in": 900,
                "interval": 5,
            }

        authorization = await AsyncNativeAuth(client="test-client", transport=transport).start()
        self.assertEqual(authorization.user_code, "ABCD")
        self.assertEqual(authorization.verification_uri_complete, "https://app.noxhere.com/device?code=ABCD")
        self.assertEqual(authorization.expires_in, 900)
        self.assertEqual(authorization.interval, 5)

    async def test_async_refresh_is_single_flight(self) -> None:
        calls = 0

        async def transport(path: str, body: Mapping[str, object]) -> Mapping[str, object]:
            nonlocal calls
            del path, body
            calls += 1
            await asyncio.sleep(0)
            return {"access_token": "nox_at_rotated", "refresh_token": "nox_rt_rotated", "expires_in": 900}

        auth = AsyncNativeAuth(client="test-client", session=EXPIRED, transport=transport)
        tokens = await asyncio.gather(auth.access_token(), auth.access_token(), auth.access_token())
        self.assertEqual(tokens, ["nox_at_rotated"] * 3)
        self.assertEqual(calls, 1)


if __name__ == "__main__":
    unittest.main()
