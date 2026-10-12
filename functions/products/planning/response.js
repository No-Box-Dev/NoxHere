const MAX_SLACK_PAYLOAD_BYTES = 64_000;

export function buildPlanningActivityResponse({ orgId, repo, action, issue, actor }) {
  const issueNumber = Number(issue?.number);
  if (!Number.isSafeInteger(orgId) || orgId < 1 || !repo || !action || !Number.isSafeInteger(issueNumber) || issueNumber < 1) {
    throw new Error("Invalid Planning activity response input");
  }
  const issueUrl = safeHttpUrl(issue.html_url);
  const message = {
    text: `Planning ${action}: ${issue.title}`,
    client_msg_id: `planning-${orgId}-${repo}-${issueNumber}-${action}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*Ticket ${escapeMrkdwn(action)}*${actor ? ` by *${escapeMrkdwn(actor)}*` : ""}\n${escapeMrkdwn(issue.title || `Issue #${issueNumber}`)}\n\`${escapeMrkdwn(repo)}#${issueNumber}\`` } },
      ...(issueUrl ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open ticket" }, url: issueUrl }] }] : []),
    ],
  };
  requireSlackMessage(message);
  return { message };
}

export function buildPlanningFeatureAddedResponse({ orgId, projectId, feature, actor }) {
  const number = Number(feature?.number);
  const title = String(feature?.title ?? "").trim();
  const addedBy = String(actor ?? "").trim();
  if (!Number.isSafeInteger(orgId) || orgId < 1 || !projectId || !Number.isSafeInteger(number) || number < 1 || !title || !addedBy) {
    throw new Error("Invalid Planning feature-added response input");
  }
  const destination = feature.backlog ? "Backlog" : "Features";
  const line = `*Feature #${number} · ${escapeMrkdwn(title)}* — ${destination} · added by ${escapeMrkdwn(addedBy)}`;
  const message = {
    text: `New Planning feature in ${destination}: ${title}`,
    client_msg_id: `planning-${orgId}-${projectId}-${number}-created`,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: line } }],
  };
  requireSlackMessage(message);
  return { message };
}

export function buildPlanningTestResponse(orgLogin) {
  if (typeof orgLogin !== "string" || !orgLogin.trim() || orgLogin.length > 200) {
    throw new Error("Invalid Planning org login");
  }
  return {
    message: {
      text: `Planning delivery test for ${orgLogin}`,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Planning — tickets and activity test*\nOrg: \`${escapeMrkdwn(orgLogin)}\`` } }],
    },
  };
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 3000) : null;
  } catch { return null; }
}

function requireSlackMessage(message) {
  const bytes = new TextEncoder().encode(JSON.stringify(message)).byteLength;
  if (!message.text || !Array.isArray(message.blocks) || bytes > MAX_SLACK_PAYLOAD_BYTES) {
    throw new Error("Invalid Planning Slack message");
  }
}

function escapeMrkdwn(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
