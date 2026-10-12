const STANDARD_FEATURE_CATALOG = {
  "auth.signup": {
    label: "Sign up",
    failureMessage: "A user was prevented from signing up.",
  },
  "auth.login": {
    label: "Log in",
    failureMessage: "A user was prevented from logging in.",
  },
  "auth.password_reset": {
    label: "Password reset",
    failureMessage: "A user was prevented from resetting their password.",
  },
  "auth.email_verification": {
    label: "Email verification",
    failureMessage: "A user was prevented from verifying their email address.",
  },
  "auth.oauth": {
    label: "OAuth / SSO",
    failureMessage: "A user was prevented from signing in with an external provider.",
  },
  "auth.mfa": {
    label: "Multi-factor authentication",
    failureMessage: "A user was prevented from completing multi-factor authentication.",
  },
  "auth.session_refresh": {
    label: "Session refresh",
    failureMessage: "A user's authenticated session could not be refreshed.",
  },
  "auth.logout": {
    label: "Log out",
    failureMessage: "A user was prevented from logging out.",
  },
} as const;

type StandardFeatureKey = keyof typeof STANDARD_FEATURE_CATALOG;
type FeatureKind = "standard" | "custom";

export interface ResolvedFeature {
  key: string;
  kind: FeatureKind;
  label: string;
  failureMessage: string;
}

export function standardFeature(key: string): ResolvedFeature | null {
  if (!Object.hasOwn(STANDARD_FEATURE_CATALOG, key)) return null;
  const definition = STANDARD_FEATURE_CATALOG[key as StandardFeatureKey];
  return { key, kind: "standard", ...definition };
}

interface CustomFeatureRow {
  label: string;
  failure_message: string;
}

export interface FeatureScope {
  orgId: number;
  sourceId: string;
  projectId: string | null;
}

export async function resolveFeature(
  env: Env,
  scope: FeatureScope,
  key: string,
): Promise<ResolvedFeature | null> {
  const standard = standardFeature(key);
  if (standard) return standard;
  if (!key.startsWith("custom.")) return null;

  const custom = await env.NOX_DB.prepare(
    `SELECT label, failure_message
       FROM cue_custom_features
      WHERE org_id = ? AND feature_key = ? AND enabled = 1
        AND ((? IS NOT NULL AND project_id = ?)
          OR (? IS NULL AND source_id = ?))`,
  ).bind(scope.orgId, key, scope.projectId, scope.projectId, scope.projectId, scope.sourceId)
    .first<CustomFeatureRow>();
  return custom
    ? { key, kind: "custom", label: custom.label, failureMessage: custom.failure_message }
    : null;
}
