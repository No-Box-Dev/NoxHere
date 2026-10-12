import { Link, Navigate, useParams } from "react-router-dom";
import { ServiceTabs } from "../../components/ServiceTabs";
import { IncidentsView } from "./IncidentsView";
import { IssuesView } from "./IssuesView";

const tabs = [["issues", "Issues"], ["alerts", "Incidents"]] as const;

export default function IssuesAndIncidentsPage() {
  const { organizationId = "", projectId = "", section = "issues" } = useParams();
  const base = `/${organizationId}/${projectId}/incidents`;
  if (section === "rules") return <Navigate replace to={`/${organizationId}/${projectId}/settings/alert-rules`} />;
  return <section className="cue-page incidents-page">
    <ServiceTabs base={base} active={section} tabs={tabs} actions={<Link className="button compact-button" to={`/${organizationId}/${projectId}/settings/alert-rules`}>Manage alert rules</Link>} />
    {section === "issues" ? <IssuesView organizationId={organizationId} projectId={projectId} /> : <IncidentsView organizationId={organizationId} projectId={projectId} view="alerts" />}
  </section>;
}
