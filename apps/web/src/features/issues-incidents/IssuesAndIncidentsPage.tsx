import { useParams } from "react-router-dom";
import { ServiceTabs } from "../../components/ServiceTabs";
import { IncidentsView } from "./IncidentsView";
import { IssuesView } from "./IssuesView";

const tabs = [["issues", "Issues"], ["alerts", "Incidents"], ["rules", "Rules"]] as const;

export default function IssuesAndIncidentsPage() {
  const { organizationId = "", projectId = "", section = "issues" } = useParams();
  const base = `/${organizationId}/${projectId}/incidents`;
  return <section className="cue-page incidents-page">
    <ServiceTabs base={base} active={section} tabs={tabs} />
    {section === "issues" ? <IssuesView organizationId={organizationId} projectId={projectId} /> : <IncidentsView organizationId={organizationId} projectId={projectId} view={section === "rules" ? "rules" : "alerts"} />}
  </section>;
}
