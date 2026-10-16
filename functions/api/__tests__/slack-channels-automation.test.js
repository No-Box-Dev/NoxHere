import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/slack.js", () => ({
  resolveSlackInstall: vi.fn(async () => ({ id: "conn-1", botToken: "redacted" })),
  listSlackChannels: vi.fn(async () => [{ id: "C123456", name: "nox-acceptance" }]),
  actionableSlackError: vi.fn(),
}));

import { onRequestGet } from "../slack/channels.js";

describe("Slack channel automation authorization", () => {
  it("allows a project automation token carrying Slack management scope", async () => {
    const response = await onRequestGet({
      request: new Request("https://app.noxhere.com/api/v1/slack/channels?connectionId=conn-1"),
      data: { orgId: 7, isAdmin: false, credentialType: "api_token", scopes: ["slack:read"] },
      env: { DB: {} },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      connectionId: "conn-1",
      channels: [{ id: "C123456", name: "nox-acceptance" }],
    });
  });

  it("keeps ordinary non-admin sessions out", async () => {
    const response = await onRequestGet({
      request: new Request("https://app.noxhere.com/api/v1/slack/channels?connectionId=conn-1"),
      data: { orgId: 7, isAdmin: false, credentialType: "session", scopes: [] },
      env: { DB: {} },
    });
    expect(response.status).toBe(403);
  });
});
