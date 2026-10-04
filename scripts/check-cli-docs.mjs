import { readFile } from "node:fs/promises";
import { CLI_COMMANDS } from "../apps/cli/lib/commands.mjs";

const html = await readFile(new URL("../public/developers.html", import.meta.url), "utf8");
const table = html.match(/<table id="cli-command-reference">([\s\S]*?)<\/table>/)?.[1];
if (!table) fail("public/developers.html is missing #cli-command-reference");

const documented = [...table.matchAll(/data-cli-command="([^"]+)"/g)].map((match) => match[1]);
const expected = CLI_COMMANDS.map(({ name }) => name);
if (JSON.stringify(documented) !== JSON.stringify(expected)) {
  fail(`CLI command drift: expected ${expected.join(", ")}; documented ${documented.join(", ")}`);
}

const text = table
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&amp;", "&")
  .replace(/\s+/g, " ");
for (const { usage } of CLI_COMMANDS) {
  if (!text.includes(`noxconnect ${usage}`)) fail(`Developer docs are missing exact CLI usage: noxconnect ${usage}`);
}

console.log(`Developer docs cover all ${CLI_COMMANDS.length} NoxConnect CLI commands.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
