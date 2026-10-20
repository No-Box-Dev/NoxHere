import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteRawJson, getRawJson, patchRawJson, postRawJson, type RequestScope } from "../../api/http";
import { platformApi } from "../../api/platform";
import { useConfirmDialog } from "../../components/ConfirmDialog";
import type { Project } from "../../api/contracts";

type WidgetEnvironment = {
  name: string;
  url: string;
  buttonColor?: string | null;
  buttonText?: string | null;
  widgetMode?: "development" | "release" | null;
  captureMode?: "screenshot" | "dom" | null;
  enabled?: boolean;
};

type LauncherStyle = "tab" | "button";
type LauncherPosition = "top-left" | "center-left" | "bottom-left" | "top-right" | "center-right" | "bottom-right";
type LauncherConfig = {
  desktop: { style: LauncherStyle; position: LauncherPosition };
  mobile: { style: LauncherStyle; position: LauncherPosition };
};

const DEFAULT_LAUNCHER: LauncherConfig = {
  desktop: { style: "tab", position: "center-right" },
  mobile: { style: "button", position: "bottom-right" },
};

const LAUNCHER_POSITIONS: { value: LauncherPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "center-left", label: "Middle left" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "center-right", label: "Middle right" },
  { value: "bottom-right", label: "Bottom right" },
];

type WidgetSite = {
  id: string;
  name: string;
  projectId?: string | null;
  repo?: string | null;
  buttonColor?: string;
  buttonText?: string;
  widgetMode?: "development" | "release";
  autoErrorLogging?: boolean;
  dailySummaryEnabled?: boolean;
  lifecycle?: "draft" | "ready" | "disabled";
  deliveryReady?: boolean;
  deliveryIssues?: string[];
  blocks?: WidgetBlock[];
  slackHealth?: "disabled" | "disconnected" | "degraded" | "pending" | "connected";
  slackChannelId?: string | null;
  slackConnectionId?: string | null;
  slackPendingCount?: number;
  slackBlockedCount?: number;
  slackLastError?: string | null;
  githubPendingCount?: number;
  githubBlockedCount?: number;
  githubLastError?: string | null;
  environments?: WidgetEnvironment[];
  launcher?: LauncherConfig;
  openIssueCount?: number;
  issueCount?: number;
  updatedAt?: string;
};

type WidgetBlock = { id: string; type: "title" | "description" | "reporter" | "contact_email" | "category" | "custom_text" | "custom_textarea" | "element_picker" | "metadata" | "console_logs"; label?: string | null; required?: boolean; environments?: string[] };

type SitesResponse = { sites?: WidgetSite[] };

export function FeedbackWidgets({ organizationId, projectId, projects, isAdmin }: { organizationId: string; projectId: string; projects: Project[]; isAdmin: boolean }) {
  const scope = { organizationId, projectId };
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["spot-sites", organizationId, projectId],
    queryFn: async ({ signal }) => (await getRawJson("/api/v1/feedback/sites", signal, scope) as SitesResponse).sites ?? [],
  });
  const create = useMutation({
    mutationFn: (name: string) => postRawJson("/api/v1/feedback/sites", { name }, scope),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spot-sites", organizationId, projectId] }),
  });
  const [newSiteName, setNewSiteName] = useState("");

  if (query.isLoading) return <WidgetState title="Loading widgets" detail="Reading this project's capture sites…" />;
  if (query.isError) return <WidgetState title="Widgets are unavailable" detail="The capture-site API could not be reached. Refresh to try again." action={() => void query.refetch()} />;

  const sites = query.data ?? [];
  return <div className="widget-settings">
    <header className="widget-settings-head">
      <div><h2>Capture widgets</h2><p>Install and configure feedback capture for this project.</p></div>
      <span>{sites.length} {sites.length === 1 ? "site" : "sites"}</span>
    </header>
    {isAdmin ? <form className="widget-create" onSubmit={(event) => {
      event.preventDefault();
      const name = newSiteName.trim();
      if (!name) return;
      create.mutate(name, { onSuccess: () => setNewSiteName("") });
    }}>
      <label htmlFor="new-widget-site">Add a capture site</label>
      <div><input id="new-widget-site" value={newSiteName} maxLength={120} placeholder="Customer app" onChange={(event) => setNewSiteName(event.target.value)} /><button className="button" disabled={!newSiteName.trim() || create.isPending}>{create.isPending ? "Adding…" : "Add site"}</button></div>
      {create.isError ? <small role="alert">{create.error instanceof Error ? create.error.message : "The site could not be created."}</small> : null}
    </form> : null}
    {sites.length ? <div className="widget-site-list">{sites.map((site) => <WidgetSiteCard key={site.id} site={site} scope={scope} projects={projects} isAdmin={isAdmin} />)}</div>
      : <WidgetState title="No capture sites yet" detail={isAdmin ? "Add a site to generate its install code." : "An administrator needs to add a capture site for this project."} />}
  </div>;
}

