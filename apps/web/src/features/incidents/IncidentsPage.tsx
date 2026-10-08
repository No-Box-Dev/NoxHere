import { useParams } from "react-router-dom";
import { IncidentsView } from "./IncidentsView";

export default function IncidentsPage() {
  const { organizationId = "", projectId = "" } = useParams();
  return <section className="cue-page incidents-page"><IncidentsView organizationId={organizationId} projectId={projectId} /></section>;
}
