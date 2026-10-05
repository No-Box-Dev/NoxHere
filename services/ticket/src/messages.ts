const MAX_BYTES = 64_000;
const escape = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function url(value: unknown) {
  if (typeof value !== "string") return null;
  try { const parsed = new URL(value.trim()); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString().slice(0, 3000) : null; }
  catch { return null; }
}

function bounded<T extends { text: string; blocks: unknown[] }>(message: T): T {
  if (!message.text || !Array.isArray(message.blocks) || new TextEncoder().encode(JSON.stringify(message)).byteLength > MAX_BYTES) throw new Error("Invalid NoxTicket Slack message");
  return message;
}

export function activityMessage(input: { orgId: number; repo: string; action: string; issue: { number?: number; title?: string; html_url?: string }; actor?: string }) {
  const number = Number(input.issue?.number);
  if (!Number.isSafeInteger(input.orgId) || input.orgId < 1 || !input.repo || !input.action || !Number.isSafeInteger(number) || number < 1) throw new Error("Invalid NoxTicket activity message input");
  const issueUrl = url(input.issue.html_url);
  return bounded({
    text: `NoxTicket ${input.action}: ${input.issue.title}`,
    client_msg_id: `noxticket-${input.orgId}-${input.repo}-${number}-${input.action}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*Ticket ${escape(input.action)}*${input.actor ? ` by *${escape(input.actor)}*` : ""}\n${escape(input.issue.title || `Issue #${number}`)}\n\`${escape(input.repo)}#${number}\`` } },
      ...(issueUrl ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open ticket" }, url: issueUrl }] }] : []),
    ],
  });
}

export function featureAddedMessage(input: { orgId: number; projectId: string; feature: { number?: number; title?: string; description?: string; backlog?: boolean }; actor: string }) {
  const number = Number(input.feature?.number);
  const title = input.feature?.title?.trim();
  const actor = input.actor?.trim();
  if (!Number.isSafeInteger(input.orgId) || input.orgId < 1 || !input.projectId?.trim() || !Number.isSafeInteger(number) || number < 1 || !title || !actor) {
    throw new Error("Invalid NoxTicket feature-added message input");
  }
  const destination = input.feature.backlog ? "Backlog" : "Features";
  const line = `*Feature #${number} · ${escape(title)}* — ${destination} · added by ${escape(actor)}`;
  return bounded({
    text: `New NoxTicket feature in ${destination}: ${title}`,
    client_msg_id: `noxticket-${input.orgId}-${input.projectId}-${number}-created`,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: line } }],
  });
}

export function testMessage(orgLogin: string) {
  if (!orgLogin?.trim() || orgLogin.length > 200) throw new Error("Invalid NoxTicket org login");
  return bounded({ text: `NoxTicket delivery test for ${orgLogin}`, blocks: [{ type: "section", text: { type: "mrkdwn", text: `*NoxTicket — tickets and activity test*\nOrg: \`${escape(orgLogin)}\`` } }] });
}
