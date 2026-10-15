import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";
import type { GithubMember, GuestInvite, OrganizationMember, Project } from "../../api/contracts";
import { platformApi } from "../../api/platform";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";
import { ProjectRepositories } from "../../components/ProjectRepositories";
import type { PlatformOutletContext } from "../../app/platform-context";
import { useConfirmDialog } from "../../components/ConfirmDialog";

type ConnectionsSection = "services" | "connections" | "people" | "repositories";
const serviceRows = [["planning", "P", "Planning", "Planning and delivery"], ["activity", "A", "Activity", "Engineering activity and releases"], ["feedback", "F", "Feedback", "Reports and reporter messaging"], ["stats", "S", "Stats", "Product metrics and telemetry sources"], ["incidents", "I", "Issues and Incidents", "Repository issues, product health and alerts"]] as const;

export default function ConnectionsPage() {
  const { organizationId = "", projectId = "", view = "overview" } = useParams();
  const { bootstrap, members, membersLoading, membersError, retryMembers } = useOutletContext<PlatformOutletContext>();
  const project = bootstrap.projects.find((item) => item.id === projectId) ?? bootstrap.projects[0];
  const projectName = project?.name ?? projectId;
  const isTestProject = project?.environment === "test";
  const selected = view as ConnectionsSection | "overview";

  return (
    <section>
      <div className="connect-home connect-clean">
        {isTestProject ? <div className="test-project-banner"><div><b>Safe testing project</b><p>Changes here use sandbox connections and do not affect production projects.</p></div><StatusTag tone="warning">TEST</StatusTag></div> : null}
        <div className="connect-accordions">
          <Accordion id="connections" current={selected} symbol="C" title="Connections" description="GitHub and Slack capabilities for this project" status={connectionStatus(project)}>
            <Connections project={project} projectName={projectName} />
          </Accordion>
          <Accordion id="people" current={selected} symbol="P" title="People and access" description={`Verified GitHub organization members with access to ${projectName}`} status={membersLoading ? "Loading" : `${members.length} people`}>
            <People members={members} membersLoading={membersLoading} membersError={membersError} retryMembers={retryMembers} organizationId={organizationId} projectId={projectId} canInvite={bootstrap.actor.isAdmin} />
          </Accordion>
          <Accordion id="repositories" current={selected} symbol="R" title="Project repositories" description="Repositories included across every capability" status={`${project?.connections.filter((connection) => connection.provider === "github").length ?? 0} included`}>
            <ProjectRepositories organizationId={organizationId} projectId={projectId} projectName={projectName} canManage={bootstrap.actor.isAdmin} connectedRepositories={repositoryNames(project)} />
          </Accordion>
          <Accordion id="services" current={selected} symbol="S" title="Capabilities" description="Every NoxHere capability is available in every project" status="Always available">
            <Services />
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function Accordion({ id, current, symbol, title, description, status, children }: { id: ConnectionsSection; current: ConnectionsSection | "overview"; symbol: string; title: string; description: string; status: string; children: ReactNode }) {
  const [open, setOpen] = useState(current === id || (current === "overview" && id === "connections"));
  return <details className="connect-accordion" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary role="button" aria-label={`Toggle ${title}`} aria-expanded={open}><span className="row-symbol">{symbol}</span><span className="connect-accordion-copy"><b>{title}</b><small>{description}</small></span><span className="connect-accordion-status">{status}</span><span className="connect-chevron" aria-hidden="true">⌄</span></summary><div className="connect-accordion-body">{children}</div></details>;
}

function connectionStatus(project?: Project) {
  const connected = project?.connections.filter((connection) => connection.status === "connected").length ?? 0;
  return `${connected} connected`;
}

function Connections({ project, projectName }: { project?: Project; projectName: string }) {
  return <><div className="list-surface">{project?.connections.map((connection) => <ListRow key={connection.id} symbol={connection.provider === "github" ? "G" : "S"} tone={connection.status === "connected" ? "positive" : "neutral"} title={connection.provider === "github" ? "GitHub" : "Slack"} description={`${connection.label} · ${connection.provider === "github" ? "repository data, issues and pull requests" : "alerts, reports and release delivery"}`} meta={<StatusTag tone={connection.status === "connected" ? "positive" : "warning"}>{connection.status === "connected" ? "Connected" : "Needs attention"}</StatusTag>} />)}</div><p className="section-note">Credentials are stored by NoxHere for {projectName}; capabilities receive only the access they need.</p></>;
}

function People({ members, membersLoading, membersError, retryMembers, organizationId, projectId, canInvite }: { members: GithubMember[]; membersLoading: boolean; membersError: Error | null; retryMembers: () => void; organizationId: string; projectId: string; canInvite: boolean }) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState<"all" | "planning" | "activity" | "feedback" | "telemetry">("all");
  const queryClient = useQueryClient();
  const access = useQuery({ queryKey: ["platform", "guest-access", organizationId], queryFn: ({ signal }) => platformApi.guestAccess(organizationId, signal), enabled: canInvite });
  const roleMembers = useQuery({ queryKey: ["platform", "memberships", organizationId], queryFn: ({ signal }) => platformApi.organizationMembers(organizationId, signal) });
  const auditLog = useQuery({ queryKey: ["platform", "access-audit", organizationId], queryFn: ({ signal }) => platformApi.auditLog(organizationId, signal), enabled: canInvite });
  const invite = useMutation({
    mutationFn: () => platformApi.inviteGuest(organizationId, projectId, email.trim(), serviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "guest-access", organizationId] });
      setEmail("");
      setServiceId("all");
      setShowInvite(false);
    },
  });
  const setRole = useMutation({
    mutationFn: ({ principalId, role }: { principalId: string; role: "admin" | "member" | "viewer" }) => platformApi.setMemberRole(organizationId, principalId, role),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["platform", "memberships", organizationId] }),
  });
  const revoke = useMutation({
    mutationFn: ({ kind, id }: { kind: "invites" | "grants"; id: string }) => platformApi.revokeGuest(organizationId, kind, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["platform", "guest-access", organizationId] }),
  });
  const updateGuest = useMutation({
    mutationFn: ({ kind, id, serviceId }: { kind: "invites" | "grants"; id: string; serviceId: "all" | "planning" | "activity" | "feedback" | "telemetry" }) => platformApi.setGuestScope(organizationId, projectId, kind, id, serviceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["platform", "guest-access", organizationId] }),
  });
  const resend = useMutation({
    mutationFn: (id: string) => platformApi.resendGuestInvite(organizationId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["platform", "guest-access", organizationId] }),
  });
  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim()) invite.mutate();
  };

  const guestServices = ["planning", "activity", "feedback", "telemetry"] as const;
  const invitations = (access.data?.invitations ?? []).filter((item) => item.projectId === projectId || item.scopeType === "organization");
  const grants = (access.data?.grants ?? []).filter((item) => item.projectId === projectId || item.scopeType === "organization");
  const directory = [...members, ...(roleMembers.data ?? []).filter((managed) => !members.some((member) => member.login.toLowerCase() === managed.login.toLowerCase())).map((managed) => ({ login: managed.login, avatar_url: managed.avatarUrl ?? "", kind: "human" as const }))];

  return <>
    <div className="connect-inline-action"><p>One invitation grants read-only access to all project capabilities by default. Settings are never available to guests.</p>{canInvite ? <button type="button" className="button" aria-expanded={showInvite} onClick={() => setShowInvite((open) => !open)}>{showInvite ? "Cancel" : "Invite guest"}</button> : null}</div>
    {showInvite ? <form className="guest-invite-form" onSubmit={submitInvite}>
      <label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@company.com" required autoFocus /></label>
      <label><span>Capability access</span><select value={serviceId} onChange={(event) => setServiceId(event.target.value as typeof serviceId)}><option value="all">All capabilities</option>{guestServices.map((id) => <option value={id} key={id}>{serviceName(id)}</option>)}</select></label>
      <button className="button primary-button" disabled={invite.isPending}>{invite.isPending ? "Sending…" : "Send invite"}</button>
      {invite.isError ? <span className="form-error" role="alert">{invite.error instanceof Error ? invite.error.message : "Invite could not be sent."}</span> : null}
    </form> : null}
    {membersLoading ? <div className="connect-empty"><b>Loading GitHub members</b><p>Reading the shared organization member directory…</p></div> : null}
    {membersError && directory.length === 0 ? <div className="connect-empty"><b>Members could not be loaded</b><p>The existing member directory was not replaced with an empty list.</p><button type="button" className="button" onClick={retryMembers}>Retry</button></div> : null}
    {(!membersLoading || directory.length > 0) && (directory.length || grants.length || invitations.length) ? <div className="list-surface member-list">{directory.map((member) => <MemberRow key={member.login} member={member} managed={roleMembers.data?.find((candidate) => candidate.login.toLowerCase() === member.login.toLowerCase())} canManage={canInvite} busy={setRole.isPending} onRole={(principalId, role) => setRole.mutate({ principalId, role })} />)}{grants.map((guest) => <GuestRow key={guest.id} guest={guest} status="Active guest" busy={revoke.isPending || updateGuest.isPending} onScope={(serviceId) => updateGuest.mutate({ kind: "grants", id: guest.id, serviceId })} onRevoke={() => revoke.mutate({ kind: "grants", id: guest.id })} />)}{invitations.map((pending) => <GuestRow key={pending.id} guest={pending} status="Invite pending" pending busy={revoke.isPending || updateGuest.isPending || resend.isPending} onScope={(serviceId) => updateGuest.mutate({ kind: "invites", id: pending.id, serviceId })} onResend={() => resend.mutate(pending.id)} onRevoke={() => revoke.mutate({ kind: "invites", id: pending.id })} />)}</div> : null}
    {!membersLoading && !membersError && !directory.length && !grants.length && !invitations.length ? <div className="connect-empty"><b>No verified organization members</b><p>Members will appear after the GitHub organization sync completes.</p></div> : null}
    {membersError && directory.length > 0 ? <p className="form-error" role="alert">GitHub could not refresh, so the last verified NoxHere member directory remains available. <button type="button" className="link-button" onClick={retryMembers}>Retry</button></p> : null}
    {setRole.error || revoke.error || updateGuest.error || resend.error ? <p className="form-error" role="alert">{(setRole.error ?? revoke.error ?? updateGuest.error ?? resend.error)?.message}</p> : null}
    {canInvite ? <details className="access-audit"><summary>Recent access and administration activity</summary>{auditLog.data?.length ? <div className="list-surface">{auditLog.data.slice(0, 20).map((event) => <div className="list-row" key={event.id}><span className="list-symbol">A</span><span className="list-copy"><b>{event.action.replaceAll(".", " ")}</b><small>{event.actorId} · {event.targetId ?? "organization"} · {new Date(event.createdAt).toLocaleString()}</small></span></div>)}</div> : <p>{auditLog.isLoading ? "Loading audit history…" : "No access changes recorded yet."}</p>}</details> : null}
    <p className="section-note">Owners are verified GitHub organization owners. NoxHere admins manage access and connections, members can collaborate, viewers and guests are read-only.</p>
  </>;
}

