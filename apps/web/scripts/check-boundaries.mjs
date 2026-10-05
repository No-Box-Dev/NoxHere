import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve("src/features");
const sourceExtensions = new Set([".ts", ".tsx"]);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : sourceExtensions.has(extname(path)) ? [path] : [];
  }));
  return nested.flat();
}

const files = await filesIn(root);
const violations = [];
const importPattern = /(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;

for (const file of files) {
  const owner = relative(root, file).split(sep)[0];
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const resolved = resolve(file, "..", specifier);
    const featureRelative = relative(root, resolved);
    if (featureRelative.startsWith("..")) continue;
    const importedOwner = featureRelative.split(sep)[0];
    if (importedOwner !== owner) violations.push(`${relative(process.cwd(), file)} imports ${specifier} from ${importedOwner}`);
  }
}

if (violations.length) {
  console.error("Cross-service feature imports are not allowed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Service boundaries valid across ${files.length} source files.`);
}
