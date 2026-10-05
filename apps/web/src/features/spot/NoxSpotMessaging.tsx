import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRawJson, getRawJsonWithHeaders, patchRawJson, postRawJson } from "../../api/http";

type FontPreset = "system" | "playnist" | "humanist" | "editorial" | "mono";
type ResolutionTemplate = {
  tone: "default" | "warm" | "formal" | "concise";
  senderName: string;
  subject: string;
  acknowledgement: string;
  reopenText: string;
  buttonLabel: string;
  closing: string;
  replyTo: string | null;
  appearance: {
    accentColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    mutedColor: string;
    fontPreset: FontPreset;
  };
};
type TemplateDocument = { template: ResolutionTemplate; defaults: ResolutionTemplate; usingDefault: boolean; revision: string };
type Preview = ResolutionTemplate & { siteName: string; greeting: string; summary: string };
type Site = { id: string; name: string; projectId: string | null };

const fontOptions: Array<{ value: FontPreset; label: string }> = [
  { value: "system", label: "Clean sans serif" },
  { value: "playnist", label: "Playnist display + sans" },
  { value: "humanist", label: "Friendly humanist" },
  { value: "editorial", label: "Editorial serif" },
  { value: "mono", label: "Monospace" },
];
const previewFonts: Record<FontPreset, { heading: string; body: string }> = {
  system: { heading: "Arial, Helvetica, sans-serif", body: "Arial, Helvetica, sans-serif" },
  playnist: { heading: '"HF Gesco Bold", Georgia, serif', body: '"IBM Plex Sans Variable", Arial, sans-serif' },
  humanist: { heading: '"Trebuchet MS", Arial, sans-serif', body: '"Trebuchet MS", Arial, sans-serif' },
  editorial: { heading: 'Georgia, "Times New Roman", serif', body: 'Georgia, "Times New Roman", serif' },
  mono: { heading: '"Courier New", monospace', body: '"Courier New", monospace' },
};

