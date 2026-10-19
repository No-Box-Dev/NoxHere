export const FEEDBACK_LAUNCHER_STYLES = ["tab", "button"] as const;
export const FEEDBACK_LAUNCHER_POSITIONS = [
  "top-left",
  "center-left",
  "bottom-left",
  "top-right",
  "center-right",
  "bottom-right",
] as const;

export type FeedbackLauncherStyle = typeof FEEDBACK_LAUNCHER_STYLES[number];
export type FeedbackLauncherPosition = typeof FEEDBACK_LAUNCHER_POSITIONS[number];

export interface FeedbackLauncherViewportConfig {
  style: FeedbackLauncherStyle;
  position: FeedbackLauncherPosition;
}

export interface FeedbackLauncherConfig {
  desktop: FeedbackLauncherViewportConfig;
  mobile: FeedbackLauncherViewportConfig;
}

export const DEFAULT_FEEDBACK_LAUNCHER: FeedbackLauncherConfig = {
  desktop: { style: "tab", position: "center-right" },
  mobile: { style: "button", position: "bottom-right" },
};

export function normalizeFeedbackLauncher(value: unknown): FeedbackLauncherConfig {
  const launcher = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    desktop: normalizeViewport(launcher.desktop, DEFAULT_FEEDBACK_LAUNCHER.desktop),
    mobile: normalizeViewport(launcher.mobile, DEFAULT_FEEDBACK_LAUNCHER.mobile),
  };
}

function normalizeViewport(value: unknown, fallback: FeedbackLauncherViewportConfig): FeedbackLauncherViewportConfig {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    style: FEEDBACK_LAUNCHER_STYLES.includes(candidate.style as FeedbackLauncherStyle)
      ? candidate.style as FeedbackLauncherStyle
      : fallback.style,
    position: FEEDBACK_LAUNCHER_POSITIONS.includes(candidate.position as FeedbackLauncherPosition)
      ? candidate.position as FeedbackLauncherPosition
      : fallback.position,
  };
}
