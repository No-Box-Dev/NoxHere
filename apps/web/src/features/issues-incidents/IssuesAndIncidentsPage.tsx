import { Link, Navigate, useParams } from "react-router-dom";
import { ServiceTabs } from "../../components/ServiceTabs";
import { IncidentsView } from "./IncidentsView";
import { IssuesView } from "./IssuesView";

const tabs = [["repository", "Repository"], ["incidents", "Incidents"], ["alerts", "Alerts"]] as const;

export default function IssuesAndIncidentsPage() {
  const { organizationId = "", projectId = "", section = "repository" } = useParams();
  const base = `/${organizationId}/${projectId}/issues`;
  if (section !== "repository" && section !== "incidents" && section !== "alerts") return <Navigate replace to={`${base}/repository`} />;
  if (section === "alerts") return <Navigate replace to={`/${organizationId}/${projectId}/settings/alert-rules`} />;
  return <section className="cue-page incidents-page">
    <ServiceTabs base={base} active={section} tabs={tabs} actions={<Link className="button compact-button" to={`/${organizationId}/${projectId}/settings/alert-rules`}>Manage alert rules</Link>} />
    {section === "repository" ? <IssuesView organizationId={organizationId} projectId={projectId} /> : <IncidentsView organizationId={organizationId} projectId={projectId} view="alerts" />}
  </section>;
}
