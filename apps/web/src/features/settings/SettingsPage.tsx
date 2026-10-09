import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";
import type { Bootstrap, GithubMember, ProjectSettings } from "../../api/contracts";
import { platformApi, projectSettingsQueryKey } from "../../api/platform";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";
import { ProjectRepositories } from "../../components/ProjectRepositories";
import { ApiTokens } from "./ApiTokens";
import { Maintenance } from "./Maintenance";
import { SlackMessageBridge } from "./SlackMessageBridge";

type SettingsSection = "repositories" | "members" | "slack-message" | "api-access" | "maintenance";

export default function SettingsPage() {
  const { organizationId = "", projectId = "" } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const queryClient = useQueryClient();
  const project = bootstrap.projects.find((item) => item.id === projectId) ?? bootstrap.projects[0];
  const projectName = project?.name ?? projectId;
  const members = useQuery({ queryKey: ["platform", "members", organizationId, projectId], queryFn: ({ signal }) => platformApi.members(organizationId, projectId, signal) });
  const settingsKey = projectSettingsQueryKey(organizationId, projectId);
  const settings = useQuery({ queryKey: settingsKey, queryFn: ({ signal }) => platformApi.projectSettings(organizationId, projectId, signal) });
  const saveTracking = useMutation({
    mutationFn: (next: ProjectSettings) => platformApi.setProjectSettings(organizationId, projectId, next),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsKey, next);
      void queryClient.invalidateQueries({ queryKey: ["feed", organizationId, projectId] });
    },
  });
  const excluded = new Set(settings.data?.excludedMembers ?? []);
  const trackedCount = (members.data ?? []).filter((member) => !excluded.has(member.login)).length;
  const connectedRepositories = project?.connections.filter((connection) => connection.provider === "github").map((connection) => connection.label.split("/").at(-1) ?? connection.label) ?? [];
  return <section><div className="connect-home connect-clean"><div className="connect-accordions">
    <SettingsAccordion id="repositories" symbol="R" title="Project repositories" description="Shared repository scope for every Nox capability" status={`${connectedRepositories.length} included`} initialOpen>
      <ProjectRepositories organizationId={organizationId} projectId={projectId} projectName={projectName} canManage={bootstrap.actor.isAdmin} connectedRepositories={connectedRepositories} />
    </SettingsAccordion>
    <SettingsAccordion id="members" symbol="P" title="Members" description="GitHub members included in activity and people views" status={members.isLoading || settings.isLoading ? "Loading" : `${trackedCount}/${members.data?.length ?? 0} tracked`}>
      <MembersTracking members={members.data ?? []} settings={settings.data ?? {}} loading={members.isLoading || settings.isLoading} saving={saveTracking.isPending} error={members.isError || settings.isError || saveTracking.isError} onToggle={(login) => {
        const current = settings.data?.excludedMembers ?? [];
        const nextExcluded = excluded.has(login) ? current.filter((item) => item !== login) : [...current, login];
        saveTracking.mutate({ ...(settings.data ?? {}), excludedMembers: nextExcluded });
      }} />
    </SettingsAccordion>
    <SettingsAccordion id="slack-message" symbol="S" title="Send to Slack" description="Compose a message using the connected Slack workspace" status="Message bridge">
      <SlackMessageBridge organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} />
    </SettingsAccordion>
    <SettingsAccordion id="api-access" symbol="A" title="API access" description="Project tokens, scopes and developer documentation" status="Connected">
      <ApiAccess organizationId={organizationId} projectId={projectId} projectName={projectName} isAdmin={bootstrap.actor.isAdmin} />
    </SettingsAccordion>
    <SettingsAccordion id="maintenance" symbol="M" title="Maintenance" description="Synchronization, recovery and background operations" status="Connected">
      <Maintenance organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} />
    </SettingsAccordion>
  </div><div className="callout"><div><b>Projects belong to NoxConnect</b><p>Change the active project with the NoxConnect project picker; settings then apply to that selected project.</p></div><StatusTag tone="positive">Boundary enforced</StatusTag></div></div></section>;
}

function SettingsAccordion({ id, symbol, title, description, status, children, initialOpen = false }: { id: SettingsSection; symbol: string; title: string; description: string; status: string; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <details className="connect-accordion" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary role="button" aria-label={`Toggle ${title}`} aria-expanded={open}><span className="row-symbol">{symbol}</span><span className="connect-accordion-copy"><b>{title}</b><small>{description}</small></span><span className="connect-accordion-status">{status}</span><span className="connect-chevron" aria-hidden="true">⌄</span></summary><div className="connect-accordion-body" data-section={id}>{children}</div></details>;
}

function MembersTracking({ members, settings, loading, saving, error, onToggle }: { members: GithubMember[]; settings: ProjectSettings; loading: boolean; saving: boolean; error: boolean; onToggle: (login: string) => void }) {
  const organizationMembers = members.filter((member) => member.kind === "human");
  const excluded = new Set(settings.excludedMembers ?? []);
  if (loading) return <div className="connect-empty"><b>Loading GitHub members</b><p>Reading the organization member directory…</p></div>;
  if (error && organizationMembers.length === 0) return <div className="connect-empty"><b>Members could not be loaded</b><p>Try again after the GitHub member sync is available.</p></div>;
  return <>
    <div className="connect-inline-action"><p>GitHub members can access every capability. Tracking only controls whether their work appears in activity, ownership filters, and people statistics.</p><StatusTag tone="positive">Access unchanged</StatusTag></div>
    {organizationMembers.length ? <div className="list-surface settings-member-list">{organizationMembers.map((member) => {
      const tracked = !excluded.has(member.login);
      return <div className={`list-row ${tracked ? "" : "member-not-tracked"}`} key={member.login}>
        <img className="member-avatar" src={member.avatar_url} alt="" />
        <span className="list-copy"><b>{member.login}</b><small>GitHub {member.kind === "bot" ? "bot" : "member"} · {tracked ? "Included in platform activity" : "Hidden from platform activity"}</small></span>
        <span className="list-meta"><span className={`toggle-label ${tracked ? "on" : ""}`}>{tracked ? "Tracked" : "Not tracked"}</span><button type="button" className="toggle-switch" role="switch" aria-checked={tracked} aria-label={`Track ${member.login}`} disabled={saving} onClick={() => onToggle(member.login)}><span /></button></span>
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
    <div className="list-surface"><ListRow symbol="S" title="Discover capabilities" description="GET /api/v1/services" meta={<StatusTag>read</StatusTag>} /><ListRow symbol="P" title="List projects" description="GET /api/v1/projects" meta={<StatusTag>{projectName}</StatusTag>} /><ListRow symbol="A" title="Read project activity" description="GET /api/v1/projects/{id}/activity" meta={<StatusTag>Activity read</StatusTag>} /><ListRow symbol="E" title="Ingest a public stat event" description="POST /api/v1/cues/public/events" meta={<StatusTag>Incident ingest</StatusTag>} /></div>
    <p className="section-note">Project IDs, tokens, scopes and API documentation stay together in project settings.</p>
  </div>;
}
