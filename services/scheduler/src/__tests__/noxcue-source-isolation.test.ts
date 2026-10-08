import { describe, expect, it } from "vitest";
import { resolveDigestSlackDestination, sourceReportTitle } from "../noxcue-digests";

describe("NoxCue report isolation", () => {
  it("uses a source-owned title and destination", () => {
    expect(sourceReportTitle({ name: "N1 App", environment: "production", report_title: "N1 App — Production Stats" }))
      .toBe("N1 App — Production Stats");
    expect(resolveDigestSlackDestination({
      source_channel_id: "production_stats", source_connection_id: "slack-1",
      project_channel_id: "project", project_connection_id: "slack-2",
      organization_channel_id: null, organization_connection_id: null,
      fallback_channel_id: null, fallback_connection_id: null,
    } as never)).toEqual({ channelId: "production_stats", connectionId: "slack-1" });
  });
});
