import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import type { GithubMember, ProjectSettings } from "../../api/contracts";
import { platformApi, projectSettingsQueryKey } from "../../api/platform";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";
import { ProjectRepositories } from "../../components/ProjectRepositories";
import { SettingsPageHeader, SettingsSection, SettingsShell } from "../../components/SettingsShell";
import { TelemetrySources } from "../../components/settings/TelemetrySources";
import { NotificationSettings } from "../../components/settings/NotificationSettings";
import { AlertRules } from "../../components/settings/AlertRules";
import { ApiTokens } from "./ApiTokens";
import { Maintenance } from "./Maintenance";
import { SlackMessageBridge } from "./SlackMessageBridge";
import { SlackConnections } from "./SlackConnections";
import type { PlatformOutletContext } from "../../app/platform-context";

const settingsGroups = [
  { items: [{ id: "project", label: "Project" }, { id: "people", label: "People & access" }] },
  { label: "Integrations", items: [{ id: "integrations/github", label: "GitHub" }, { id: "integrations/slack", label: "Slack" }, { id: "integrations/telemetry", label: "Telemetry" }, { id: "integrations/api", label: "API access" }] },
  { label: "Automation", items: [{ id: "notifications", label: "Notifications" }, { id: "alert-rules", label: "Alert rules" }] },
  { label: "System", items: [{ id: "maintenance", label: "Maintenance" }] },
] as const;

const validSections = new Set<string>(settingsGroups.flatMap((group) => group.items.map((item) => item.id)));

export default function SettingsPage() {
  const { organizationId = "", projectId = "", section, detail } = useParams();
  const { bootstrap, members, membersLoading, membersError, retryMembers } = useOutletContext<PlatformOutletContext>();
  const queryClient = useQueryClient();
  const project = bootstrap.projects.find((item) => item.id === projectId) ?? bootstrap.projects[0];
  const projectName = project?.name ?? projectId;
  const settingsKey = projectSettingsQueryKey(organizationId, projectId);
  const settings = useQuery({ queryKey: settingsKey, queryFn: ({ signal }) => platformApi.projectSettings(organizationId, projectId, signal) });
  const saveTracking = useMutation({
    mutationFn: (next: ProjectSettings) => platformApi.setProjectSettings(organizationId, projectId, next),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsKey, next);
      void queryClient.invalidateQueries({ queryKey: ["activity", organizationId, projectId] });
    },
  });
  const excluded = new Set(settings.data?.excludedMembers ?? []);
  const trackedCount = members.filter((member) => !excluded.has(member.login)).length;
  const connectedRepositories = project?.connections.filter((connection) => connection.provider === "github").map((connection) => connection.label.split("/").at(-1) ?? connection.label) ?? [];
  if (!section) return <Navigate replace to={`/${organizationId}/${projectId}/settings/project`} />;
  const requestedSection = detail ? `${section}/${detail}` : section ?? "project";
  if (!validSections.has(requestedSection)) return <Navigate replace to={`/${organizationId}/${projectId}/settings/project`} />;
  const base = `/${organizationId}/${projectId}/settings`;
  const tracking = <MembersTracking members={members} settings={settings.data ?? {}} loading={membersLoading || settings.isLoading} saving={saveTracking.isPending} canManage={bootstrap.actor.capabilities.includes("organization.manage")} error={Boolean(membersError || settings.isError || saveTracking.isError)} retryMembers={retryMembers} onToggle={(login) => {
    const current = settings.data?.excludedMembers ?? [];
    const nextExcluded = excluded.has(login) ? current.filter((item) => item !== login) : [...current, login];
    saveTracking.mutate({ ...(settings.data ?? {}), excludedMembers: nextExcluded });
  }} />;

  return <SettingsShell base={base} active={requestedSection} groups={settingsGroups}>
    {requestedSection === "project" ? <><SettingsPageHeader title="Project" description="Review the identity and shared scope for this project." /><SettingsSection title="Project details"><div className="settings-card"><div className="list-surface"><ListRow symbol="P" title={projectName} description={`Project ID · ${projectId}`} meta={<StatusTag tone="positive">{project?.environment ?? "Production"}</StatusTag>} /><ListRow symbol="R" title={`${connectedRepositories.length} repositories`} description="Repository scope is managed through the GitHub integration." meta={<Link className="mini-button" to={`${base}/integrations/github`}>Manage GitHub</Link>} /></div></div></SettingsSection></> : null}
    {requestedSection === "people" ? <><SettingsPageHeader title="People & access" description="Control who is represented in project activity and ownership views." scope="Workspace" /><SettingsSection title="Tracked members" description={membersLoading || settings.isLoading ? "Loading member directory…" : `${trackedCount} of ${members.length} members tracked.`}>{tracking}</SettingsSection></> : null}
    {requestedSection === "integrations/github" ? <><SettingsPageHeader title="GitHub" description="Manage the repositories that supply work, issues, and delivery activity." /><SettingsSection title="Repository access"><ProjectRepositories organizationId={organizationId} projectId={projectId} projectName={projectName} canManage={bootstrap.actor.isAdmin} connectedRepositories={connectedRepositories} /></SettingsSection></> : null}
    {requestedSection === "integrations/slack" ? <><SettingsPageHeader title="Slack" description="Manage workspace connections and verify message delivery." scope="Workspace" /><SettingsSection title="Connections"><SlackConnections organizationId={organizationId} projectId={projectId} projects={bootstrap.projects} isAdmin={bootstrap.actor.isAdmin} /></SettingsSection><SettingsSection title="Delivery test" description="Send a test message through a connected workspace."><SlackMessageBridge organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /></SettingsSection></> : null}
    {requestedSection === "integrations/telemetry" ? <><SettingsPageHeader title="Telemetry" description="Manage product data sources, ingest credentials, schedules, and report cards." /><TelemetrySources organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /></> : null}
    {requestedSection === "integrations/api" ? <><SettingsPageHeader title="API access" description="Create project credentials and review the API surface." /><ApiAccess organizationId={organizationId} projectId={projectId} projectName={projectName} isAdmin={bootstrap.actor.isAdmin} /></> : null}
    {requestedSection === "notifications" ? <><SettingsPageHeader title="Notifications" description="Choose where delivery updates and summaries are sent." /><NotificationSettings organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /></> : null}
    {requestedSection === "alert-rules" ? <><SettingsPageHeader title="Alert rules" description="Review the rules that create operational incidents." /><AlertRules organizationId={organizationId} projectId={projectId} /></> : null}
    {requestedSection === "maintenance" ? <><SettingsPageHeader title="Maintenance" description="Run recovery workflows and inspect background failures." /><Maintenance organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /></> : null}
  </SettingsShell>;
}

