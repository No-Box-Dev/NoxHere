import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getRawJsonWithHeaders, patchRawJson, postRawJson } from "../../api/http";
import { platformApi } from "../../api/platform";

const ROUTES = [
  ["noxfeed_posts", "Activity posts"],
  ["noxfeed_release_notes", "Release notes"],
  ["noxfeed_daily_summary", "Daily summary"],
] as const;

type FeedConfig = { revision: string; config: { releaseNotesPrompt?: string | null } };

export function NoxFeedSettings({ organizationId, projectId, isAdmin }: { organizationId: string; projectId: string; isAdmin: boolean }) {
  const scope = { organizationId, projectId };
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const config = useQuery({ queryKey: ["feed-config", organizationId, projectId], queryFn: async ({ signal }) => { const result = await getRawJsonWithHeaders<FeedConfig>("/api/v1/services/noxfeed/config", signal, scope); return { ...result.data, etag: result.headers.get("ETag") ?? `"${result.data.revision}"` }; } });
  const routing = useQuery({ queryKey: ["feed-routing", organizationId, projectId], queryFn: ({ signal }) => platformApi.slackRouting(organizationId, projectId, signal), enabled: isAdmin });
  const status = useQuery({ queryKey: ["feed-slack", organizationId, projectId], queryFn: ({ signal }) => platformApi.slackStatus(organizationId, projectId, signal), enabled: isAdmin });
  const connection = status.data?.connections.find((item) => item.projectId === projectId) ?? status.data?.connections.find((item) => item.id === status.data?.defaultConnectionId) ?? status.data?.connections[0];
  const channels = useQuery({ queryKey: ["feed-channels", organizationId, projectId, connection?.id], queryFn: ({ signal }) => platformApi.slackChannels(organizationId, projectId, connection?.id ?? "", signal), enabled: Boolean(connection?.id) });
  const saveRoute = useMutation({ mutationFn: ({ route, channelId }: { route: string; channelId: string | null }) => patchRawJson("/api/v1/integrations/slack/routing", { routes: { [route]: channelId }, connections: { [route]: channelId ? connection?.id : null } }, {}, scope), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed-routing", organizationId, projectId] }) });
  const testRoute = useMutation({ mutationFn: (route: string) => postRawJson("/api/v1/integrations/slack/test", { route }, scope) });
  const backfill = useMutation({ mutationFn: () => postRawJson(`/api/v1/projects/${encodeURIComponent(projectId)}/backfill-prs`, { days }, scope) });
  if (!isAdmin) return <div className="empty-view"><h2>Admin access required</h2><p>Only administrators can change Activity delivery and generation settings.</p></div>;
  return <div className="settings-stack feed-settings">
    <section className="settings-card"><header><div><b>Slack delivery</b><p>Choose independent destinations for posts, release notes, and the daily summary.</p></div></header>{status.data?.connected ? <div className="feed-route-list">{ROUTES.map(([route, label]) => <label key={route}><span>{label}</span><select value={(routing.data?.routes as Record<string, string | null> | undefined)?.[route] ?? ""} disabled={!connection || saveRoute.isPending} onChange={(event) => saveRoute.mutate({ route, channelId: event.target.value || null })}><option value="">Disabled</option>{(channels.data?.channels ?? []).filter((channel) => !channel.is_archived).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select><button type="button" className="mini-button" disabled={!(routing.data?.routes as Record<string, string | null> | undefined)?.[route] || testRoute.isPending} onClick={() => testRoute.mutate(route)}>Test</button></label>)}</div> : <p>Connect Slack in Integrations before choosing channels.</p>}</section>
    {config.data ? <FeedPromptEditor key={config.data.revision} initial={config.data.config.releaseNotesPrompt ?? ""} etag={config.data.etag} scope={scope} onSaved={() => queryClient.invalidateQueries({ queryKey: ["feed-config", organizationId, projectId] })} /> : <section className="settings-card"><p>{config.isError ? "Release-note settings could not be loaded." : "Loading release-note settings…"}</p></section>}
    <section className="settings-card"><header><div><b>Backfill pull-request narratives</b><p>Generate missing summaries for recently merged pull requests.</p></div></header><div className="maintenance-actions"><label>Look back<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label><button className="button" disabled={backfill.isPending} onClick={() => backfill.mutate()}>{backfill.isPending ? "Queuing…" : "Start backfill"}</button></div>{backfill.isSuccess ? <p role="status">Backfill queued.</p> : null}{backfill.error ? <small role="alert">{backfill.error.message}</small> : null}</section>
  </div>;
}

function FeedPromptEditor({ initial, etag, scope, onSaved }: { initial: string; etag: string; scope: { organizationId: string; projectId: string }; onSaved: () => Promise<unknown> }) {
  const [prompt, setPrompt] = useState(initial);
  const save = useMutation({ mutationFn: () => patchRawJson<FeedConfig>("/api/v1/services/noxfeed/config", { releaseNotesPrompt: prompt.trim() || null }, { "If-Match": etag }, scope), onSuccess: () => void onSaved() });
  return <section className="settings-card"><header><div><b>Release-note instructions</b><p>Optional project-specific guidance used when NoxFeed writes release notes.</p></div></header><textarea rows={8} maxLength={20_000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Focus on customer impact and avoid implementation detail." /><button className="button primary-button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save instructions"}</button>{save.error ? <small role="alert">{save.error.message}</small> : null}</section>;
}
