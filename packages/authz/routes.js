export const PRODUCT_SERVICES = Object.freeze(["planning", "activity", "feedback", "telemetry"]);

/** One route classifier shared by the public gateway and private API boundary. */
export function serviceForApiPath(input) {
  const pathname = input.replace(/^\/api\/v1\//, "/api/");
  const explicit = pathname.match(/^\/api\/services\/(planning|activity|feedback|telemetry)(?:\/|$)/)?.[1];
  if (explicit) return explicit;
  if (/^\/api\/(features|tasks|task-workflows|specs|assign|issue-state|planning)(?:\/|$)/.test(pathname)) return "planning";
  if (/^\/api\/projects\/[^/]+\/(activity|issues)(?:\/|$)/.test(pathname)
      || /^\/api\/(activity|issues|prs|events|engineer-activity|engineer-stats|search|llm-settings)(?:\/|$)/.test(pathname)
      || /^\/api\/github\/(comments|details)$/.test(pathname)) return "activity";
  if (/^\/api\/projects\/[^/]+\/feedback(?:\/|$)/.test(pathname) || /^\/api\/feedback(?:\/|$)/.test(pathname)) return "feedback";
  if (/^\/api\/projects\/[^/]+\/(telemetry|growth|usage|incidents)(?:\/|$)/.test(pathname) || /^\/api\/(telemetry|growth|usage)(?:\/|$)/.test(pathname)) return "telemetry";
  if (/^\/api\/config(?:\/|$)/.test(pathname)) return "noxhere";
  return null;
}
