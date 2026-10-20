import { DEFAULT_FEEDBACK_BLOCKS } from "../../../packages/contracts/feedback-defaults";
import {
  normalizeFeedbackLauncher,
  type FeedbackLauncherConfig,
} from "../../../packages/contracts/feedback-launcher";

export type WidgetMode = "development" | "release";
export type CaptureMode = "screenshot" | "dom";

export interface WidgetEnvironment {
  name: string;
  url: string;
  buttonColor?: string | null;
  buttonText?: string | null;
  widgetMode?: WidgetMode | null;
  captureMode?: CaptureMode | null;
  enabled?: boolean;
}

export interface WidgetBlock {
  id?: string;
  type?: string;
  environments?: string[];
  [key: string]: unknown;
}

export interface WidgetConfig {
  buttonColor?: string;
  buttonText?: string;
  widgetMode?: WidgetMode;
  autoErrorLogging?: boolean;
  environments?: WidgetEnvironment[];
  blocks?: WidgetBlock[];
  launcher?: FeedbackLauncherConfig;
  lifecycle?: "draft" | "ready" | "disabled";
}

export interface BrandingConfig {
  name: string;
  logoUrl: string | null;
  accentColor: string;
  buttonText: string;
  fontPreset: "system" | "playnist" | "humanist" | "editorial" | "mono";
}

export interface CaptureSite {
  id: string;
  org_id: number;
  project_id: string | null;
  repo: string;
  site_name: string;
  widget_config: string | null;
  branding_config?: string | null;
  slack_channel_id: string | null;
  slack_connection_id: string | null;
  github_login: string;
  project_repo?: string | null;
  project_archived?: number | null;
  github_installation_id?: number | null;
  effective_slack_channel_id?: string | null;
  effective_slack_connection_id?: string | null;
  slack_connected?: number | null;
  slack_health_status?: string | null;
  slack_channel_health?: string | null;
  // Optional keeps older fixtures and local callers compatible. Only an
  // explicit zero disables a service; missing settings remain on.
  feedback_enabled?: number;
  noxalert_enabled?: number;
}

export function parseWidgetConfig(value: string | null | undefined): WidgetConfig {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as WidgetConfig : {};
  } catch {
    return {};
  }
}

export async function getCaptureSite(db: D1Database, siteId: string): Promise<CaptureSite | null> {
  return db.prepare(
    `SELECT site.id, site.org_id, site.project_id, site.repo, site.name AS site_name,
            site.widget_config, site.slack_channel_id, site.slack_connection_id,
            COALESCE(project_settings.data, settings.data) AS branding_config,
            org.github_login, project.repo AS project_repo, project.archived AS project_archived,
            org.installation_id AS github_installation_id,
            COALESCE(NULLIF(site.slack_channel_id, ''), NULLIF(json_extract(settings.data, '$.slack.fallbackChannelId'), ''))
              AS effective_slack_channel_id,
            COALESCE(NULLIF(site.slack_connection_id, ''), NULLIF(json_extract(settings.data, '$.slack.fallbackConnectionId'), ''),
              (SELECT connection.id FROM slack_connections connection
                WHERE connection.org_id = site.org_id
                ORDER BY connection.is_default DESC, connection.installed_at LIMIT 1))
              AS effective_slack_connection_id,
            EXISTS(SELECT 1 FROM slack_connections connection
              WHERE connection.org_id = site.org_id AND connection.id = COALESCE(
                NULLIF(site.slack_connection_id, ''), NULLIF(json_extract(settings.data, '$.slack.fallbackConnectionId'), ''),
                (SELECT fallback.id FROM slack_connections fallback WHERE fallback.org_id = site.org_id
                  ORDER BY fallback.is_default DESC, fallback.installed_at LIMIT 1))) AS slack_connected,
            (SELECT connection.health_status FROM slack_connections connection
              WHERE connection.org_id = site.org_id AND connection.id = COALESCE(
                NULLIF(site.slack_connection_id, ''), NULLIF(json_extract(settings.data, '$.slack.fallbackConnectionId'), ''),
                (SELECT fallback.id FROM slack_connections fallback WHERE fallback.org_id = site.org_id
                  ORDER BY fallback.is_default DESC, fallback.installed_at LIMIT 1))) AS slack_health_status,
            (SELECT channel.status FROM slack_channel_status channel
              WHERE channel.org_id = site.org_id AND channel.channel_id = COALESCE(
                NULLIF(site.slack_channel_id, ''), NULLIF(json_extract(settings.data, '$.slack.fallbackChannelId'), ''))
              ORDER BY channel.updated_at DESC LIMIT 1) AS slack_channel_health,
            CASE
              WHEN settings.data IS NULL OR json_valid(settings.data) = 0 THEN 1
              WHEN json_extract(settings.data, '$.apps.feedback') = 0 THEN 0
              ELSE 1
            END AS feedback_enabled,
            CASE
              WHEN settings.data IS NULL OR json_valid(settings.data) = 0 THEN 1
              WHEN json_extract(settings.data, '$.apps.noxalert') = 0 THEN 0
              ELSE 1
            END AS noxalert_enabled
       FROM spot_sites site
       JOIN orgs org ON org.id = site.org_id
       LEFT JOIN projects project ON project.id = site.project_id AND project.org_id = site.org_id
       LEFT JOIN project_config project_settings
         ON project_settings.org_id = site.org_id AND project_settings.project_id = site.project_id
        AND project_settings.key = 'settings'
       LEFT JOIN config settings ON settings.org_id = site.org_id AND settings.key = 'settings'
      WHERE site.id = ?`,
  ).bind(siteId).first<CaptureSite>();
}