export function NoxSpotMessaging({ organizationId, projectId, isAdmin }: { organizationId: string; projectId: string; isAdmin: boolean }) {
  const scope = useMemo(() => ({ organizationId, projectId }), [organizationId, projectId]);
  const client = useQueryClient();
  const sites = useQuery({
    queryKey: ["spot-sites", organizationId, projectId],
    queryFn: async ({ signal }) => (await getRawJson("/api/v1/spots/sites", signal, scope) as { sites?: Site[] }).sites ?? [],
    enabled: isAdmin,
  });
  const [selectedSiteOverride, setSelectedSiteOverride] = useState("");
  const selectedSiteId = selectedSiteOverride || sites.data?.[0]?.id || "";
  const template = useQuery({
    queryKey: ["spot-resolution-template", organizationId, projectId, selectedSiteId],
    queryFn: async ({ signal }) => (await getRawJsonWithHeaders<TemplateDocument>(`/api/v1/spots/sites/${encodeURIComponent(selectedSiteId)}/resolution-template`, signal, scope)).data,
    enabled: isAdmin && Boolean(selectedSiteId),
  });
  const [draftOverride, setDraftOverride] = useState<ResolutionTemplate | null>(null);
  const draft = draftOverride ?? template.data?.template ?? null;
  const save = useMutation({
    mutationFn: (next: ResolutionTemplate | null) => patchRawJson<TemplateDocument>(
      `/api/v1/spots/sites/${encodeURIComponent(selectedSiteId)}/resolution-template`,
      { template: next },
      { "If-Match": `"${template.data?.revision ?? ""}"` },
      scope,
    ),
    onSuccess: (document) => {
      client.setQueryData(["spot-resolution-template", organizationId, projectId, selectedSiteId], document);
      setDraftOverride(null);
    },
  });
  const preview = useMutation({
    mutationFn: (next: ResolutionTemplate) => postRawJson<{ preview: Preview }>(`/api/v1/spots/sites/${encodeURIComponent(selectedSiteId)}/resolution-template/preview`, { template: next }, scope),
  });
  const [testRecipient, setTestRecipient] = useState("");
  const test = useMutation({
    mutationFn: ({ recipient, next }: { recipient: string; next: ResolutionTemplate }) => postRawJson<{ ok: true; messageId: string }>(`/api/v1/spots/sites/${encodeURIComponent(selectedSiteId)}/resolution-template/test`, { recipient, template: next }, scope),
  });

  if (!isAdmin) return <Empty title="Admin access required" detail="An organization admin can configure the shared resolution-email brand for this project." />;
  if (sites.isLoading) return <Empty title="Loading messaging" detail="Reading your feedback sites and resolution-email settings…" />;
  if (sites.isError) return <Empty title="Messaging is unavailable" detail="The feedback settings API could not be reached. Try again shortly." />;
  if (!sites.data?.length) return <Empty title="No feedback site yet" detail="Create a widget site first, then its resolution email can be branded here." />;
  if (!draft || !template.data) return <Empty title="Loading email template" detail="Reading the selected site's saved template…" />;

  const update = <K extends keyof ResolutionTemplate>(key: K, value: ResolutionTemplate[K]) => setDraftOverride({ ...draft, [key]: value });
  const updateAppearance = <K extends keyof ResolutionTemplate["appearance"]>(key: K, value: ResolutionTemplate["appearance"][K]) => setDraftOverride({ ...draft, appearance: { ...draft.appearance, [key]: value } });
  const error = save.error || preview.error || test.error;
  return <div className="messaging-layout">
    <section className="messaging-panel">
      <header className="messaging-heading"><div><span className="eyebrow">Resolution email</span><h2>Reporter messaging</h2><p>Customize the content and brand for this site. NoxConnect keeps the verified sender, fix evidence, AI safety rules, and reopen flow protected.</p></div><StatusBadge custom={!template.data.usingDefault} /></header>
      {sites.data.length > 1 ? <label className="field-label">Feedback site<select value={selectedSiteId} onChange={(event) => { setSelectedSiteOverride(event.target.value); setDraftOverride(null); }}>{sites.data.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label> : null}
      <div className="messaging-grid">
        <label className="field-label">Tone<select value={draft.tone} onChange={(event) => update("tone", event.target.value as ResolutionTemplate["tone"])}><option value="default">Warm and direct</option><option value="warm">Warm and reassuring</option><option value="formal">Professional and formal</option><option value="concise">As concise as possible</option></select></label>
        <label className="field-label">Sender name<input value={draft.senderName} maxLength={80} required onChange={(event) => update("senderName", event.target.value)} /></label>
        <label className="field-label full">Reply-to email<input type="email" value={draft.replyTo ?? ""} placeholder="support@example.com" onChange={(event) => update("replyTo", event.target.value.trim() || null)} /></label>
        <label className="field-label full">Subject<input value={draft.subject} maxLength={200} required onChange={(event) => update("subject", event.target.value)} /></label>
        <label className="field-label full">Opening acknowledgement<textarea value={draft.acknowledgement} maxLength={500} required onChange={(event) => update("acknowledgement", event.target.value)} /></label>
        <label className="field-label full">Reopen explanation<textarea value={draft.reopenText} maxLength={500} required onChange={(event) => update("reopenText", event.target.value)} /></label>
        <label className="field-label">Button label<input value={draft.buttonLabel} maxLength={60} required onChange={(event) => update("buttonLabel", event.target.value)} /></label>
        <label className="field-label">Final thank-you<input value={draft.closing} maxLength={500} required onChange={(event) => update("closing", event.target.value)} /></label>
      </div>
      <fieldset className="brand-fields"><legend>Brand appearance</legend><div className="messaging-grid">
        <label className="field-label full">Font style<select value={draft.appearance.fontPreset} onChange={(event) => updateAppearance("fontPreset", event.target.value as FontPreset)}>{fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <ColorField label="Brand / button" value={draft.appearance.accentColor} onChange={(value) => updateAppearance("accentColor", value)} />
        <ColorField label="Email background" value={draft.appearance.backgroundColor} onChange={(value) => updateAppearance("backgroundColor", value)} />
        <ColorField label="Card background" value={draft.appearance.surfaceColor} onChange={(value) => updateAppearance("surfaceColor", value)} />
        <ColorField label="Main text" value={draft.appearance.textColor} onChange={(value) => updateAppearance("textColor", value)} />
        <ColorField label="Muted text" value={draft.appearance.mutedColor} onChange={(value) => updateAppearance("mutedColor", value)} />
      </div><small>Email clients may substitute their nearest installed font; every option includes reliable fallbacks.</small></fieldset>
      <p className="messaging-variables">Available variables: <code>{"{{report_title}}"}</code> and <code>{"{{site_name}}"}</code>.</p>
      <div className="messaging-actions"><button className="button primary-button" disabled={save.isPending} onClick={() => save.mutate(draft)}>{save.isPending ? "Saving…" : "Save template"}</button><button className="button" disabled={preview.isPending} onClick={() => preview.mutate(draft)}>{preview.isPending ? "Preparing…" : "Preview"}</button><button className="button" disabled={save.isPending} onClick={() => save.mutate(null)}>Reset to default</button></div>
      <div className="test-email"><label className="field-label">Send a test through the normal email flow<input type="email" value={testRecipient} placeholder="you@example.com" onChange={(event) => setTestRecipient(event.target.value)} /></label><button className="button" disabled={test.isPending || !testRecipient.trim()} onClick={() => test.mutate({ recipient: testRecipient.trim(), next: draft })}>{test.isPending ? "Sending…" : test.isSuccess ? "Sent" : "Send test"}</button></div>
      {error ? <p className="messaging-error">{error instanceof Error ? error.message : "Template request failed"}</p> : null}
    </section>
    <EmailPreview preview={preview.data?.preview ?? { ...draft, siteName: sites.data.find((site) => site.id === selectedSiteId)?.name ?? "Your site", greeting: "Hi Alex,", summary: "We found the cause and updated the affected behavior. You should now be able to complete the action normally." }} />
  </div>;
}

function StatusBadge({ custom }: { custom: boolean }) { return <span className={`status-tag ${custom ? "positive" : ""}`}>{custom ? "Custom" : "Default"}</span>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="empty-view" role="status"><h2>{title}</h2><p>{detail}</p></div>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field-label">{label}<span className="color-field"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} /><input aria-label={`${label} hex value`} value={value} pattern="^#[0-9A-Fa-f]{6}$" maxLength={7} onChange={(event) => onChange(event.target.value.toUpperCase())} /></span></label>; }
function EmailPreview({ preview }: { preview: Preview }) {
  const fonts = previewFonts[preview.appearance.fontPreset];
  return <aside className="email-preview"><span className="eyebrow">Live preview</span><div className="email-subject"><b>Subject</b><span>{preview.subject}</span></div><div className="email-canvas" style={{ background: preview.appearance.backgroundColor, fontFamily: fonts.body }}><div className="email-card" style={{ background: preview.appearance.surfaceColor, borderColor: preview.appearance.textColor, boxShadow: `4px 4px 0 ${preview.appearance.accentColor}`, color: preview.appearance.textColor }}><header style={{ color: preview.appearance.accentColor, fontFamily: fonts.heading }}>{preview.siteName} <small style={{ color: preview.appearance.mutedColor, fontFamily: fonts.body }}>via NoxConnect</small></header><p>{preview.greeting}</p><p>{preview.acknowledgement}</p>{preview.summary.split(/\n\s*\n/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>{preview.reopenText}</p><span className="email-button" style={{ background: preview.appearance.accentColor, color: contrastingText(preview.appearance.accentColor) }}>{preview.buttonLabel}</span><p>{preview.closing}</p></div></div></aside>;
}
function contrastingText(hex: string) { const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#000000" : "#FFFFFF"; }
