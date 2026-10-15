export type ServiceId = "connections" | "planning" | "activity" | "feedback" | "stats" | "incidents" | "mail" | "key";

export type ServiceDefinition = {
  id: ServiceId;
  name: string;
  shortName: string;
  color: string;
  softColor: string;
  defaultView: string;
  ownership: string;
  iconSrc?: string;
  externalHref?: string;
  hidden?: boolean;
};

export const services: readonly ServiceDefinition[] = [
  { id: "planning", name: "Planning", shortName: "Plan", color: "#201e1d", softColor: "#ece7de", defaultView: "board", ownership: "Tasks, features and delivery workflow", iconSrc: "/icons/planning.svg" },
  { id: "activity", name: "Activity", shortName: "Activity", color: "#201e1d", softColor: "#ece7de", defaultView: "current", ownership: "Engineering activity, pull requests and releases", iconSrc: "/icons/activity.svg" },
  { id: "feedback", name: "Feedback", shortName: "Feedback", color: "#201e1d", softColor: "#ece7de", defaultView: "issues", ownership: "Customer feedback, widgets and resolution messaging", iconSrc: "/icons/feedback.svg" },
  { id: "stats", name: "Stats", shortName: "Stats", color: "#201e1d", softColor: "#ece7de", defaultView: "overview", ownership: "Product metrics, stat events, telemetry sources and report cards" },
  { id: "incidents", name: "Issues and Incidents", shortName: "Issues", color: "#201e1d", softColor: "#ece7de", defaultView: "issues", ownership: "Repository issues, product health incidents and alert rules" },
  { id: "mail", name: "NoxMail", shortName: "Mail", color: "#201e1d", softColor: "#ece7de", defaultView: "messages", ownership: "Product and operational messaging", hidden: true },
  { id: "key", name: "NoxKey", shortName: "Key", color: "#201e1d", softColor: "#ece7de", defaultView: "vault", ownership: "Credentials and secrets in the NoxKey app", iconSrc: "/icons/noxkey.svg", externalHref: "https://apps.apple.com/app/noxkey/id6760210699" },
  { id: "connections", name: "Connections", shortName: "Connect", color: "#201e1d", softColor: "#ece7de", defaultView: "overview", ownership: "Project connections, people, repositories and service capabilities", iconSrc: "/icons/noxhere.svg" },
];

export const serviceById: ReadonlyMap<string, ServiceDefinition> = new Map(
  services.map((service) => [service.id, service] as const),
);
