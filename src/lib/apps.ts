import type { TabId } from "./types";

export type OptionalNoxAppId = "noxticket" | "noxfeed" | "noxspot" | "noxcue";
export type NoxAppId = "noxconnect" | OptionalNoxAppId;

export interface NoxAppDefinition {
  id: NoxAppId;
  name: string;
  shortName: string;
  description: string;
  includes: string;
  tabs: readonly { id: TabId; label: string }[];
  defaultTab: TabId;
}

export const OPTIONAL_NOX_APP_IDS: readonly OptionalNoxAppId[] = [
  "noxticket",
  "noxfeed",
  "noxspot",
  "noxcue",
];

export const ADMIN_INTRO = "Configure the connections and settings shared by every NoxConnect capability.";

export const NOX_APPS: readonly NoxAppDefinition[] = [
  {
    id: "noxconnect",
    name: "NoxConnect",
    shortName: "Connect",
    description: "Your shared workspace for every NoxConnect capability.",
    includes: "GitHub and Slack links, people, and shared setup",
    tabs: [{ id: "admin", label: "Admin" }],
    defaultTab: "admin",
  },
  {
    id: "noxticket",
    name: "Planning",
    shortName: "Planning",
    description: "Plan work and keep GitHub as the source of truth.",
    includes: "Features, backlog, board stages, and specs",
    tabs: [
      { id: "sprint", label: "Features" },
      { id: "specs", label: "Specs" },
    ],
    defaultTab: "sprint",
  },
  {
    id: "noxfeed",
    name: "Activity",
    shortName: "Activity",
    description: "See your GitHub work in one place.",
    includes: "Current work, team feed, and issues",
    tabs: [
      { id: "current", label: "Current" },
      { id: "posts", label: "Feed" },
      { id: "issues", label: "Issues" },
    ],
    defaultTab: "issues",
  },
  {
    id: "noxspot",
    name: "Feedback",
    shortName: "Feedback",
    description: "Get site feedback with the facts you need to fix it.",
    includes: "Issues, widgets, and site delivery rules",
    tabs: [],
    defaultTab: "admin",
  },
  {
    id: "noxcue",
    name: "Incidents",
    shortName: "Incidents",
    description: "Know how your app did today.",
    includes: "Daily user metrics, project controls, history, keys, and Slack delivery",
    tabs: [],
    defaultTab: "admin",
  },
] as const;

const APP_BY_ID = new Map(NOX_APPS.map((app) => [app.id, app]));
const APP_BY_TAB = new Map(
  NOX_APPS.flatMap((app) => app.tabs.map((tab) => [tab.id, app.id] as const)),
);

export function getNoxApp(id: NoxAppId): NoxAppDefinition {
  return APP_BY_ID.get(id)!;
}

export function getAppForTab(tab: TabId): NoxAppId | null {
  // `repos` is retained as a navigation alias for old links and command
  // palette shortcuts; the view now lives under Nox's Admin area.
  if (tab === "repos") return "noxconnect";
  if (tab === "prs" || tab === "engineers") return "noxfeed";
  return APP_BY_TAB.get(tab) ?? null;
}

export const ALL_NOX_APP_IDS: readonly NoxAppId[] = NOX_APPS.map((app) => app.id);

export function isTabEnabled(tab: TabId, enabledApps: readonly NoxAppId[]): boolean {
  const appId = getAppForTab(tab);
  return appId !== null && enabledApps.includes(appId);
}

export function getDefaultEnabledTab(enabledApps: readonly NoxAppId[]): TabId {
  return enabledApps.includes("noxfeed") ? getNoxApp("noxfeed").defaultTab : "admin";
}
