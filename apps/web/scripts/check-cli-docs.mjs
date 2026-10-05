import { readFile } from "node:fs/promises";

// Mirrors the public noxconnect package catalog because this compatibility gateway
// currently serves the deployed developer portal.
const commands = [
  ["login", "login [--no-open]"],
  ["logout", "logout"],
  ["whoami", "whoami"],
  ["use", "use <organization>[/<project>]"],
  ["projects", "projects"],
  ["activity", "activity"],
  ["incidents", "incidents [resolve|acknowledge|reopen] [incident-id]"],
  ["issues", "issues"],
  ["feedback", "feedback"],
  ["api", "api <path> [-X METHOD] [-d JSON]"],
  ["help", "help"],
];

const html = await readFile(new URL("../public/developers.html", import.meta.url), "utf8");
const table = html.match(/<table id="cli-command-reference">([\s\S]*?)<\/table>/)?.[1];
if (!table) fail("public/developers.html is missing #cli-command-reference");

const documented = [...table.matchAll(/data-cli-command="([^"]+)"/g)].map((match) => match[1]);
const expected = commands.map(([name]) => name);
if (JSON.stringify(documented) !== JSON.stringify(expected)) {
  fail(`CLI command drift: expected ${expected.join(", ")}; documented ${documented.join(", ")}`);
}

const text = table
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&amp;", "&")
  .replace(/\s+/g, " ");
for (const [, usage] of commands) {
  if (!text.includes(`noxconnect ${usage}`)) fail(`Developer docs are missing exact CLI usage: noxconnect ${usage}`);
}

console.log(`Deployed developer docs cover all ${commands.length} NoxConnect CLI commands.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
