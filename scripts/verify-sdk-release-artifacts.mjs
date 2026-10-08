import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/publish-sdk.yml", import.meta.url), "utf8");
for (const fragment of [
  "npm publish --access public --provenance",
  "pypa/gh-action-pypi-publish",
  "sha256sum * > SHA256SUMS",
  "actions/attest-build-provenance@v3",
  "gh release create",
]) {
  if (!workflow.includes(fragment)) throw new Error(`SDK release workflow is missing: ${fragment}`);
}
console.log("SDK release checksums, trusted publishing, provenance and release assets verified.");
