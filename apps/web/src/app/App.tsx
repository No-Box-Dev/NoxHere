import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthBoundary } from "./AuthBoundary";
import { PlatformShell } from "./PlatformShell";

const StatsPage = lazy(() => import("../features/stats/StatsPage"));
const IssuesAndIncidentsPage = lazy(() => import("../features/issues-incidents/IssuesAndIncidentsPage"));
const ConnectionsPage = lazy(() => import("../features/connections/ConnectionsPage"));
const PlanningPage = lazy(() => import("../features/planning/PlanningPage"));
const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const FeedbackPage = lazy(() => import("../features/feedback/FeedbackPage"));
const NoxKeyPage = lazy(() => import("../features/key/NoxKeyPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

export function App() {
  return (
    <AuthBoundary>
      <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>
        <Routes>
          <Route path="/" element={null} />
          <Route path="/:organizationId/select/:service/:view" element={<Navigate replace to="/" />} />
          <Route path="/:organizationId/:projectId" element={<PlatformShell />}>
            <Route path="stats/:section" element={<StatsPage />} />
            <Route path="incidents/:section" element={<IssuesAndIncidentsPage />} />
            <Route path="connections/:view" element={<ConnectionsPage />} />
            <Route path="planning/:view" element={<PlanningPage />} />
            <Route path="activity/issues" element={<LegacyIssuesRoute />} />
            <Route path="activity/:view" element={<ActivityPage />} />
            <Route path="activity/:view/:person" element={<ActivityPage />} />
            <Route path="feedback/:view" element={<FeedbackPage />} />
            <Route path="key/:view" element={<NoxKeyPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
            <Route path="settings/:section/:detail" element={<SettingsPage />} />
            <Route path="*" element={<ProjectFallback />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>
    </AuthBoundary>
  );
}

function LegacyIssuesRoute() {
  const { organizationId = "", projectId = "" } = useParams();
  return <Navigate replace to={`/${encodeURIComponent(organizationId)}/${encodeURIComponent(projectId)}/incidents/issues`} />;
}

function ProjectFallback() {
  const { organizationId = "", projectId = "" } = useParams();
  return <Navigate replace to={`/${encodeURIComponent(organizationId)}/${encodeURIComponent(projectId)}/connections/overview`} />;
}
