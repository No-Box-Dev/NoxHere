/* eslint-disable @typescript-eslint/no-explicit-any */
// Browser-side feature CRUD. All mutations go through Pages Functions
// (functions/api/v1/features*) so the GitHub write + D1 mirror happen in one
// place on the server — see functions/lib/feature-issues.js. The browser
// never talks directly to GitHub for features: the read path hits D1
// directly (fetchFeaturesFromD1) and writes hit /api/v1/features.
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type { Feature, FeatureStatus, SpecLink, StatusHistoryEntry } from "./types";

// Native feature shape returned by NoxTicket via /api/v1/features.
interface NoxTicketFeature {
  number: number;
  title: string;
  status: string;
  backlog: boolean;
  state: "open" | "closed";
  owners: string[];
  statusHistory: Array<{ status: string; at: string }>;
  updatedAt: string;
}

// Compatibility shape returned by the retired GitHub/D1 projection. Keeping
// this reader makes rolling gateway deployments safe during the transition.
interface LegacyD1FeatureRow {
  number: number;
  title: string;
  state: string;
  body: string;
  assignees: { login: string }[];
  labels: { name: string; color: string }[];
  html_url: string | null;
  updated_at?: string;
}

const NOXTICKET_LABEL = "noxticket";
const LEGACY_NOXTICKET_LABEL = ["un", "ticket"].join("");
const FEATURE_LABEL = "feature";
const BACKLOG_LABEL = "backlog";
const STATUS_PREFIX = "status:";

// ---------- Metadata (hidden in issue body) ----------

const METADATA_RE = /\n?<!-- noxticket:metadata\n([\s\S]*?)\n-->\s*$/;
const LEGACY_METADATA_RE = new RegExp(`\\n?<!-- ${LEGACY_NOXTICKET_LABEL}:metadata\\n([\\s\\S]*?)\\n-->\\s*$`);

interface FeatureMetadata {
  statusHistory?: StatusHistoryEntry[];
  specLinks?: SpecLink[];
}

function parseMetadata(body: string): { content: string; metadata: FeatureMetadata } {
  const match = body.match(METADATA_RE) ?? body.match(LEGACY_METADATA_RE);
  if (!match) return { content: body, metadata: {} };
  try {
    const metadata = JSON.parse(match[1]) as FeatureMetadata;
    return { content: body.slice(0, match.index!), metadata };
  } catch (e) {
    console.warn("[noxconnect] Corrupt feature metadata block, ignoring:", e);
    return { content: body, metadata: {} };
  }
}

export function withStatusTransition(feature: Feature, newStatus: FeatureStatus): Feature {
  if (feature.status === newStatus) return feature;
  const history = [...(feature.statusHistory ?? [])];
  history.push({ status: newStatus, timestamp: new Date().toISOString() });
  return { ...feature, status: newStatus, statusHistory: history };
}

// ---------- Helpers ----------

function extractLabel(labels: string[], prefix: string): string | undefined {
  return labels.find((l) => l.startsWith(prefix))?.slice(prefix.length);
}

function issueToFeature(issue: any): Feature {
  const labelNames = (issue.labels ?? [])
    .map((l: any) => (typeof l === "string" ? l : l.name))
    .filter(Boolean) as string[];

  const labelStatus = extractLabel(labelNames, STATUS_PREFIX) as FeatureStatus | undefined;
  const status: FeatureStatus = labelStatus ?? "todo";
  const backlog = labelNames.includes(BACKLOG_LABEL);

  // Feature body still contains a legacy plan-text prefix on rows written
  // before the plan concept was removed — parseMetadata splits it off so
  // metadata stays readable, but we drop the content and rely on Specs
  // for all rich content going forward.
  const rawBody = issue.body ?? "";
  const { metadata } = parseMetadata(rawBody);

  return {
    id: issue.number,
    title: issue.title,
    owners: (issue.assignees ?? []).map((a: any) => a.login),
    status,
    backlog,
    url: issue.html_url,
    updatedAt: issue.updated_at,
    statusHistory: metadata.statusHistory,
    specLinks: metadata.specLinks,
  };
}

// ---------- D1-backed fetch (no GitHub API calls) ----------

function legacyRowToFeature(row: LegacyD1FeatureRow): Feature {
  const feature = issueToFeature({
    number: row.number,
    title: row.title,
    body: row.body,
    labels: row.labels,
    assignees: row.assignees,
    html_url: row.html_url,
    updated_at: row.updated_at,
  });
  return feature;
}

function isNativeFeature(row: NoxTicketFeature | LegacyD1FeatureRow): row is NoxTicketFeature {
  return typeof (row as NoxTicketFeature).status === "string"
    && typeof (row as NoxTicketFeature).backlog === "boolean"
    && Array.isArray((row as NoxTicketFeature).owners);
}

function nativeRowToFeature(row: NoxTicketFeature): Feature {
  return {
    id: row.number,
    title: row.title,
    owners: row.owners,
    status: row.status as FeatureStatus,
    backlog: row.backlog,
    updatedAt: row.updatedAt,
    statusHistory: (row.statusHistory ?? []).map((change) => ({
      status: change.status as FeatureStatus,
      timestamp: change.at,
    })),
  };
}

export async function fetchFeaturesFromD1(state: "open" | "closed" = "open"): Promise<Feature[]> {
  const rows = await apiGet<Array<NoxTicketFeature | LegacyD1FeatureRow>>(`/api/v1/features?state=${state}`);
  return rows
    .filter((row) => {
      if (isNativeFeature(row)) return true;
      const names = new Set(row.labels.map((l) => l.name));
      return (names.has(NOXTICKET_LABEL) || names.has(LEGACY_NOXTICKET_LABEL)) && names.has(FEATURE_LABEL);
    })
    .map((row) => isNativeFeature(row) ? nativeRowToFeature(row) : legacyRowToFeature(row));
}

// ---------- CRUD (server-proxied) ----------
//
// All writes go through the shared api helpers so failures broadcast `ut:error`
// (surfaced as a toast) instead of throwing silently. The server response shape
// from /api/v1/features* is already the Feature shape (ghIssueToFeature on the
// server). NoxTicket uses `number` and `at`; normalize those fields to the
// board's `id` and `timestamp` model at this boundary.

export async function createFeature(
  _org: string,
  title: string,
  opts: {
    status: FeatureStatus;
    owners?: string[];
    backlog?: boolean;
  },
): Promise<Feature> {
  return nativeRowToFeature(await apiPost<NoxTicketFeature>("/api/v1/features", {
    title,
    status: opts.status,
    owners: opts.owners ?? [],
    backlog: opts.backlog ?? false,
  }));
}

export async function updateFeature(_org: string, updated: Feature): Promise<Feature> {
  return nativeRowToFeature(await apiPatch<NoxTicketFeature>(`/api/v1/features/${updated.id}`, {
    title: updated.title,
    status: updated.status,
    owners: updated.owners,
    backlog: updated.backlog ?? false,
  }));
}

export async function deleteFeature(_org: string, issueNumber: number): Promise<void> {
  await apiDelete<unknown>(`/api/v1/features/${issueNumber}`);
}
