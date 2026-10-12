export const PRODUCT_SERVICES = Object.freeze(["noxticket", "noxfeed", "noxspot", "noxcue"]);

/** One route classifier shared by the public gateway and private API boundary. */
export function serviceForApiPath(input) {
  const pathname = input.replace(/^\/api\/v1\//, "/api/");
  const explicit = pathname.match(/^\/api\/services\/(noxticket|noxfeed|noxspot|noxcue)(?:\/|$)/)?.[1];
  if (explicit) return explicit;
  if (/^\/api\/(features|tasks|task-workflows|specs|assign|issue-state|planning)(?:\/|$)/.test(pathname)) return "noxticket";
  if (/^\/api\/projects\/[^/]+\/(activity|issues)(?:\/|$)/.test(pathname)
      || /^\/api\/(feed|issues|prs|events|engineer-activity|engineer-stats|search|llm-settings|noxfeed)(?:\/|$)/.test(pathname)
      || /^\/api\/github\/(comments|details)$/.test(pathname)) return "noxfeed";
  if (/^\/api\/projects\/[^/]+\/feedback(?:\/|$)/.test(pathname) || /^\/api\/spots(?:\/|$)/.test(pathname)) return "noxspot";
  if (/^\/api\/projects\/[^/]+\/(cue|incidents)(?:\/|$)/.test(pathname) || /^\/api\/cues(?:\/|$)/.test(pathname)) return "noxcue";
  if (/^\/api\/config(?:\/|$)/.test(pathname)) return "noxconnect";
  return null;
}
