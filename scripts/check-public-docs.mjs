import { readFile } from "node:fs/promises";

const publicDocs = [
  "public/developers.html",
  "public/docs/ai-setup.md",
  "public/llms.txt",
];
for (const path of publicDocs) {
  const content = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  if (!content.includes("NoxHere")) fail(`${path} does not identify NoxHere as the product`);
  if (/NoxConnect is the (?:public|customer-facing) product/.test(content)) {
    fail(`${path} still presents Connect as a separate product`);
  }
}

const openapi = JSON.parse(await readFile(new URL("../public/openapi.json", import.meta.url), "utf8"));
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
