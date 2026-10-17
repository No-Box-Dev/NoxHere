import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { deleteRawJson, getRawJson, postRawJson } from "../../api/http";
import { useConfirmDialog } from "../../components/ConfirmDialog";

type TokenRecord = {
  id: string; name: string; environment: "production" | "staging" | "test"; projectId: string; projectName?: string | null;
  prefix: string; scopes: string[]; createdAt: string; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null;
};
type TokenResponse = { tokens?: TokenRecord[] };
type SecretResponse = { token: string; warning: string };
const TOKEN_PRESETS = {
  "Server write": ["growth:ingest", "usage:ingest", "slack:send", "developer-feedback:write"],
  "Ingest only": ["growth:ingest", "usage:ingest"],
  "Read only": ["services:read", "activity:read", "feedback:read", "growth:read", "usage:read", "issues:read"],
} as const;

export function ApiTokens({ organizationId, projectId, projectName, isAdmin }: { organizationId: string; projectId: string; projectName: string; isAdmin: boolean }) {
  const { confirm, confirmation } = useConfirmDialog();
  const scope = { organizationId, projectId };
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "test">("production");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [scopes, setScopes] = useState<string[]>(["services:read"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tokens = useQuery({ queryKey: ["api-tokens", organizationId], queryFn: ({ signal }) => getRawJson("/api/v1/api-tokens", signal, scope) as Promise<TokenResponse>, enabled: isAdmin });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["api-tokens", organizationId] });
  const create = useMutation({
    mutationFn: () => postRawJson<SecretResponse>("/api/v1/api-tokens", { name: name.trim(), environment, projectId, scopes, expiresInDays }, scope),
    onSuccess: (result) => { setSecret(result.token); setCopied(false); setName(""); void refresh(); },
  });
  const rotate = useMutation({ mutationFn: (id: string) => postRawJson<SecretResponse>(`/api/v1/api-tokens/${encodeURIComponent(id)}/rotate`, {}, scope), onSuccess: (result) => { setSecret(result.token); setCopied(false); void refresh(); } });
  const revoke = useMutation({ mutationFn: (id: string) => deleteRawJson(`/api/v1/api-tokens/${encodeURIComponent(id)}`, scope), onSuccess: refresh });
  const projectTokens = useMemo(() => (tokens.data?.tokens ?? []).filter((token) => token.projectId === projectId), [projectId, tokens.data]);
  const active = projectTokens.filter((token) => !token.revokedAt);
  const history = projectTokens.filter((token) => token.revokedAt);
  const scopedAccess = (service: string, choices: string[]) => choices.find((access) => scopes.includes(`${service}:${access}`)) ?? "none";
  const setScopedAccess = (service: string, access: string) => setScopes((current) => {
    const next = current.filter((value) => !value.startsWith(`${service}:`));
    return access === "none" ? next : [...next, `${service}:${access}`];
  });
  if (!isAdmin) return <div className="connect-empty"><b>Admin access required</b><p>Only an organization administrator can create or revoke automation credentials.</p></div>;
  return <div className="settings-stack">
    {secret ? <section className="secret-once"><b>Copy this token now</b><p>It is shown once and cannot be recovered.</p><div><code>{secret}</code><button type="button" className="button" onClick={() => void navigator.clipboard.writeText(secret).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button></div><button type="button" className="mini-button" onClick={() => setSecret(null)}>I stored it securely</button></section> : null}
    <section className="settings-card">
      <header><div><b>Create automation token</b><p>Scoped to {projectName}, with explicit capabilities and an expiry.</p></div></header>
      <div className="settings-form-grid"><label>Name<input value={name} maxLength={80} placeholder="CI production" onChange={(event) => setName(event.target.value)} /></label><label>Environment<select value={environment} onChange={(event) => setEnvironment(event.target.value as "production" | "staging" | "test")}><option value="production">Production</option><option value="staging">Staging</option><option value="test">Test</option></select></label><label>Expires<select value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option></select></label></div>
      <div className="button-row" aria-label="Token scope presets">{Object.entries(TOKEN_PRESETS).map(([label, presetScopes]) => <button type="button" className="mini-button" key={label} onClick={() => setScopes([...presetScopes])}>{label}</button>)}</div>
      <div className="scope-editor"><label><span>Service discovery</span><select value={scopes.includes("services:read") ? "read" : "none"} onChange={(event) => setScopes((current) => event.target.value === "read" ? [...new Set([...current, "services:read"])] : current.filter((value) => value !== "services:read"))}><option value="none">None</option><option value="read">Read</option></select></label><label><span>Developer feedback</span><select value={scopes.includes("developer-feedback:write") ? "write" : "none"} onChange={(event) => setScopes((current) => event.target.value === "write" ? [...new Set([...current, "developer-feedback:write"])] : current.filter((value) => value !== "developer-feedback:write"))}><option value="none">None</option><option value="write">Submit</option></select></label><label><span>Slack messages</span><select value={scopes.includes("slack:send") ? "send" : "none"} onChange={(event) => setScopedAccess("slack", event.target.value)}><option value="none">None</option><option value="send">Send</option></select></label><label><span>Activity</span><select value={scopedAccess("activity", ["write", "read"])} onChange={(event) => setScopedAccess("activity", event.target.value)}><option value="none">None</option><option value="read">Read</option><option value="write">Read + manage</option></select></label><label><span>Feedback</span><select value={scopedAccess("feedback", ["write", "read", "submit"])} onChange={(event) => setScopedAccess("feedback", event.target.value)}><option value="none">None</option><option value="submit">Submit reports</option><option value="read">Read</option><option value="write">Read + manage</option></select></label><label><span>Growth</span><select value={scopedAccess("growth", ["write", "read", "ingest"])} onChange={(event) => setScopedAccess("growth", event.target.value)}><option value="none">None</option><option value="ingest">Ingest events</option><option value="read">Read</option><option value="write">Read + manage</option></select></label><label><span>Usage</span><select value={scopedAccess("usage", ["write", "read", "ingest"])} onChange={(event) => setScopedAccess("usage", event.target.value)}><option value="none">None</option><option value="ingest">Ingest events</option><option value="read">Read</option><option value="write">Read + manage</option></select></label><label><span>Issues</span><select value={scopedAccess("issues", ["write", "read"])} onChange={(event) => setScopedAccess("issues", event.target.value)}><option value="none">None</option><option value="read">Read</option><option value="write">Read + manage</option></select></label></div>
      <button type="button" className="button primary-button" disabled={!name.trim() || !scopes.length || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create token"}</button>
      {create.error ? <small role="alert">{create.error.message}</small> : null}
    </section>
    <section className="settings-card"><header><div><b>Active tokens</b><p>Only prefixes and metadata remain visible after creation.</p></div><button type="button" className="mini-button" onClick={() => void tokens.refetch()}>Refresh</button></header>
      {tokens.isLoading ? <p>Loading tokens…</p> : tokens.isError ? <p role="alert">Could not load API tokens.</p> : active.length ? <div className="list-surface">{active.map((token) => <div className="list-row" key={token.id}><span className="row-symbol">K</span><span className="list-copy"><b>{token.name}</b><small><code>{token.prefix}…</code> · {token.environment} · expires {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "never"}<br />{token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleString()}` : "Never used"} · {token.scopes.join(", ")}</small></span><span className="list-meta"><button className="mini-button" disabled={rotate.isPending} onClick={() => void confirm({ title: "Rotate automation token?", detail: `${token.name} will receive a new secret and the current secret will stop working immediately.`, confirmLabel: "Rotate token" }).then((confirmed) => { if (confirmed) rotate.mutate(token.id); })}>Rotate</button><button className="mini-button destructive" disabled={revoke.isPending} onClick={() => void confirm({ title: "Revoke automation token?", detail: `${token.name} will stop working immediately.`, confirmLabel: "Revoke token", destructive: true }).then((confirmed) => { if (confirmed) revoke.mutate(token.id); })}>Revoke</button></span></div>)}</div> : <div className="connect-empty"><b>No active automation tokens</b><p>Create one when an internal service or automation needs API access.</p></div>}
    </section>
    {history.length ? <section className="settings-card"><header><div><b>Credential history</b><p>Revoked and rotated token metadata remains visible for auditing. Secrets are never retained.</p></div></header><div className="list-surface">{history.map((token) => <div className="list-row" key={token.id}><span className="row-symbol">K</span><span className="list-copy"><b>{token.name}</b><small><code>{token.prefix}…</code> · {token.environment} · revoked {new Date(token.revokedAt!).toLocaleString()}<br />{token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleString()}` : "Never used"} · {token.scopes.join(", ")}</small></span></div>)}</div></section> : null}
    {confirmation}
  </div>;
}
