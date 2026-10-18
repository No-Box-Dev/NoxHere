import { describe, expect, it } from "vitest";
import {
  buildDailyDigestResponse,
  buildIssueResponse,
  buildSlackResponse,
  buildTestResponse,
} from "../response";

const capture = {
  captureId: "capture-1",
  siteId: "site-1",
  siteName: "Playnist",
  issueType: "bug",
  title: "Broken button",
  description: "The button does nothing.",
  metadata: { url: "https://app.playnist.com/library" },
};

describe("Feedback response service contract", () => {
  it("renders an idempotent GitHub issue", () => {
    const response = buildIssueResponse({
      ...capture,
      screenshotAssetId: "asset_0123456789abcdef0123456789abcdef",
      screenshotUrl: "https://app.noxhere.com/api/v1/feedback/assets/asset_0123456789abcdef0123456789abcdef",
    });
    expect(response).toMatchObject({ contract: "feedback.response", version: 1 });
    expect(response.issue.body).toContain("<!-- feedback:capture-1 -->");
    expect(response.issue.body).toContain("<!-- feedback-evidence:asset_0123456789abcdef0123456789abcdef -->");
    expect(response.issue.body).toContain("AI agents:");
    expect(response.issue.body).not.toContain("![Feedback capture]");
  });

  it("renders a Slack message with the issue and reported page", () => {
    const screenshotPreviewUrl = "https://capture.example.com/api/feedback/public/v1/assets/slack-preview/asset_0123456789abcdef0123456789abcdef/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const screenshotUrl = "https://app.noxhere.com/api/v1/feedback/assets/asset_0123456789abcdef0123456789abcdef?org=acme";
    const response = buildSlackResponse({ ...capture, screenshotPreviewUrl, screenshotUrl }, { url: "https://github.com/No-Box-Dev/playnist/issues/1" });
    expect(response).toMatchObject({ contract: "feedback.response", version: 1 });
    expect(response.message.client_msg_id).toBe("capture-1");
    expect(JSON.stringify(response.message.blocks)).toContain("https://app.playnist.com/library");
    expect(response.message.blocks).toContainEqual({
      type: "image",
      image_url: screenshotPreviewUrl,
      alt_text: "Feedback issue screenshot",
    });
    expect(response.message.blocks).toContainEqual(expect.objectContaining({
      type: "actions",
      elements: expect.arrayContaining([expect.objectContaining({ url: screenshotUrl })]),
    }));
  });

  it("keeps test and digest renderers available to NoxHere", () => {
    expect(buildTestResponse("No-Box-Dev").message.text).toContain("No-Box-Dev");
    const digest = buildDailyDigestResponse("Playnist", "2026-09-02", [], [], { filed: 0, solved: 0 });
    expect(digest.message.text).toContain("0 filed, 0 solved");
  });
});
