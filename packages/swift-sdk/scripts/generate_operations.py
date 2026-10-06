#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "packages" / "sdk-contract" / "public-api.json"
OUTPUT = Path(__file__).resolve().parents[1] / "Sources" / "NoxHere" / "GeneratedOperations.swift"


def swift_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def generate() -> str:
    document = json.loads(CONTRACT.read_text())
    operations = document["x-sdk-operations"]
    resources = sorted({operation["namespace"] for operation in operations})
    lines = [
        "// Generated from packages/sdk-contract/public-api.json. Do not edit by hand.",
        "import Foundation",
        "",
        "public enum NoxHereResource: String, CaseIterable, Sendable {",
        *[f"    case {resource}" for resource in resources],
        "}",
        "",
        "public enum NoxHereChangeSafety: String, Sendable {",
        "    case safeRead = \"safe_read\"",
        "    case idempotentWithEventKey = \"idempotent_with_event_key\"",
        "    case conditionalWrite = \"conditional_write\"",
        "    case writeNotSafeToRetry = \"write_not_safe_to_retry\"",
        "    case destructive",
        "}",
        "",
        "public struct NoxHereOperation: Sendable, Equatable {",
        "    public let id: String",
        "    public let method: String",
        "    public let path: String",
        "    public let resource: NoxHereResource",
        "    public let changeSafety: NoxHereChangeSafety",
        "    public let servers: [String]",
        "}",
        "",
        "public enum NoxHereOperations {",
        f"    public static let operationCount = {len(operations)}",
        "    public static let all: [String: NoxHereOperation] = [",
    ]
    for operation in operations:
        servers = ", ".join(swift_string(server["url"]) for server in operation.get("servers", []))
        safety = {
            "safe_read": "safeRead",
            "idempotent_with_event_key": "idempotentWithEventKey",
            "conditional_write": "conditionalWrite",
            "write_not_safe_to_retry": "writeNotSafeToRetry",
            "destructive": "destructive",
        }[operation["changeSafety"]]
        lines.append(
            f"        {swift_string(operation['id'])}: .init(id: {swift_string(operation['id'])}, method: {swift_string(operation['method'])}, path: {swift_string(operation['path'])}, resource: .{operation['namespace']}, changeSafety: .{safety}, servers: [{servers}]),"
        )
    lines.extend(["    ]", "}", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = generate()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != expected:
            print(f"{OUTPUT.relative_to(ROOT)} is stale; run npm run sdk:generate")
            return 1
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(expected)
    print(f"Generated Swift SDK operations in {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
