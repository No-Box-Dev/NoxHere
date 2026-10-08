import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";
import type { Bootstrap, GuestInvite, Project } from "../../api/contracts";
import { platformApi } from "../../api/platform";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";
import { ProjectRepositories } from "../../components/ProjectRepositories";

type ConnectSection = "services" | "connections" | "people" | "repositories";
const serviceRows = [["ticket", "P", "Planning", "Planning and delivery"], ["feed", "A", "Activity", "Engineering activity and releases"], ["spot", "F", "Feedback", "Reports and reporter messaging"], ["stats", "S", "Stats", "Product metrics and telemetry sources"], ["incidents", "I", "Incidents", "Product health and alerts"]] as const;

export default function NoxConnectPage() {
  const { organizationId = "", projectId = "", view = "overview" } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const project = bootstrap.projects.find((item) => item.id === projectId) ?? bootstrap.projects[0];
  const projectName = project?.name ?? projectId;
  const isTestProject = project?.environment === "test";
  const selected = view as ConnectSection | "overview";

  return (
    <section>
      <div className="connect-home connect-clean">
        {isTestProject ? <div className="test-project-banner"><div><b>Safe testing project</b><p>Changes here use sandbox connections and do not affect production projects.</p></div><StatusTag tone="warning">TEST</StatusTag></div> : null}
        <div className="connect-accordions">
          <Accordion id="connections" current={selected} symbol="C" title="Connections" description="GitHub and Slack capabilities for this project" status={connectionStatus(project)}>
            <Connections project={project} projectName={projectName} />
          </Accordion>
          <Accordion id="people" current={selected} symbol="P" title="People and access" description={`Verified GitHub organization members with access to ${projectName}`} status={`${project?.members.length ?? 0} people`}>
            <People project={project} organizationId={organizationId} projectId={projectId} canInvite={bootstrap.actor.isAdmin} />
          </Accordion>
          <Accordion id="repositories" current={selected} symbol="R" title="Project repositories" description="Repositories included across every capability" status={`${project?.connections.filter((connection) => connection.provider === "github").length ?? 0} included`}>
            <ProjectRepositories organizationId={organizationId} projectId={projectId} projectName={projectName} canManage={bootstrap.actor.isAdmin} connectedRepositories={repositoryNames(project)} />
          </Accordion>
          <Accordion id="services" current={selected} symbol="S" title="Capabilities" description="Every NoxConnect capability is available in every project" status="Always available">
            <Services />
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function Accordion({ id, current, symbol, title, description, status, children }: { id: ConnectSection; current: ConnectSection | "overview"; symbol: string; title: string; description: string; status: string; children: ReactNode }) {
  const [open, setOpen] = useState(current === id || (current === "overview" && id === "connections"));
  return <details className="connect-accordion" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary role="button" aria-label={`Toggle ${title}`} aria-expanded={open}><span className="row-symbol">{symbol}</span><span className="connect-accordion-copy"><b>{title}</b><small>{description}</small></span><span className="connect-accordion-status">{status}</span><span className="connect-chevron" aria-hidden="true">⌄</span></summary><div className="connect-accordion-body">{children}</div></details>;
}

function connectionStatus(project?: Project) {
  const connected = project?.connections.filter((connection) => connection.status === "connected").length ?? 0;
  return `${connected} connected`;
}

function Connections({ project, projectName }: { project?: Project; projectName: string }) {
  return <><div className="list-surface">{project?.connections.map((connection) => <ListRow key={connection.id} symbol={connection.provider === "github" ? "G" : "S"} tone={connection.status === "connected" ? "positive" : "neutral"} title={connection.provider === "github" ? "GitHub" : "Slack"} description={`${connection.label} · ${connection.provider === "github" ? "repository data, issues and pull requests" : "alerts, reports and release delivery"}`} meta={<StatusTag tone={connection.status === "connected" ? "positive" : "warning"}>{connection.status === "connected" ? "Connected" : "Needs attention"}</StatusTag>} />)}</div><p className="section-note">Credentials are stored by NoxConnect for {projectName}; capabilities receive only the access they need.</p></>;
}

function People({ project, organizationId, projectId, canInvite }: { project?: Project; organizationId: string; projectId: string; canInvite: boolean }) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState<"all" | "ticket" | "feed" | "spot" | "cue">("all");
  const queryClient = useQueryClient();
  const access = useQuery({ queryKey: ["platform", "guest-access", organizationId], queryFn: ({ signal }) => platformApi.guestAccess(organizationId, signal), enabled: canInvite });
  const invite = useMutation({
    mutationFn: () => platformApi.inviteGuest(organizationId, projectId, email.trim(), serviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "guest-access", organizationId] });
      setEmail("");
      setServiceId("all");
      setShowInvite(false);
    },
  });
  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim()) invite.mutate();
  };

  const guestServices = ["ticket", "feed", "spot", "cue"] as const;
  const invitations = (access.data?.invitations ?? []).filter((item) => item.projectId === projectId || item.scopeType === "organization");
  const grants = (access.data?.grants ?? []).filter((item) => item.projectId === projectId || item.scopeType === "organization");

  return <>
    <div className="connect-inline-action"><p>One invitation grants read-only access to all project capabilities by default. Settings are never available to guests.</p>{canInvite ? <button type="button" className="button" aria-expanded={showInvite} onClick={() => setShowInvite((open) => !open)}>{showInvite ? "Cancel" : "Invite guest"}</button> : null}</div>
    {showInvite ? <form className="guest-invite-form" onSubmit={submitInvite}>
      <label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@company.com" required autoFocus /></label>
      <label><span>Capability access</span><select value={serviceId} onChange={(event) => setServiceId(event.target.value as typeof serviceId)}><option value="all">All capabilities</option>{guestServices.map((id) => <option value={id} key={id}>{serviceName(id)}</option>)}</select></label>
      <button className="button primary-button" disabled={invite.isPending}>{invite.isPending ? "Sending…" : "Send invite"}</button>
      {invite.isError ? <span className="form-error" role="alert">{invite.error instanceof Error ? invite.error.message : "Invite could not be sent."}</span> : null}
    </form> : null}
    {project?.members.length || grants.length || invitations.length ? <div className="list-surface member-list">{project?.members.map((member) => <div className="list-row" key={member.login}><img className="member-avatar" src={member.avatarUrl} alt="" /><span className="list-copy"><b>{member.login}</b><small>{member.role === "admin" ? "Organization admin" : "Organization member"} · Verified by GitHub</small></span><span className="list-meta"><StatusTag tone="positive">Active</StatusTag></span></div>)}{grants.map((guest) => <GuestRow key={guest.id} guest={guest} status="Active guest" />)}{invitations.map((pending) => <GuestRow key={pending.id} guest={pending} status="Invite pending" pending />)}</div> : <div className="connect-empty"><b>No verified organization members</b><p>Members appear after NoxConnect verifies their GitHub organization membership.</p></div>}
    <p className="section-note">Members come from the verified GitHub organization-member list. Guests are read-only, scoped to this project, and cannot open Settings or NoxConnect administration.</p>
  </>;
}

