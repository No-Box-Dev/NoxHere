export type ServiceId = "connect" | "ticket" | "feed" | "spot" | "cue" | "mail" | "key";

export type ServiceDefinition = {
  id: ServiceId;
  name: string;
  shortName: string;
  color: string;
  softColor: string;
  defaultView: string;
  ownership: string;
  iconSrc?: string;
  hidden?: boolean;
};

export const services: readonly ServiceDefinition[] = [
  { id: "ticket", name: "Planning", shortName: "Plan", color: "#4d6cc8", softColor: "#edf1fb", defaultView: "board", ownership: "Tasks, features and delivery workflow", iconSrc: "/icons/noxticket.svg" },
  { id: "feed", name: "Activity", shortName: "Activity", color: "#e46f6d", softColor: "#fff0ef", defaultView: "current", ownership: "Engineering activity, pull requests, issues and releases", iconSrc: "/icons/noxfeed.svg" },
  { id: "spot", name: "Feedback", shortName: "Feedback", color: "#bc6a38", softColor: "#fbf0e9", defaultView: "issues", ownership: "Customer feedback, widgets and resolution messaging", iconSrc: "/icons/noxspot.svg" },
  { id: "cue", name: "Incidents", shortName: "Incidents", color: "#6d5cc8", softColor: "#f1eef9", defaultView: "stats", ownership: "Product health, events, incidents and alert rules" },
  { id: "mail", name: "NoxMail", shortName: "Mail", color: "#267365", softColor: "#e9f4f0", defaultView: "messages", ownership: "Product and operational messaging", hidden: true },
  { id: "key", name: "NoxKey", shortName: "Key", color: "#8b6a37", softColor: "#f7f0e5", defaultView: "vault", ownership: "Credentials and secrets", iconSrc: "/icons/noxkey.svg" },
  { id: "connect", name: "NoxConnect", shortName: "Connect", color: "#5e5a55", softColor: "#efedeb", defaultView: "overview", ownership: "Project connections, people, repositories and service capabilities", iconSrc: "/icons/noxconnect.svg" },
];

export const serviceById = new Map(services.map((service) => [service.id, service]));
