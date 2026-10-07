import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getRawJson, patchRawJson, postRawJson, type RequestScope } from "../../api/http";

type WidgetEnvironment = {
  name: string;
  url: string;
  buttonColor?: string | null;
  buttonText?: string | null;
  widgetMode?: "development" | "release" | null;
  enabled?: boolean;
};

type WidgetSite = {
  id: string;
  name: string;
  repo?: string | null;
  buttonColor?: string;
  buttonText?: string;
  widgetMode?: "development" | "release";
  autoErrorLogging?: boolean;
  environments?: WidgetEnvironment[];
  openIssueCount?: number;
  issueCount?: number;
  updatedAt?: string;
};

type SitesResponse = { sites?: WidgetSite[] };

export function NoxSpotWidgets({ organizationId, projectId, isAdmin }: { organizationId: string; projectId: string; isAdmin: boolean }) {
  const scope = { organizationId, projectId };
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["spot-sites", organizationId, projectId],
    queryFn: async ({ signal }) => (await getRawJson("/api/v1/spots/sites", signal, scope) as SitesResponse).sites ?? [],
  });
  const create = useMutation({
    mutationFn: (name: string) => postRawJson("/api/v1/spots/sites", { name }, scope),
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
    {sites.length ? <div className="widget-site-list">{sites.map((site) => <WidgetSiteCard key={site.id} site={site} scope={scope} isAdmin={isAdmin} />)}</div>
      : <WidgetState title="No capture sites yet" detail={isAdmin ? "Add a site to generate its install code." : "An administrator needs to add a capture site for this project."} />}
  </div>;
}

function WidgetSiteCard({ site, scope, isAdmin }: { site: WidgetSite; scope: RequestScope; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="https://api.noxspot.dev/widget/${site.id}.js" defer></script>`;
  const update = useMutation({
    mutationFn: (body: unknown) => patchRawJson(`/api/v1/spots/sites/${encodeURIComponent(site.id)}`, body, {}, scope),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spot-sites", scope.organizationId, scope.projectId] }),
  });
  return <article className="widget-site-card">
    <header><div><h3>{site.name}</h3><p>{site.repo || "Project capture site"} · {site.openIssueCount ?? 0} open · {site.issueCount ?? 0} total</p></div><span className="widget-health">Configured</span></header>
    <section className="widget-install"><b>Install code</b><p>Place this before <code>&lt;/body&gt;</code> in the top-level page.</p><div><code>{snippet}</code><button type="button" onClick={async () => {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }}>{copied ? "Copied" : "Copy"}</button></div></section>
    {isAdmin ? <WidgetEditor key={`${site.id}:${site.updatedAt ?? ""}`} site={site} pending={update.isPending} error={update.error} onSave={(body) => update.mutate(body)} /> : null}
  </article>;
}

function WidgetEditor({ site, pending, error, onSave }: { site: WidgetSite; pending: boolean; error: unknown; onSave: (body: unknown) => void }) {
  const [buttonText, setButtonText] = useState(site.buttonText || "Report issue");
  const [buttonColor, setButtonColor] = useState(site.buttonColor || "#FE795D");
  const [widgetMode, setWidgetMode] = useState(site.widgetMode || "development");
  const [autoErrorLogging, setAutoErrorLogging] = useState(site.autoErrorLogging === true);
  const [environments, setEnvironments] = useState<WidgetEnvironment[]>(() => (site.environments ?? []).map((environment) => ({ ...environment })));
  const validEnvironments = environments.every((environment) => environment.name.trim() && environment.url.trim())
    && new Set(environments.map((environment) => environment.name.trim().toLowerCase())).size === environments.length;
  return <details className="widget-editor">
    <summary>Behavior and allowed environments <span>⌄</span></summary>
    <form onSubmit={(event) => { event.preventDefault(); onSave({ buttonText, buttonColor, widgetMode, autoErrorLogging, environments }); }}>
      <div className="widget-fields">
        <label>Button text<input value={buttonText} required maxLength={40} onChange={(event) => setButtonText(event.target.value)} /></label>
        <label>Button color<input type="color" value={buttonColor} onChange={(event) => setButtonColor(event.target.value)} /></label>
        <label>Reporter experience<select value={widgetMode} onChange={(event) => setWidgetMode(event.target.value as "development" | "release")}><option value="development">Development</option><option value="release">Release</option></select></label>
        <label className="widget-check"><input type="checkbox" checked={autoErrorLogging} onChange={(event) => setAutoErrorLogging(event.target.checked)} /> Automatically report browser errors</label>
      </div>
      <div className="widget-environments">
        <header><div><b>Allowed environments</b><p>When present, the widget only works on these exact origins.</p></div><button type="button" onClick={() => setEnvironments((current) => [...current, { name: `Environment ${current.length + 1}`, url: "", enabled: true }])}>Add environment</button></header>
        {environments.length === 0 ? <p className="widget-warning">Compatibility mode: all origins are accepted.</p> : environments.map((environment, index) => <div className="widget-environment" key={index}>
          <label>Name<input value={environment.name} maxLength={60} onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, name: event.target.value } : item))} /></label>
          <label>Origin<input value={environment.url} maxLength={500} placeholder="https://app.example.com" onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, url: event.target.value } : item))} /></label>
          <label className="widget-check"><input type="checkbox" checked={environment.enabled !== false} onChange={(event) => setEnvironments((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, enabled: event.target.checked } : item))} /> Enabled</label>
          <button type="button" className="widget-remove" onClick={() => setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button>
        </div>)}
      </div>
      {!validEnvironments ? <small role="alert">Every environment needs a unique name and an origin.</small> : null}
      {error ? <small role="alert">{error instanceof Error ? error.message : "The widget settings could not be saved."}</small> : null}
      <button className="button" disabled={pending || !validEnvironments}>{pending ? "Saving…" : "Save widget settings"}</button>
    </form>
  </details>;
}

function WidgetState({ title, detail, action }: { title: string; detail: string; action?: () => void }) {
  return <div className="empty-view" role="status"><h2>{title}</h2><p>{detail}</p>{action ? <button type="button" className="button" onClick={action}>Retry</button> : null}</div>;
}
