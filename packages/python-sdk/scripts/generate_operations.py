from __future__ import annotations

import json
import keyword
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "packages" / "sdk-contract" / "public-api.json"
PACKAGE = Path(__file__).resolve().parents[1] / "src" / "noxhere"
OPERATIONS_OUTPUT = PACKAGE / "_operations.py"
MODELS_OUTPUT = PACKAGE / "models.py"
CLIENT_STUB_OUTPUT = PACKAGE / "client.pyi"
INIT_STUB_OUTPUT = PACKAGE / "__init__.pyi"

document = json.loads(CONTRACT.read_text())
operations = document["x-sdk-operations"]
components = document.get("components", {})


def snake(value: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", value).lower().replace("-", "_")


def pascal(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in re.split(r"[^A-Za-z0-9]+|_", snake(value)) if part)


def safe_identifier(value: str) -> str:
    if not value.isidentifier():
        raise ValueError(f"OpenAPI property {value!r} cannot be represented as a Python TypedDict field")
    return f"{value}_" if keyword.iskeyword(value) else value


def resolve(ref: str) -> Any:
    value: Any = document
    for token in ref.removeprefix("#/").split("/"):
        value = value[token.replace("~1", "/").replace("~0", "~")]
    return value


def ref_name(ref: str) -> str:
    return pascal(ref.rsplit("/", 1)[-1])


class ModelGenerator:
    def __init__(self) -> None:
        self.schemas: dict[str, dict[str, Any]] = {
            pascal(name): schema for name, schema in sorted(components.get("schemas", {}).items())
        }

    def register(self, name: str, schema: dict[str, Any] | None) -> str:
        normalized = pascal(name)
        if schema and normalized not in self.schemas:
            self.schemas[normalized] = schema
        return normalized

    def expression(self, schema: dict[str, Any] | None, hint: str | None = None) -> str:
        if not schema:
            return "Any"
        if "$ref" in schema:
            return f'"{ref_name(schema["$ref"])}"'
        if "const" in schema:
            return f"Literal[{schema['const']!r}]"
        if schema.get("enum"):
            return f"Literal[{', '.join(repr(value) for value in schema['enum'])}]"
        variants = schema.get("oneOf") or schema.get("anyOf")
        if variants:
            return f"Union[{', '.join(self.expression(item, hint) for item in variants)}]"
        if schema.get("allOf"):
            return f"Union[{', '.join(self.expression(item, hint) for item in schema['allOf'])}]"
        schema_type = schema.get("type")
        if isinstance(schema_type, list):
            return f"Union[{', '.join(self.expression({**schema, 'type': item}, hint) for item in schema_type)}]"
        if schema_type == "null":
            return "None"
        if schema_type == "boolean":
            return "bool"
        if schema_type == "integer":
            return "int"
        if schema_type == "number":
            return "float"
        if schema_type == "string":
            return "bytes" if schema.get("format") == "binary" else "str"
        if schema_type == "array":
            return f"list[{self.expression(schema.get('items'), hint)}]"
        if schema_type == "object" or "properties" in schema or "additionalProperties" in schema:
            if hint and schema.get("properties"):
                return f'"{self.register(hint, schema)}"'
            additional = schema.get("additionalProperties")
            value = self.expression(additional) if isinstance(additional, dict) else "Any"
            return f"dict[str, {value}]"
        return "Any"

    def render(self) -> str:
        lines = [
            "# Generated from packages/sdk-contract/public-api.json. Do not edit by hand.",
            "from typing import Any, Literal, TypeAlias, Union",
            "from typing_extensions import NotRequired, Required, TypedDict",
            "",
            "JsonPrimitive: TypeAlias = None | bool | int | float | str",
            "",
        ]
        rendered: set[str] = set()
        while pending := [(name, schema) for name, schema in self.schemas.items() if name not in rendered]:
            name, schema = pending[0]
            rendered.add(name)
            if name == "JsonValue":
                lines.extend(["JsonValue: TypeAlias = JsonPrimitive | list[\"JsonValue\"] | dict[str, \"JsonValue\"]", ""])
                continue
            all_of = schema.get("allOf")
            if all_of and len(all_of) == 1 and "$ref" in all_of[0]:
                lines.extend([f"{name}: TypeAlias = {ref_name(all_of[0]['$ref'])}", ""])
                continue
            properties = schema.get("properties", {})
            if schema.get("type") == "object" and properties:
                required = set(schema.get("required", []))
                lines.append(f"class {name}(TypedDict, total=False):")
                for field, field_schema in properties.items():
                    field_type = self.expression(field_schema, f"{name}{pascal(field)}")
                    wrapper = "Required" if field in required else "NotRequired"
                    lines.append(f"    {safe_identifier(field)}: {wrapper}[{field_type}]")
                lines.append("")
                continue
            expression = self.expression(schema)
            lines.extend([f"{name}: TypeAlias = {expression}", ""])
        return "\n".join(lines).rstrip() + "\n"


models = ModelGenerator()


def operation_groups(operation: dict[str, Any]) -> dict[str, tuple[str, bool]]:
    groups: dict[str, list[dict[str, Any]]] = {"path": [], "query": []}
    for raw in operation.get("parameters", []):
        parameter = resolve(raw["$ref"]) if "$ref" in raw else raw
        if parameter.get("in") in groups:
            groups[parameter["in"]].append(parameter)
    result: dict[str, tuple[str, bool]] = {}
    for location, parameters in groups.items():
        if not parameters:
            continue
        name = models.register(f"{pascal(operation['id'])}{pascal(location)}", {
            "type": "object",
            "properties": {parameter["name"]: parameter.get("schema", {}) for parameter in parameters},
            "required": [parameter["name"] for parameter in parameters if parameter.get("required")],
        })
        result[location] = (name, any(parameter.get("required") for parameter in parameters))
    return result


def request_body(operation: dict[str, Any]) -> tuple[str, bool] | None:
    raw = operation.get("requestBody")
    if not raw:
        return None
    body = resolve(raw["$ref"]) if "$ref" in raw else raw
    content = body.get("content", {})
    if "multipart/form-data" in content:
        return "Mapping[str, Any]", bool(body.get("required", True))
    selected = content.get("application/json") or next(iter(content.values()), {})
    schema = selected.get("schema", {})
    if "$ref" in schema:
        body_type = f"models.{ref_name(schema['$ref'])}"
    elif schema.get("properties"):
        body_type = f"models.{models.register(pascal(operation['id']) + 'Body', schema)}"
    else:
        body_type = "JsonValue"
    return body_type, bool(body.get("required", True))


def response_type(operation: dict[str, Any]) -> str:
    results: list[str] = []
    for status, raw in operation.get("responses", {}).items():
        if not str(status).startswith("2"):
            continue
        response = resolve(raw["$ref"]) if "$ref" in raw else raw
        content = response.get("content", {})
        if not content:
            results.append("None")
            continue
        if "application/octet-stream" in content:
            results.append("bytes")
            continue
        selected = content.get("application/json") or next(iter(content.values()), {})
        schema = selected.get("schema", {})
        if "$ref" in schema:
            results.append(f"models.{ref_name(schema['$ref'])}")
        elif schema.get("properties"):
            results.append(f"models.{models.register(pascal(operation['id']) + 'Response', schema)}")
        else:
            results.append(models.expression(schema))
    return " | ".join(dict.fromkeys(results or ["None"]))


operation_details = [
    (operation, operation_groups(operation), request_body(operation), response_type(operation))
    for operation in operations
]


def render_method(operation: dict[str, Any], groups: dict[str, tuple[str, bool]], body: tuple[str, bool] | None, response: str, *, asynchronous: bool = False) -> str:
    arguments: list[str] = []
    for location in ("path", "query"):
        if location in groups:
            model, required = groups[location]
            arguments.append(f"{location}: models.{model}" + ("" if required else " | None = None"))
    if body:
        body_type, required = body
        arguments.append(f"body: {body_type}" + ("" if required else " | None = None"))
    arguments.append("headers: Mapping[str, str] | None = None")
    signature = ", *, " + ", ".join(arguments)
    prefix = "async " if asynchronous else ""
    return f"    {prefix}def {snake(operation['id'])}(self{signature}) -> {response}: ..."


def render_client_stub() -> str:
    grouped = {namespace: [] for namespace in ("workspace", "activity", "planning", "feedback", "incidents")}
    for details in operation_details:
        grouped[details[0]["namespace"]].append(details)
    lines = [
        "# Generated public typing surface. Runtime implementation lives in client.py.",
        "from __future__ import annotations",
        "",
        "from typing import Any, Callable, Mapping, Protocol, Sequence",
        "from . import models",
        "from .models import JsonValue",
        "",
        "TransportResult = tuple[int, Mapping[str, str], bytes]",
        "class Transport(Protocol):",
        "    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: bytes | None) -> TransportResult: ...",
        "",
        "class NoxHereApiError(RuntimeError):",
        "    status: int",
        "    operation_id: str",
        "    details: Any",
        "    code: str",
        "    request_id: str | None",
        "    retry_after: float | None",
        "    retryable: bool",
        "class NoxHereTransportError(RuntimeError):",
        "    operation_id: str",
        "    retryable: bool",
        "",
        "class ResourceClient:",
        "    def operation_ids(self) -> tuple[str, ...]: ...",
        "class AsyncResourceClient:",
        "    def operation_ids(self) -> tuple[str, ...]: ...",
        "",
    ]
    for namespace, details_list in grouped.items():
        lines.append(f"class {pascal(namespace)}Client(ResourceClient):")
        lines.extend(render_method(*details) for details in details_list)
        lines.append("")
        lines.append(f"class Async{pascal(namespace)}Client(AsyncResourceClient):")
        lines.extend(render_method(*details, asynchronous=True) for details in details_list)
        lines.append("")
    lines.extend([
        "class NoxHereClient:",
        "    base_url: str",
        "    workspace: WorkspaceClient",
        "    activity: ActivityClient",
        "    planning: PlanningClient",
        "    feedback: FeedbackClient",
        "    incidents: IncidentsClient",
        "    connect: WorkspaceClient",
        "    feed: ActivityClient",
        "    ticket: PlanningClient",
        "    spot: FeedbackClient",
        "    cue: IncidentsClient",
        "    def __init__(self, *, base_url: str = ..., token: str | None = ..., organization: str | None = ..., project_id: str | None = ..., csrf_token: str | None = ..., headers: Mapping[str, str] | None = ..., transport: Transport | None = ..., timeout: float = ..., max_retries: int = ..., retry_delay: float = ..., on_request: Callable[[Mapping[str, object]], None] | None = ..., on_response: Callable[[Mapping[str, object]], None] | None = ..., sleep: Callable[[float], None] = ...) -> None: ...",
        "    def request(self, operation_id: str, *, path: Mapping[str, str | int] | None = ..., query: Mapping[str, str | int | float | bool | Sequence[str | int | float | bool] | None] | None = ..., body: JsonValue | str | bytes | None = ..., headers: Mapping[str, str] | None = ...) -> Any: ...",
        "    def operation_ids(self) -> tuple[str, ...]: ...",
        "    def with_context(self, *, organization: str | None = ..., project_id: str | None = ...) -> NoxHereClient: ...",
        "",
        "class AsyncNoxHereClient:",
        "    base_url: str",
        "    workspace: AsyncWorkspaceClient",
        "    activity: AsyncActivityClient",
        "    planning: AsyncPlanningClient",
        "    feedback: AsyncFeedbackClient",
        "    incidents: AsyncIncidentsClient",
        "    connect: AsyncWorkspaceClient",
        "    feed: AsyncActivityClient",
        "    ticket: AsyncPlanningClient",
        "    spot: AsyncFeedbackClient",
        "    cue: AsyncIncidentsClient",
        "    def __init__(self, *, base_url: str = ..., token: str | None = ..., organization: str | None = ..., project_id: str | None = ..., csrf_token: str | None = ..., headers: Mapping[str, str] | None = ..., transport: Any = ..., timeout: float = ..., max_retries: int = ..., retry_delay: float = ..., on_request: Callable[[Mapping[str, object]], None] | None = ..., on_response: Callable[[Mapping[str, object]], None] | None = ...) -> None: ...",
        "    async def request(self, operation_id: str, *, path: Mapping[str, str | int] | None = ..., query: Mapping[str, str | int | float | bool | Sequence[str | int | float | bool] | None] | None = ..., body: JsonValue | str | bytes | None = ..., headers: Mapping[str, str] | None = ...) -> Any: ...",
        "    def operation_ids(self) -> tuple[str, ...]: ...",
        "    def with_context(self, *, organization: str | None = ..., project_id: str | None = ...) -> AsyncNoxHereClient: ...",
        "",
        "def create_noxhere(**options: Any) -> NoxHereClient: ...",
        "def create_async_noxhere(**options: Any) -> AsyncNoxHereClient: ...",
    ])
    return "\n".join(lines) + "\n"


operation_tuples = [(
    item["id"], item["method"], item["path"], item["namespace"], item["changeSafety"],
    tuple(server["url"] for server in item.get("servers", [])),
) for item in operations]
outputs = {
    OPERATIONS_OUTPUT: "# Generated from packages/sdk-contract/public-api.json. Do not edit by hand.\nfrom typing import Final\n\n" + f"OPERATIONS: Final = {operation_tuples!r}\n",
    MODELS_OUTPUT: models.render(),
    CLIENT_STUB_OUTPUT: render_client_stub(),
    INIT_STUB_OUTPUT: "from .auth import AsyncNativeAuth, DeviceAuthorization, NativeAuth, NativeSessionState\nfrom .client import AsyncNoxHereClient, NoxHereApiError, NoxHereClient, NoxHereTransportError, ResourceClient, create_async_noxhere, create_noxhere\nfrom . import models as models\n\n__all__ = [\"AsyncNativeAuth\", \"AsyncNoxHereClient\", \"DeviceAuthorization\", \"NativeAuth\", \"NativeSessionState\", \"NoxHereApiError\", \"NoxHereClient\", \"NoxHereTransportError\", \"ResourceClient\", \"create_async_noxhere\", \"create_noxhere\", \"models\"]\n",
}

if "--check" in sys.argv:
    stale = [str(path) for path, content in outputs.items() if not path.exists() or path.read_text() != content]
    if stale:
        raise SystemExit(f"Generated Python SDK files are stale: {', '.join(stale)}; run npm run sdk:generate")
else:
    for path, content in outputs.items():
        path.write_text(content)
    print(f"Generated {len(operation_tuples)} typed operations in {PACKAGE}")