function GuestRow({ guest, status, pending = false }: { guest: GuestInvite; status: string; pending?: boolean }) {
  return <div className="list-row"><span className="list-symbol">G</span><span className="list-copy"><b>{guest.email}</b><small>Guest · {guest.service ? serviceNameFromApi(guest.service) : "All capabilities"} · No settings access</small></span><span className="list-meta"><StatusTag tone={pending ? "warning" : "positive"}>{status}</StatusTag></span></div>;
}

function serviceName(id: "ticket" | "feed" | "spot" | "cue") {
  return ({ ticket: "Planning", feed: "Activity", spot: "Feedback", cue: "Stats and Incidents" } as const)[id];
}

function serviceNameFromApi(id: NonNullable<GuestInvite["service"]>) {
  return ({ noxticket: "Planning", noxfeed: "Activity", noxspot: "Feedback", noxcue: "Stats and Incidents" } as const)[id];
}

function repositoryNames(project?: Project) { return project?.connections.filter((connection) => connection.provider === "github").map((connection) => connection.label.split("/").at(-1) ?? connection.label) ?? []; }

function Services() {
  return <div className="list-surface">{serviceRows.map(([id, symbol, title, description]) => (
    <ListRow key={id} symbol={symbol} title={title} description={description} meta={<StatusTag tone="positive">Available</StatusTag>} />
  ))}</div>;
}
