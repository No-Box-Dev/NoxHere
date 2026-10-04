#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const baseRef = process.argv[2];
if (!baseRef || !/^[A-Za-z0-9._/-]+$/.test(baseRef)) {
  console.error("Usage: node scripts/check-migration-immutability.mjs <base-ref>");
  process.exitCode = 2;
} else {
  const remoteBase = baseRef.startsWith("origin/") ? baseRef : `origin/${baseRef}`;
  const result = spawnSync("git", ["diff", "--name-status", `${remoteBase}...HEAD`, "--", "migrations/*.sql"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "Unable to compare migrations\n");
    process.exitCode = result.status ?? 1;
  } else {
    const changedReleased = result.stdout.trim().split("\n").filter(Boolean).filter((line) => !line.startsWith("A\t"));
    if (changedReleased.length) {
      console.error(`Released migrations are immutable:\n${changedReleased.join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log("Migration immutability check passed.");
    }
  }
}
