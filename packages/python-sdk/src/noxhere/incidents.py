from typing import Any

from .client import NoxHereClient, ResourceClient


def create_incident_client(**options: Any) -> ResourceClient:
    return NoxHereClient(**options).incidents
