import { Navigate, useParams } from "react-router-dom";
import { GrowthView } from "./GrowthView";

export default function GrowthPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  if (section !== "overview" && section !== "funnel" && section !== "events") {
    return <Navigate replace to={`/${organizationId}/${projectId}/growth/overview`} />;
  }
  return <section className="cue-page growth-page"><GrowthView organizationId={organizationId} projectId={projectId} view={section} /></section>;
}
