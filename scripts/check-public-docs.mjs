import { readFile } from "node:fs/promises";

const publicDocs = [
  "public/developers.html",
  "public/docs/ai-setup.md",
  "public/docs/data-governance.md",
  "public/llms.txt",
];
for (const path of publicDocs) {
  const content = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  if (!content.includes("NoxHere")) fail(`${path} does not identify NoxHere as the product`);
  if (/NoxConnect is the (?:public|customer-facing) product/.test(content)) {
    fail(`${path} still presents Connect as a separate product`);
  }
}

const developerReference = await readFile(new URL("../public/developers.html", import.meta.url), "utf8");
const agentReference = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");
const directApiGuide = await readFile(new URL("../public/docs/direct-api.md", import.meta.url), "utf8");
const robots = await readFile(new URL("../public/robots.txt", import.meta.url), "utf8");
const typeScriptReadme = await readFile(new URL("../packages/sdk/README.md", import.meta.url), "utf8");
const pythonReadme = await readFile(new URL("../packages/python-sdk/README.md", import.meta.url), "utf8");
for (const [path, content] of [
  ["public/developers.html", developerReference],
  ["public/llms.txt", agentReference],
  ["public/docs/direct-api.md", directApiGuide],
]) {
  if (!content.includes("python -m pip install --upgrade noxhere")) fail(`${path} does not explain how to install the Python SDK`);
  if (!content.includes("https://pypi.org/project/noxhere/")) fail(`${path} does not link to the public Python SDK`);
}
if (!robots.includes("Allow: /docs/direct-api.md")) fail("public/robots.txt does not expose the direct API and SDK guide");
if (!robots.includes("Allow: /docs/data-governance.md")) fail("public/robots.txt does not expose the data-governance guide");

const openapi = JSON.parse(await readFile(new URL("../public/openapi.json", import.meta.url), "utf8"));
if (openapi.info?.title !== "NoxHere API") fail("OpenAPI title is not NoxHere API");
for (const tag of ["Stats", "Incidents"]) {
  if (!openapi.tags?.some((entry) => entry.name === tag)) fail(`OpenAPI is missing the ${tag} capability tag`);
}
const operations = Object.values(openapi.paths).flatMap((pathItem) => Object.values(pathItem))
  .filter((operation) => operation && typeof operation === "object" && operation.operationId);
const operation = (id) => operations.find((entry) => entry.operationId === id);
if (operation("getCueProjectDashboard")?.tags?.[0] !== "Stats") fail("Stats dashboard is not tagged Stats");
if (operation("getProjectIncidents")?.tags?.[0] !== "Incidents") fail("Project incidents are not tagged Incidents");
if (operation("ingestNoxCueEvent")?.responses?.["429"]?.$ref !== "#/components/responses/RateLimited") fail("Telemetry 429 does not document Retry-After");
if (!typeScriptReadme.includes("nox.workspace.listNoxServices()")) fail("TypeScript README does not use a real generated operation");
if (!pythonReadme.includes("nox.workspace.list_nox_services()")) fail("Python README does not use a real generated operation");
if (typeScriptReadme.includes("nox.incidents.getProjectIncidents") || pythonReadme.includes("nox.incidents.get_project_incidents")) {
  fail("SDK README uses a user-session-only incident operation with an automation token");
}
visitOpenApiProse(openapi);

console.log("Public developer documentation uses the consolidated NoxHere product vocabulary.");

function visitOpenApiProse(value, location = "openapi") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if ((key === "summary" || key === "description") && typeof child === "string") {
      const prose = child.replaceAll(/NoxSpot\.(?:identify|init)/g, "compatibility-widget-method");
      if (/NoxConnect is the (?:public|customer-facing) product/.test(prose)) {
        fail(`${childLocation} presents Connect as a separate product`);
      }
      continue;
    }
    visitOpenApiProse(child, childLocation);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
