export type ServiceId = "dashboard" | "connections" | "planning" | "activity" | "feedback" | "growth" | "usage" | "issues" | "mail" | "key";

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
  { id: "dashboard", name: "Dashboard", shortName: "Dashboard", color: "#201e1d", softColor: "#ece7de", defaultView: "overview", ownership: "Team delivery, contribution and workload overview" },
  { id: "planning", name: "Planning", shortName: "Plan", color: "#201e1d", softColor: "#ece7de", defaultView: "board", ownership: "Tasks, features and delivery workflow", iconSrc: "/icons/planning.svg" },
  { id: "activity", name: "Delivery", shortName: "Delivery", color: "#201e1d", softColor: "#ece7de", defaultView: "current", ownership: "Engineering activity, pull requests and releases", iconSrc: "/icons/activity.svg" },
  { id: "feedback", name: "Feedback", shortName: "Feedback", color: "#201e1d", softColor: "#ece7de", defaultView: "issues", ownership: "Customer feedback, widgets and resolution messaging", iconSrc: "/icons/feedback.svg" },
  { id: "growth", name: "Growth", shortName: "Growth", color: "#201e1d", softColor: "#ece7de", defaultView: "overview", ownership: "Acquisition, trials, conversion and cancellation" },
  { id: "usage", name: "Usage", shortName: "Usage", color: "#201e1d", softColor: "#ece7de", defaultView: "overview", ownership: "Users, product adoption and engagement" },
  { id: "issues", name: "Incidents", shortName: "Incidents", color: "#201e1d", softColor: "#ece7de", defaultView: "incidents", ownership: "Repository issues, runtime incidents and alert rules" },
  { id: "mail", name: "NoxMail", shortName: "Mail", color: "#201e1d", softColor: "#ece7de", defaultView: "messages", ownership: "Product and operational messaging", hidden: true },
  { id: "key", name: "NoxKey", shortName: "Key", color: "#201e1d", softColor: "#ece7de", defaultView: "vault", ownership: "Credentials and secrets in the NoxKey app", iconSrc: "/icons/noxkey.svg", externalHref: "https://apps.apple.com/app/noxkey/id6760210699" },
  { id: "connections", hidden: true, name: "Connections", shortName: "Connect", color: "#201e1d", softColor: "#ece7de", defaultView: "overview", ownership: "Project connections, people, repositories and service capabilities", iconSrc: "/icons/noxhere.svg" },
];

export const serviceById: ReadonlyMap<string, ServiceDefinition> = new Map(
  services.map((service) => [service.id, service] as const),
);

export function canAccessService(serviceId: ServiceId, allowedServiceIds: readonly string[]) {
  return allowedServiceIds.includes(serviceId === "dashboard" ? "activity" : serviceId);
}

