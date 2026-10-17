import { useState } from "react";
import type { ProjectSettings } from "../../api/contracts";

type Branding = NonNullable<ProjectSettings["branding"]>;

const FONT_OPTIONS: Array<{ value: Branding["fontPreset"]; label: string }> = [
  { value: "system", label: "System" },
  { value: "playnist", label: "Playnist" },
  { value: "humanist", label: "Humanist" },
  { value: "editorial", label: "Editorial" },
  { value: "mono", label: "Monospace" },
];

export function BrandingSettings({ projectName, settings, saving, error, canManage, onSave }: {
  projectName: string;
  settings: ProjectSettings;
  saving: boolean;
  error: Error | null;
  canManage: boolean;
  onSave: (branding: Branding) => void;
}) {
  const current = settings.branding;
  const [name, setName] = useState(current?.name ?? projectName);
  const [logoUrl, setLogoUrl] = useState(current?.logoUrl ?? "");
  const [accentColor, setAccentColor] = useState(current?.accentColor ?? "#FE795D");
  const [buttonText, setButtonText] = useState(current?.buttonText ?? "Report issue");
  const [fontPreset, setFontPreset] = useState<Branding["fontPreset"]>(current?.fontPreset ?? "system");
  const valid = Boolean(name.trim() && buttonText.trim() && /^#[0-9a-fA-F]{6}$/.test(accentColor)
    && (!logoUrl.trim() || /^https:\/\//i.test(logoUrl.trim())));

  return <form className="settings-card branding-settings" onSubmit={(event) => {
    event.preventDefault();
    if (!valid) return;
    onSave({ name: name.trim(), logoUrl: logoUrl.trim() || null, accentColor: accentColor.toUpperCase(), buttonText: buttonText.trim(), fontPreset });
  }}>
    <header><div><b>Shared product identity</b><p>The Feedback widget uses this accent and button label. Other customer-facing surfaces can reuse the same agent-readable configuration.</p></div><span className="branding-preview-dot" style={{ background: accentColor }} aria-hidden="true" /></header>
    <div className="settings-form-grid">
      <label>Product name<input value={name} required maxLength={120} disabled={!canManage || saving} onChange={(event) => setName(event.target.value)} /></label>
      <label>Logo URL <small>Optional HTTPS image</small><input type="url" inputMode="url" placeholder="https://example.com/logo.svg" value={logoUrl} maxLength={2048} disabled={!canManage || saving} onChange={(event) => setLogoUrl(event.target.value)} /></label>
      <label>Accent color<span className="branding-color-input"><input type="color" aria-label="Brand accent color" value={accentColor} disabled={!canManage || saving} onChange={(event) => setAccentColor(event.target.value)} /><input aria-label="Brand accent hex value" value={accentColor} pattern="#[0-9a-fA-F]{6}" maxLength={7} disabled={!canManage || saving} onChange={(event) => setAccentColor(event.target.value)} /></span></label>
      <label>Widget button text<input value={buttonText} required maxLength={40} disabled={!canManage || saving} onChange={(event) => setButtonText(event.target.value)} /></label>
      <label>Font style<select value={fontPreset} disabled={!canManage || saving} onChange={(event) => setFontPreset(event.target.value as Branding["fontPreset"])}>{FONT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
    </div>
    {!valid ? <p className="form-error" role="alert">Add a name, valid hex accent, button text, and an HTTPS logo URL when using a logo.</p> : null}
    {error ? <p className="form-error" role="alert">{error.message}</p> : null}
    <div><button className="button" disabled={!canManage || saving || !valid}>{saving ? "Saving…" : "Save branding"}</button></div>
  </form>;
}
