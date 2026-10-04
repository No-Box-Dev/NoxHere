import assert from "node:assert/strict";
import test from "node:test";
import { CLI_COMMANDS, commandHelpLines } from "../lib/commands.mjs";

test("the command catalog has unique names and complete help", () => {
  assert.equal(new Set(CLI_COMMANDS.map(({ name }) => name)).size, CLI_COMMANDS.length);
  const help = commandHelpLines().join("\n");
  for (const command of CLI_COMMANDS) {
    assert.match(help, new RegExp(`noxconnect ${command.name}(?:\\s|$)`));
    assert.ok(command.description.endsWith("."));
  }
});