function WidgetSiteCard({ site, scope, projects, isAdmin }: { site: WidgetSite; scope: RequestScope; projects: Project[]; isAdmin: boolean }) {
  const { confirm, confirmation } = useConfirmDialog();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [slackDraft, setSlackDraft] = useState(site.slackChannelId ?? "");
  const [projectDraft, setProjectDraft] = useState(site.projectId ?? scope.projectId ?? "");
  const snippet = `<script src="https://app.noxhere.com/widget/${site.id}.js" defer></script>`;
  const identitySnippet = `Feedback.identify({\n  name: currentUser.name,\n  email: currentUser.email,\n  avatarUrl: currentUser.avatarUrl,\n  notifyOnResolution: true\n});`;
  const compatibleProjects = projects.filter((project) => !site.repo || project.connections.some((connection) => connection.provider === "github" && connection.label.split("/").at(-1)?.toLowerCase() === site.repo?.toLowerCase()));
  const update = useMutation({
    mutationFn: (body: unknown) => patchRawJson(`/api/v1/feedback/sites/${encodeURIComponent(site.id)}`, body, {}, scope),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spot-sites", scope.organizationId] }),
  });
  const remove = useMutation({ mutationFn: () => deleteRawJson(`/api/v1/feedback/sites/${encodeURIComponent(site.id)}`, scope), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spot-sites", scope.organizationId, scope.projectId] }) });
  const retry = useMutation({ mutationFn: () => postRawJson<{ queued?: number }>(`/api/v1/feedback/sites/${encodeURIComponent(site.id)}/retry-deliveries`, {}, scope), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spot-sites", scope.organizationId, scope.projectId] }) });
  const slack = useQuery({ queryKey: ["spot-widget-slack", scope.organizationId, scope.projectId], queryFn: ({ signal }) => platformApi.slackStatus(scope.organizationId ?? "", scope.projectId ?? "", signal) });
  const connection = slack.data?.connections.find((item) => item.id === site.slackConnectionId) ?? slack.data?.connections.find((item) => item.projectId === scope.projectId) ?? slack.data?.connections.find((item) => item.id === slack.data?.defaultConnectionId) ?? slack.data?.connections[0];
  const channels = useQuery({ queryKey: ["spot-widget-channels", scope.organizationId, scope.projectId, connection?.id], queryFn: ({ signal }) => platformApi.slackChannels(scope.organizationId ?? "", scope.projectId ?? "", connection?.id ?? "", signal), enabled: Boolean(connection?.id) });
  const testSlack = useMutation({ mutationFn: () => postRawJson("/api/v1/slack/test", { connectionId: connection?.id, channelId: slackDraft, kind: "feedback", sourceId: site.id }, scope) });
  return <article className="widget-site-card">
    <header><div><h3>{site.name}</h3><p>{site.repo || "Project capture site"} · {site.openIssueCount ?? 0} open · {site.issueCount ?? 0} total</p></div><span className="widget-health">{site.deliveryReady ? "Ready" : "Needs setup"}</span></header>
    {!site.deliveryReady ? <div className="widget-delivery-health"><b>Delivery is disabled</b><small>{(site.deliveryIssues ?? []).map(deliveryIssueLabel).join(" · ") || "Complete this site's setup before enabling it."}</small></div> : null}
    <section className="widget-install"><b>Install code</b><p>Place this before <code>&lt;/body&gt;</code> in the top-level page.</p><div><code>{snippet}</code><button type="button" onClick={async () => {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }}>{copied ? "Copied" : "Copy"}</button></div><details><summary>Identify signed-in reporters</summary><p>After the widget script loads, pass approved profile fields from the host application. Call it again when the signed-in user changes; the widget never reads session cookies.</p><pre><code>{identitySnippet}</code></pre></details></section>
    {site.slackPendingCount || site.slackBlockedCount || site.githubPendingCount || site.githubBlockedCount ? <div className="widget-delivery-health"><span>GitHub {site.githubPendingCount ?? 0} pending · {site.githubBlockedCount ?? 0} blocked · Slack {site.slackPendingCount ?? 0} pending · {site.slackBlockedCount ?? 0} blocked</span>{site.githubLastError || site.slackLastError ? <small>{site.githubLastError || site.slackLastError}</small> : null}{isAdmin ? <button className="mini-button" disabled={retry.isPending} onClick={() => retry.mutate()}>{retry.isPending ? "Retrying…" : "Retry deliveries"}</button> : null}</div> : null}
    {isAdmin ? <div className="widget-slack-route"><label>Slack destination<select value={slackDraft} disabled={!connection} onChange={(event) => setSlackDraft(event.target.value)}><option value="">Use organization fallback</option>{(channels.data?.channels ?? []).filter((channel) => !channel.is_archived).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></label><button className="button" disabled={update.isPending || slackDraft === (site.slackChannelId ?? "")} onClick={() => update.mutate({ slackChannelId: slackDraft || null, slackConnectionId: slackDraft ? connection?.id : null })}>Save Slack route</button><button className="button" disabled={!slackDraft || testSlack.isPending} onClick={() => testSlack.mutate()}>{testSlack.isPending ? "Testing…" : "Send test"}</button>{testSlack.isSuccess ? <small role="status">Test delivered.</small> : testSlack.error ? <small role="alert">{testSlack.error.message}</small> : null}</div> : null}
    {isAdmin ? <><div className="widget-project-route"><label>Owning project<select aria-label={`Owning project for ${site.name}`} value={projectDraft} disabled={update.isPending} onChange={(event) => setProjectDraft(event.target.value)}>{compatibleProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button type="button" className="button" disabled={update.isPending || projectDraft === site.projectId} onClick={() => {
      const target = projects.find((project) => project.id === projectDraft);
      void confirm({ title: "Move capture site?", detail: `${site.name} and its existing reports will move to ${target?.name ?? projectDraft}. It will disappear from this project's Widgets page.`, confirmLabel: "Move site", destructive: false }).then((confirmed) => { if (confirmed) update.mutate({ projectId: projectDraft }); });
    }}>Move site</button></div><WidgetEditor key={`${site.id}:${site.updatedAt ?? ""}`} site={site} pending={update.isPending} error={update.error} onSave={(body) => update.mutate(body)} /><button type="button" className="mini-button destructive widget-delete" disabled={remove.isPending} onClick={() => void confirm({ title: "Delete capture site?", detail: `${site.name} will stop loading and its stored screenshots will be removed.`, confirmLabel: "Delete site", destructive: true }).then((confirmed) => { if (confirmed) remove.mutate(); })}>{remove.isPending ? "Deleting…" : "Delete capture site"}</button></> : null}
    {confirmation}
  </article>;
}

function WidgetEditor({ site, pending, error, onSave }: { site: WidgetSite; pending: boolean; error: unknown; onSave: (body: unknown) => void }) {
  const [lifecycle, setLifecycle] = useState<"draft" | "ready" | "disabled">(site.lifecycle || "ready");
  const [widgetMode, setWidgetMode] = useState(site.widgetMode || "development");
  const [autoErrorLogging, setAutoErrorLogging] = useState(site.autoErrorLogging === true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(site.dailySummaryEnabled !== false);
  const [launcher, setLauncher] = useState<LauncherConfig>(() => ({
    desktop: { ...(site.launcher?.desktop ?? DEFAULT_LAUNCHER.desktop) },
    mobile: { ...(site.launcher?.mobile ?? DEFAULT_LAUNCHER.mobile) },
  }));
  const [environments, setEnvironments] = useState<WidgetEnvironment[]>(() => (site.environments ?? []).map((environment) => ({ ...environment })));
  const [blocks, setBlocks] = useState<WidgetBlock[]>(() => (site.blocks ?? []).map((block) => ({ ...block })));
  const validEnvironments = environments.every((environment) => environment.name.trim() && environment.url.trim())
    && new Set(environments.map((environment) => environment.name.trim().toLowerCase())).size === environments.length;
  return <details className="widget-editor">
    <summary>Behavior and allowed environments <span>⌄</span></summary>
    <form onSubmit={(event) => { event.preventDefault(); onSave({ lifecycle, widgetMode, launcher, autoErrorLogging, dailySummaryEnabled, environments, blocks }); }}>
      <p className="widget-warning">Button text and accent color now come from Settings → Branding.</p>
      <div className="widget-fields">
        <label>Availability<select value={lifecycle} onChange={(event) => setLifecycle(event.target.value as "draft" | "ready" | "disabled")}><option value="draft">Draft — setup only</option><option value="ready">Ready — accept reports</option><option value="disabled">Disabled</option></select></label>
        <label>Reporter experience<select value={widgetMode} onChange={(event) => setWidgetMode(event.target.value as "development" | "release")}><option value="development">Development</option><option value="release">Release</option></select></label>
        <label className="widget-check"><input type="checkbox" checked={autoErrorLogging} onChange={(event) => setAutoErrorLogging(event.target.checked)} /> Automatically report browser errors</label>
        <label className="widget-check"><input type="checkbox" checked={dailySummaryEnabled} onChange={(event) => setDailySummaryEnabled(event.target.checked)} /> Send daily Slack summary</label>
      </div>
      <div className="widget-environments widget-launcher-settings">
        <header><div><b>Launcher</b><p>Choose the trigger shape and screen edge independently for desktop and mobile.</p></div></header>
        <div className="widget-environment">
          <b>Desktop</b>
          <label>Style<select aria-label="Desktop launcher style" value={launcher.desktop.style} onChange={(event) => setLauncher((current) => ({ ...current, desktop: { ...current.desktop, style: event.target.value as LauncherStyle } }))}><option value="tab">Side tab</option><option value="button">Round button</option></select></label>
          <label>Position<select aria-label="Desktop launcher position" value={launcher.desktop.position} onChange={(event) => setLauncher((current) => ({ ...current, desktop: { ...current.desktop, position: event.target.value as LauncherPosition } }))}>{LAUNCHER_POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></label>
        </div>
        <div className="widget-environment">
          <b>Mobile</b>
          <label>Style<select aria-label="Mobile launcher style" value={launcher.mobile.style} onChange={(event) => setLauncher((current) => ({ ...current, mobile: { ...current.mobile, style: event.target.value as LauncherStyle } }))}><option value="button">Round button</option><option value="tab">Side tab</option></select></label>
          <label>Position<select aria-label="Mobile launcher position" value={launcher.mobile.position} onChange={(event) => setLauncher((current) => ({ ...current, mobile: { ...current.mobile, position: event.target.value as LauncherPosition } }))}>{LAUNCHER_POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></label>
        </div>
      </div>
      <div className="widget-environments widget-blocks">
        <header><div><b>Feedback form</b><p>Choose what the capture widget asks. A custom form always needs one required description.</p></div><button type="button" onClick={() => setBlocks((current) => current.length ? [...current, { id: `field-${Date.now()}`, type: "custom_text", label: "Additional detail", required: false }] : [{ id: "description", type: "description", label: "What happened?", required: true }])}>{blocks.length ? "Add field" : "Customize form"}</button></header>
        {blocks.map((block, index) => <div className="widget-environment" key={block.id}><label>Field type<select value={block.type} onChange={(event) => setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as WidgetBlock["type"], required: event.target.value === "description" ? true : item.required } : item))}><option value="description">Description</option><option value="title">Title</option><option value="reporter">Reporter</option><option value="contact_email">Contact email</option><option value="category">Category</option><option value="custom_text">Short text</option><option value="custom_textarea">Long text</option><option value="element_picker">Element picker</option><option value="metadata">Metadata</option><option value="console_logs">Console logs</option></select></label><label>Label<input value={block.label ?? ""} maxLength={120} onChange={(event) => setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></label><label className="widget-check"><input type="checkbox" checked={block.required === true} disabled={block.type === "description"} onChange={(event) => setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} /> Required</label><button type="button" className="widget-remove" disabled={block.type === "description"} onClick={() => setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}
      </div>
      <div className="widget-environments">
        <header><div><b>Allowed environments</b><p>When present, the widget only works on these exact origins.</p></div><button type="button" onClick={() => setEnvironments((current) => [...current, { name: `Environment ${current.length + 1}`, url: "", enabled: true }])}>Add environment</button></header>
        {environments.length === 0 ? <p className="widget-warning">Add an allowed environment before making this site ready.</p> : environments.map((environment, index) => <div className="widget-environment" key={index}>
          <label>Name<input value={environment.name} maxLength={60} onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, name: event.target.value } : item))} /></label>
          <label>Origin<input value={environment.url} maxLength={500} placeholder="https://app.example.com" onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, url: event.target.value } : item))} /></label>
          <label className="widget-check"><input type="checkbox" checked={environment.enabled !== false} onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, enabled: event.target.checked } : item))} /> Enabled</label>
          <label>Capture<select aria-label={`${environment.name} capture mode`} value={environment.captureMode ?? "dom"} onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, captureMode: event.target.value as "screenshot" | "dom" } : item))}><option value="dom">Screenshot + DOM selector</option><option value="screenshot">Screenshot only</option></select></label>
          <button type="button" className="widget-remove" onClick={() => setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button>
        </div>)}
      </div>
      {!validEnvironments ? <small role="alert">Every environment needs a unique name and an origin.</small> : null}
      {error ? <small role="alert">{error instanceof Error ? error.message : "The widget settings could not be saved."}</small> : null}
      <button className="button" disabled={pending || !validEnvironments || (lifecycle === "ready" && !environments.some((environment) => environment.enabled !== false))}>{pending ? "Saving…" : "Save widget settings"}</button>
    </form>
  </details>;
}

function deliveryIssueLabel(issue: string) {
  return ({
    site_draft: "Site is still a draft",
    site_disabled: "Site is disabled",
    project_unavailable: "Active project missing",
    repository_mismatch: "Project repository does not match",
    github_not_connected: "GitHub is not connected",
    github_delivery_degraded: "GitHub delivery is blocked",
    origin_not_configured: "No allowed origin",
    slack_channel_not_configured: "Slack channel missing",
    slack_not_connected: "Slack is not connected",
    slack_connection_degraded: "Slack connection needs attention",
    slack_channel_unavailable: "Slack channel is unavailable",
    slack_delivery_degraded: "Slack delivery is blocked",
  } as Record<string, string>)[issue] ?? issue.replaceAll("_", " ");
}

function WidgetState({ title, detail, action }: { title: string; detail: string; action?: () => void }) {
  return <div className="empty-view" role="status"><h2>{title}</h2><p>{detail}</p>{action ? <button type="button" className="button" onClick={action}>Retry</button> : null}</div>;
}
