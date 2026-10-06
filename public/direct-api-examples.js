const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

export function collectDirectApiOperations(document) {
  const operations = [];
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      operations.push({
        path,
        method: method.toUpperCase(),
        operation,
        pathItem,
        curl: buildCurlExample(document, path, method, operation, pathItem),
      });
    }
  }
  return operations;
}

export function buildCurlExample(document, path, method, operation, pathItem = {}) {
  const server = operation.servers?.[0]?.url ?? pathItem.servers?.[0]?.url ?? document.servers?.[0]?.url ?? "https://app.noxhere.com";
  const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
    .map((parameter) => resolveReference(document, parameter));
  let requestPath = path.replaceAll(/\{([^}]+)\}/g, (_, name) => `\${${environmentName(name)}}`);
  const requiredQuery = parameters.filter((parameter) => parameter.in === "query" && parameter.required);
  if (requiredQuery.length > 0) {
    const query = requiredQuery.map((parameter) => `${parameter.name}=\${${environmentName(parameter.name)}}`).join("&");
    requestPath += `?${query}`;
  }

  const lines = [`curl --request ${method.toUpperCase()} \\`, `  "${server}${requestPath}"`];
  for (const header of authenticationHeaders(operation.security ?? document.security ?? [])) {
    lines[lines.length - 1] += " \\";
    lines.push(`  --header "${header}"`);
  }
  for (const parameter of parameters.filter((item) => item.in === "header" && item.required)) {
    if (lines.some((line) => line.toLowerCase().includes(`${parameter.name}:`.toLowerCase()))) continue;
    lines[lines.length - 1] += " \\";
    lines.push(`  --header "${parameter.name}: \$${environmentName(parameter.name)}"`);
  }

  const body = requestBodyExample(document, operation.requestBody);
  if (body) {
    lines[lines.length - 1] += " \\";
    if (body.mediaType === "multipart/form-data") {
      body.fields.forEach((field, index) => {
        const continuation = index < body.fields.length - 1 ? " \\" : "";
        const value = field.binary ? `@path/to/${field.name}` : String(field.value);
        lines.push(`  --form '${field.name}=${value}'${continuation}`);
      });
    } else {
      lines.push(`  --header 'Content-Type: ${body.mediaType}' \\`);
      lines.push(`  --data '${JSON.stringify(body.value)}'`);
    }
  }
  return lines.join("\n");
}

function authenticationHeaders(security) {
  if (!Array.isArray(security) || security.length === 0) return [];
  const choice = security.find((entry) => entry.noxApiToken)
    ?? security.find((entry) => entry.nativeSession)
    ?? security.find((entry) => entry.noxCueKey)
    ?? security[0];
  const headers = [];
  if (choice.noxApiToken) headers.push("Authorization: Bearer $NOXHERE_API_TOKEN");
  else if (choice.nativeSession) headers.push("Authorization: Bearer $NOXHERE_ACCESS_TOKEN");
  else if (choice.noxCueKey) headers.push("X-Nox-Ingest-Key: $NOXHERE_INGEST_KEY");
  else if (choice.browserSession) headers.push("Cookie: __Host-nox_session=$NOXHERE_SESSION");
  if (choice.organization && !choice.noxApiToken) headers.push("X-Org: $NOXHERE_ORG");
  if (choice.csrfProof) headers.push("X-CSRF-Token: $NOXHERE_CSRF_TOKEN");
  return headers;
}

function requestBodyExample(document, requestBody) {
  if (!requestBody) return null;
  const resolved = resolveReference(document, requestBody);
  const content = resolved.content ?? {};
  if (content["application/json"]) {
    return { mediaType: "application/json", value: exampleForSchema(document, content["application/json"].schema) };
  }
  if (content["multipart/form-data"]) {
    const schema = resolveReference(document, content["multipart/form-data"].schema);
    const fields = Object.entries(schema?.properties ?? {}).map(([name, property]) => {
      const resolvedProperty = resolveReference(document, property);
      return {
        name,
        binary: resolvedProperty?.format === "binary",
        value: exampleForSchema(document, resolvedProperty),
      };
    });
    return { mediaType: "multipart/form-data", fields };
  }
  const [mediaType, media] = Object.entries(content)[0] ?? [];
  return mediaType ? { mediaType, value: exampleForSchema(document, media.schema) } : null;
}

function exampleForSchema(document, schema, seen = new Set()) {
  const resolved = resolveReference(document, schema);
  if (!resolved || typeof resolved !== "object") return {};
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.oneOf?.length) return exampleForSchema(document, resolved.oneOf[0], seen);
  if (resolved.anyOf?.length) return exampleForSchema(document, resolved.anyOf[0], seen);
  if (resolved.type === "array") return [exampleForSchema(document, resolved.items, seen)];
  if (resolved.type === "boolean") return true;
  if (resolved.type === "integer" || resolved.type === "number") return resolved.minimum ?? 1;
  if (resolved.type === "string") return stringExample(resolved);

  const identity = schema?.$ref;
  if (identity && seen.has(identity)) return {};
  const nextSeen = new Set(seen);
  if (identity) nextSeen.add(identity);
  const required = new Set(resolved.required ?? []);
  const entries = Object.entries(resolved.properties ?? {})
    .filter(([name, property]) => required.has(name) || property.example !== undefined || property.default !== undefined)
    .map(([name, property]) => [name, exampleForSchema(document, property, nextSeen)]);
  return Object.fromEntries(entries);
}

function stringExample(schema) {
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
  if (schema.format === "date") return "2026-01-01";
  if (schema.format === "email") return "developer@example.com";
  if (schema.format === "uri" || schema.format === "url") return "https://example.com";
  if (schema.pattern?.includes("uuid")) return "00000000-0000-4000-8000-000000000000";
  return "string";
}

function resolveReference(document, value) {
  if (!value?.$ref) return value;
  if (!value.$ref.startsWith("#/")) return value;
  return value.$ref.slice(2).split("/").reduce((current, token) => {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    return current?.[key];
  }, document);
}

function environmentName(name) {
  return String(name)
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll(/[^a-zA-Z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .toUpperCase();
}
