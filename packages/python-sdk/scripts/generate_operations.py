from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OPENAPI = ROOT / "public" / "openapi.json"
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "noxhere" / "_operations.py"
METHODS = {"get", "post", "put", "patch", "delete"}
NAMESPACES = {
    "NoxConnect": "workspace",
    "Activity": "activity",
    "NoxTicket": "planning",
    "NoxSpot": "feedback",
    "NoxCue": "incidents",
}

document = json.loads(OPENAPI.read_text())
operations: list[tuple[str, str, str, str]] = []
for path, path_item in document["paths"].items():
    for method, operation in path_item.items():
        if method not in METHODS or "operationId" not in operation:
            continue
        tag = operation.get("tags", [None])[0]
        namespace = NAMESPACES.get(tag)
        if namespace is None:
            raise RuntimeError(f"No SDK namespace for {operation['operationId']} tag {tag}")
        operations.append((operation["operationId"], method.upper(), path, namespace))
operations.sort()
if len({operation[0] for operation in operations}) != len(operations):
    raise RuntimeError("OpenAPI operationId values must be unique")

content = (
    "# Generated from public/openapi.json. Do not edit by hand.\n"
    "from typing import Final\n\n"
    f"OPERATIONS: Final = {operations!r}\n"
)
if "--check" in sys.argv:
    if not OUTPUT.exists() or OUTPUT.read_text() != content:
        raise SystemExit(f"{OUTPUT} is stale; run python scripts/generate_operations.py")
else:
    OUTPUT.write_text(content)
    print(f"Generated {len(operations)} operations in {OUTPUT}")
