/**
 * Map a canonical v1 request to the existing compatibility handler namespace.
 * Paths that were born versioned keep their original spelling.
 */
export function compatibilityApiPath(pathname) {
  if (!pathname.startsWith("/api/v1/")) return pathname;
  if (/^\/api\/v1\/(?:services|activity)(?:\/|$)/.test(pathname)) return pathname;

  const projectRouting = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/routing$/);
  if (projectRouting) return `/api/projects/routing/${projectRouting[1]}`;
  if (pathname === "/api/v1/telemetry/public/events") return "/api/telemetry/public/v1/events";

  return pathname.replace(/^\/api\/v1\//, "/api/");
}