export interface SiteReadiness {
  lifecycle: "draft" | "ready" | "disabled";
  ready: boolean;
  issues: string[];
}

export function siteReadiness(site: CaptureSite): SiteReadiness {
  const config = parseWidgetConfig(site.widget_config);
  const lifecycle = config.lifecycle === "draft" || config.lifecycle === "disabled" ? config.lifecycle : "ready";
  const issues: string[] = [];
  if (lifecycle === "draft") issues.push("site_draft");
  if (lifecycle === "disabled") issues.push("site_disabled");
  if (!site.project_id || !site.project_repo || site.project_archived === 1) issues.push("project_unavailable");
  else if (site.project_repo.toLowerCase() !== site.repo.toLowerCase()) issues.push("repository_mismatch");
  if (!site.github_installation_id) issues.push("github_not_connected");
  const environments = Array.isArray(config.environments) ? config.environments : [];
  if (!environments.some((environment) => environment?.enabled !== false && typeof environment?.url === "string" && environment.url.trim())) {
    issues.push("origin_not_configured");
  }
  if (!site.effective_slack_channel_id) issues.push("slack_channel_not_configured");
  if (!site.effective_slack_connection_id || site.slack_connected !== 1) issues.push("slack_not_connected");
  else if (site.slack_health_status && site.slack_health_status !== "ok") issues.push("slack_connection_degraded");
  if (site.slack_channel_health === "issue") issues.push("slack_channel_unavailable");
  return { lifecycle, ready: issues.length === 0, issues };
}

export function parseBrandingConfig(value: string | null | undefined): BrandingConfig | null {
  try {
    const settings: unknown = JSON.parse(value || "{}");
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
    const branding = (settings as { branding?: unknown }).branding;
    if (!branding || typeof branding !== "object" || Array.isArray(branding)) return null;
    const candidate = branding as Record<string, unknown>;
    if (typeof candidate.name !== "string" || !candidate.name.trim()
        || typeof candidate.accentColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(candidate.accentColor)
        || typeof candidate.buttonText !== "string" || !candidate.buttonText.trim()
        || !["system", "playnist", "humanist", "editorial", "mono"].includes(String(candidate.fontPreset))) return null;
    return {
      name: candidate.name.trim(),
      logoUrl: typeof candidate.logoUrl === "string" && candidate.logoUrl ? candidate.logoUrl : null,
      accentColor: candidate.accentColor,
      buttonText: candidate.buttonText.trim(),
      fontPreset: candidate.fontPreset as BrandingConfig["fontPreset"],
    };
  } catch {
    return null;
  }
}

