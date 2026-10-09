from typing import Any

from .client import NoxHereClient, ResourceClient


def create_stats_client(**options: Any) -> ResourceClient:
    return NoxHereClient(**options).stats
