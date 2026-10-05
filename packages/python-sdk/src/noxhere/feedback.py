from typing import Any

from .client import NoxHereClient, ResourceClient


def create_feedback_client(**options: Any) -> ResourceClient:
    return NoxHereClient(**options).feedback