function MemberRow({ member, managed, canManage, busy, onRole }: { member: GithubMember; managed?: OrganizationMember; canManage: boolean; busy: boolean; onRole: (principalId: string, role: "admin" | "member" | "viewer") => void }) {
  const role = managed?.role ?? "member";
  return <div className="list-row">{member.avatar_url ? <img className="member-avatar" src={member.avatar_url} alt="" /> : <span className="list-symbol">M</span>}<span className="list-copy"><b>{member.login}</b><small>{managed ? `${roleLabel(role)} · ${managed.roleSource === "github" ? "Verified by GitHub" : "Managed in NoxHere"} · verified ${new Date(managed.verifiedAt).toLocaleDateString()}` : "GitHub organization member · role available after first sign-in"}</small></span><span className="list-meta">{canManage && managed && role !== "owner" ? <select aria-label={`Role for ${member.login}`} value={role} disabled={busy} onChange={(event) => onRole(managed.principalId, event.target.value as "admin" | "member" | "viewer")}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select> : <StatusTag tone={role === "owner" || role === "admin" ? "positive" : "neutral"}>{roleLabel(role)}</StatusTag>}</span></div>;
}

function GuestRow({ guest, status, pending = false, busy, onScope, onResend, onRevoke }: { guest: GuestInvite; status: string; pending?: boolean; busy: boolean; onScope: (serviceId: "all" | "planning" | "activity" | "feedback" | "telemetry") => void; onResend?: () => void; onRevoke: () => void }) {
  const { confirm, confirmation } = useConfirmDialog();
  const current = guest.service ?? "all";
  return <><div className="list-row"><span className="list-symbol">G</span><span className="list-copy"><b>{guest.email}</b><small>Guest · {guest.service ? serviceNameFromApi(guest.service) : "All capabilities"} · {guest.projectName ?? "Organization"}{guest.expiresAt ? ` · expires ${new Date(guest.expiresAt).toLocaleDateString()}` : ""}</small></span><span className="list-meta">{guest.scopeType !== "organization" ? <select aria-label={`Access for ${guest.email}`} value={current} disabled={busy} onChange={(event) => onScope(event.target.value as typeof current)}><option value="all">All capabilities</option><option value="planning">Planning</option><option value="activity">Activity</option><option value="feedback">Feedback</option><option value="telemetry">Stats and Incidents</option></select> : null}<StatusTag tone={pending ? "warning" : "positive"}>{status}</StatusTag>{pending && onResend ? <button type="button" className="mini-button" disabled={busy} onClick={onResend}>Resend</button> : null}<button type="button" className="mini-button destructive" disabled={busy} onClick={() => void confirm({ title: pending ? "Cancel guest invitation?" : "Revoke guest access?", detail: pending ? `${guest.email} will no longer be able to accept this invitation.` : `${guest.email} will immediately lose this guest access.`, confirmLabel: pending ? "Cancel invitation" : "Revoke access", destructive: true }).then((confirmed) => { if (confirmed) onRevoke(); })}>{pending ? "Cancel invite" : "Revoke"}</button></span></div>{confirmation}</>;
}

function roleLabel(role: OrganizationMember["role"]) { return role[0].toUpperCase() + role.slice(1); }

function serviceName(id: "planning" | "activity" | "feedback" | "telemetry") {
  return ({ planning: "Planning", activity: "Activity", feedback: "Feedback", telemetry: "Stats and Incidents" } as const)[id];
}

function serviceNameFromApi(id: NonNullable<GuestInvite["service"]>) {
  return ({ planning: "Planning", activity: "Activity", feedback: "Feedback", telemetry: "Stats and Incidents" } as const)[id];
}

function repositoryNames(project?: Project) { return project?.connections.filter((connection) => connection.provider === "github").map((connection) => connection.label.split("/").at(-1) ?? connection.label) ?? []; }

function Services() {
  return <div className="list-surface">{serviceRows.map(([id, symbol, title, description]) => (
    <ListRow key={id} symbol={symbol} title={title} description={description} meta={<StatusTag tone="positive">Available</StatusTag>} />
  ))}</div>;
}
