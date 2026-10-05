import { describe, expect, it } from "vitest";
import { featureAddedMessage } from "../messages";

describe("NoxTicket Slack messages", () => {
  it("renders a new backlog feature as one compact line", () => {
    const message = featureAddedMessage({
      orgId: 7,
      projectId: "project-playnist",
      actor: "jasper",
      feature: { number: 12, title: "Share playlists", description: "Let listeners share a public playlist.", backlog: true },
    });
    expect(message.text).toBe("New NoxTicket feature in Backlog: Share playlists");
    expect(message.blocks).toEqual([{ type: "section", text: { type: "mrkdwn", text: "*Feature #12 · Share playlists* — Backlog · added by jasper" } }]);
  });

  it("labels a non-backlog item as Features and escapes Slack markup", () => {
    const message = featureAddedMessage({
      orgId: 7,
      projectId: "project-playnist",
      actor: "jasper",
      feature: { number: 13, title: "Filters <beta>", description: "Use A & B", backlog: false },
    });
    expect(message.blocks).toEqual([{ type: "section", text: { type: "mrkdwn", text: "*Feature #13 · Filters &lt;beta&gt;* — Features · added by jasper" } }]);
  });
});
