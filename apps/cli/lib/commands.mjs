export const CLI_COMMANDS = Object.freeze([
  { name: "login", usage: "login [--no-open] [--create-key --project NAME]", description: "Sign in through GitHub and optionally create a project write key." },
  { name: "logout", usage: "logout", description: "Revoke the shared NoxHere session." },
  { name: "whoami", usage: "whoami", description: "Show the account and active organization/project context." },
  { name: "use", usage: "use <organization>[/<project>]", description: "Change context without signing in again." },
  { name: "projects", usage: "projects", description: "List projects in the active organization." },
  { name: "keys", usage: "keys <list|create|rotate|revoke> [options]", description: "Manage project-scoped server keys with a human session." },
  { name: "activity", usage: "activity", description: "Read activity for the active project." },
  { name: "incidents", usage: "incidents [resolve|acknowledge|reopen] [incident-id]", description: "Read incidents or change one incident by its fixed ID." },
  { name: "issues", usage: "issues", description: "Read issues for the active project." },
  { name: "feedback", usage: "feedback", description: "Read feedback for the active project." },
  { name: "api", usage: "api <path> [-X METHOD] [-d JSON]", description: "Call any NoxHere API with the active session." },
  { name: "help", usage: "help", description: "Show commands, environment variables, and credential storage." },
]);

export function commandHelpLines() {
  const usages = CLI_COMMANDS.map(({ usage }) => `noxhere ${usage}`);
  const width = Math.max(...usages.map((usage) => usage.length)) + 2;
  return CLI_COMMANDS.map((command, index) => `${usages[index].padEnd(width)}${command.description}`);
}
