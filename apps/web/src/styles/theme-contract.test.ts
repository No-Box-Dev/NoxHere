/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import globalCss from "./global.css?raw";
import themeCss from "./nox-theme.css?raw";

describe("application theme contract", () => {
  it("keeps application surfaces free of light-only background literals", () => {
    const lightSurface = /background(?:-color)?:[^;]*(?:#fff(?:fff)?|#f[0-9a-f]{5}|white\b|rgb\(255|rgba\(255)/i;
    const offenders = globalCss
      .split("\n")
      .filter((line) => lightSurface.test(line))
      .filter((line) => !line.trimStart().startsWith("--"))
      // Embedded documents own their canvas rather than inheriting app chrome.
      .filter((line) => !line.includes(".attachment-viewer > iframe"));

    expect(offenders).toEqual([]);
  });

  it("defines shared surface and control roles for both appearances", () => {
    expect(themeCss.match(/--card:/g)).toHaveLength(2);
    expect(themeCss.match(/--popover:/g)).toHaveLength(2);
    expect(themeCss.match(/--control-handle:/g)).toHaveLength(2);
    expect(themeCss.match(/--code-surface:/g)).toHaveLength(2);
  });

  it("keeps searchable selects aligned with the application control system", () => {
    expect(globalCss).toContain(".searchable-select > input { width: 100%; height: 38px;");
    expect(globalCss).toContain(".searchable-select > input:focus { border-color: var(--foreground); box-shadow: none; }");
    expect(globalCss).toContain(".searchable-select-toggle svg");
  });
});
