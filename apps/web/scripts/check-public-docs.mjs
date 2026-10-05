import { readFile } from "node:fs/promises";

const publicDocs = ["public/developers.html", "public/docs/ai-setup.md", "public/llms.txt"];
const retiredPublicNames = /\b(?:NoxHere|NoxTicket|NoxFeed|NoxCue)\b/g;

for (const path of publicDocs) {
  const content = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const matches = [...content.matchAll(retiredPublicNames)];
  if (matches.length) {
    fail(`${path} contains retired public product names: ${[...new Set(matches.map(({ 0: name }) => name))].join(", ")}`);
  }
  for (const [index, line] of content.split("\n").entries()) {
    if (/\bNoxSpot\b/.test(line) && !/(?:compatibility|NoxSpot\.(?:identify|init))/.test(line)) {
      fail(`${path}:${index + 1} presents NoxSpot as a product instead of a compatibility JavaScript global`);
    }
  }
}

const openapi = JSON.parse(await readFile(new URL("../public/openapi.json", import.meta.url), "utf8"));
visitOpenApiProse(openapi);
console.log("Deployed developer documentation uses the consolidated NoxConnect product vocabulary.");

function visitOpenApiProse(value, location = "openapi") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if ((key === "summary" || key === "description") && typeof child === "string") {
      const prose = child.replaceAll(/NoxSpot\.(?:identify|init)/g, "compatibility-widget-method");
      const retired = prose.match(/\b(?:NoxHere|NoxTicket|NoxFeed|NoxCue|NoxSpot)\b/);
      if (retired) fail(`${childLocation} contains retired public product name ${retired[0]}`);
      continue;
    }
    visitOpenApiProse(child, childLocation);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
