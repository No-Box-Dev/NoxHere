import { Navigate, useParams } from "react-router-dom";

export default function StatsPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  const destination = section === "productivity"
    ? `/${organizationId}/${projectId}/activity/dashboard`
    : section === "events"
      ? `/${organizationId}/${projectId}/usage/events`
      : `/${organizationId}/${projectId}/usage/overview`;
  return <Navigate replace to={destination} />;
}