function MembersTracking({ members, settings, loading, saving, canManage, error, retryMembers, onToggle }: { members: GithubMember[]; settings: ProjectSettings; loading: boolean; saving: boolean; canManage: boolean; error: boolean; retryMembers: () => void; onToggle: (login: string) => void }) {
  const organizationMembers = members.filter((member) => member.kind === "human");
  const excluded = new Set(settings.excludedMembers ?? []);
  if (loading) return <div className="connect-empty"><b>Loading GitHub members</b><p>Reading the organization member directory…</p></div>;
  if (error && organizationMembers.length === 0) return <div className="connect-empty"><b>Members could not be loaded</b><p>The failure was not converted into an empty organization.</p><button type="button" className="button" onClick={retryMembers}>Retry</button></div>;
  return <>
    <div className="connect-inline-action"><p>GitHub members can access every capability. Tracking only controls whether their work appears in activity, ownership filters, and people statistics.</p><StatusTag tone="positive">Access unchanged</StatusTag></div>
    {organizationMembers.length ? <div className="list-surface settings-member-list">{organizationMembers.map((member) => {
      const tracked = !excluded.has(member.login);
      return <div className={`list-row ${tracked ? "" : "member-not-tracked"}`} key={member.login}>
        <img className="member-avatar" src={member.avatar_url} alt="" />
        <span className="list-copy"><b>{member.login}</b><small>GitHub {member.kind === "bot" ? "bot" : "member"} · {tracked ? "Included in platform activity" : "Hidden from platform activity"}</small></span>
        <span className="list-meta"><span className={`toggle-label ${tracked ? "on" : ""}`}>{tracked ? "Tracked" : "Not tracked"}</span>{canManage ? <button type="button" className="toggle-switch" role="switch" aria-checked={tracked} aria-label={`Track ${member.login}`} disabled={saving} onClick={() => onToggle(member.login)}><span /></button> : null}</span>
      </div>;
    })}</div> : <div className="connect-empty"><b>No GitHub members returned</b><p>Members will appear after the organization member sync completes.</p></div>}
    {error && members.length ? <p className="form-error" role="alert">The tracking change could not be saved.</p> : null}
    <p className="section-note">Not tracked does not remove sign-in or service access. Use guest invitations when access itself must be scoped.</p>
  </>;
}

function ApiAccess({ organizationId, projectId, projectName, isAdmin }: { organizationId: string; projectId: string; projectName: string; isAdmin: boolean }) {
  const [view, setView] = useState<"credentials" | "reference">("credentials");
  return <>
    <div className="settings-tabs" role="tablist" aria-label="API access settings"><button type="button" role="tab" aria-selected={view === "credentials"} onClick={() => setView("credentials")}>Credentials</button><button type="button" role="tab" aria-selected={view === "reference"} onClick={() => setView("reference")}>API reference</button></div>
    {view === "credentials" ? <ApiTokens organizationId={organizationId} projectId={projectId} projectName={projectName} isAdmin={isAdmin} /> : <ApiReference projectName={projectName} />}
  </>;
}

function ApiReference({ projectName }: { projectName: string }) {
  return <div className="api-reference">
    <div className="api-reference-intro"><div><span className="eyebrow">BASE URL</span><code>https://app.noxhere.com/api/v1</code></div><div><span className="eyebrow">AUTHENTICATION</span><p>Send the project-scoped automation token as <code>Authorization: Bearer nox_sk_…</code></p></div><a className="button secondary" href="/openapi.json" target="_blank" rel="noreferrer">Open full API specification ↗</a></div>
    <div className="list-surface"><ListRow symbol="S" title="Discover capabilities" description="GET /api/v1/services" meta={<StatusTag>read</StatusTag>} /><ListRow symbol="P" title="List projects" description="GET /api/v1/projects" meta={<StatusTag>{projectName}</StatusTag>} /><ListRow symbol="A" title="Read project activity" description="GET /api/v1/projects/{id}/activity" meta={<StatusTag>Activity read</StatusTag>} /><ListRow symbol="E" title="Ingest a public stat event" description="POST /api/v1/telemetry/public/events" meta={<StatusTag>Incident ingest</StatusTag>} /></div>
    <p className="section-note">Project IDs, tokens, scopes and API documentation stay together in project settings.</p>
  </div>;
}