function configuredHost(value: string): { hostname: string; port: string } | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return { hostname: url.hostname.toLowerCase(), port: url.port };
  } catch {
    return null;
  }
}

export function requestOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (origin && origin !== "null") {
    try { return new URL(origin).origin; } catch { return null; }
  }
  const referer = request.headers.get("Referer");
  if (!referer) return null;
  try { return new URL(referer).origin; } catch { return null; }
}

export function environmentForOrigin(config: WidgetConfig, origin: string | null): WidgetEnvironment | null {
  const environments = Array.isArray(config.environments) ? config.environments : [];
  if (!environments.length || !origin) return null;

  let current: URL;
  try { current = new URL(origin); } catch { return null; }
  const currentHost = current.hostname.toLowerCase();
  return environments.find((environment) => {
    if (!environment || typeof environment.url !== "string") return false;
    const configured = configuredHost(environment.url);
    if (!configured) return false;
    const hostMatches = currentHost === configured.hostname || currentHost.endsWith(`.${configured.hostname}`);
    return hostMatches && (!configured.port || configured.port === current.port);
  }) ?? null;
}

export function originAllowed(config: WidgetConfig, origin: string | null): boolean {
  const environments = Array.isArray(config.environments) ? config.environments : [];
  if (!environments.length) return false;
  const environment = environmentForOrigin(config, origin);
  return Boolean(environment && environment.enabled !== false);
}

export function publicWidgetConfig(site: CaptureSite, origin: string | null) {
  const stored = parseWidgetConfig(site.widget_config);
  const branding = parseBrandingConfig(site.branding_config);
  const readiness = siteReadiness(site);
  const matched = environmentForOrigin(stored, origin);
  const environmentName = matched?.name ?? null;
  const configuredBlocks: readonly WidgetBlock[] = Array.isArray(stored.blocks) && stored.blocks.length
    ? stored.blocks
    : DEFAULT_FEEDBACK_BLOCKS;
  const blocks = configuredBlocks.filter((block) =>
    !Array.isArray(block.environments) || block.environments.length === 0 ||
    (environmentName !== null && block.environments.includes(environmentName)),
  );

  return {
    version: 1,
    siteId: site.id,
    lifecycle: readiness.lifecycle,
    deliveryReady: readiness.ready,
    deliveryIssues: readiness.issues,
    buttonColor: matched?.buttonColor || branding?.accentColor || stored.buttonColor || "#FE795D",
    buttonText: matched?.buttonText || branding?.buttonText || stored.buttonText || "Report issue",
    branding,
    widgetMode: matched?.widgetMode || (stored.widgetMode === "release" ? "release" : "development"),
    captureMode: matched?.captureMode === "screenshot" ? "screenshot" : "dom",
    autoErrorLogging: stored.autoErrorLogging === true,
    launcher: normalizeFeedbackLauncher(stored.launcher),
    environment: environmentName,
    // The current widget matches environments client-side. Return only the
    // effective environment instead of exposing every internal/dev hostname.
    environments: matched ? [matched] : [],
    blocks,
  };
}

export function legacyWidgetConfig(site: CaptureSite) {
  const stored = parseWidgetConfig(site.widget_config);
  const branding = parseBrandingConfig(site.branding_config);
  return {
    version: 1,
    siteId: site.id,
    buttonColor: branding?.accentColor || stored.buttonColor || "#FE795D",
    buttonText: branding?.buttonText || stored.buttonText || "Report issue",
    branding,
    widgetMode: stored.widgetMode === "release" ? "release" : "development",
    captureMode: "dom" as CaptureMode,
    autoErrorLogging: stored.autoErrorLogging === true,
    launcher: normalizeFeedbackLauncher(stored.launcher),
    environments: Array.isArray(stored.environments) ? stored.environments : [],
    blocks: Array.isArray(stored.blocks) && stored.blocks.length ? stored.blocks : DEFAULT_FEEDBACK_BLOCKS,
  };
}
