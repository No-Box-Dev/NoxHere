import { describe, expect, it } from "vitest";
import { attachmentContentType, safeAttachmentFilename } from "../attachment-policy";

const types = { ".png": "image/png", ".pdf": "application/pdf" } as const;

describe("attachment policy", () => {
  it("normalizes paths and matches extensions without changing the display name", () => {
    expect(safeAttachmentFilename(" folder/Design.PNG ", types)).toBe("Design.PNG");
    expect(attachmentContentType("Design.PNG", types)).toBe("image/png");
  });

  it("rejects unsupported extensions and control characters", () => {
    expect(safeAttachmentFilename("payload.exe", types)).toBeNull();
    expect(safeAttachmentFilename("bad\u0000name.pdf", types)).toBeNull();
  });
});
