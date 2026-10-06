from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "packages" / "sdk-contract" / "public-api.json"
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "noxhere" / "_operations.py"
document = json.loads(CONTRACT.read_text())
operations: list[tuple[str, str, str, str]] = [
    (operation["id"], operation["method"], operation["path"], operation["namespace"])
    for operation in document["operations"]
]
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
