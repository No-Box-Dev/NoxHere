export const HEALTH_CONTRACT_VERSION = 1 as const;

export interface LivenessContract {
  contractVersion: typeof HEALTH_CONTRACT_VERSION;
  kind: "liveness";
  service: string;
  status: "ok";
  buildSha: string;
}

export interface ReadinessContract {
  contractVersion: typeof HEALTH_CONTRACT_VERSION;
  kind: "readiness";
  service: string;
  status: "ok" | "not_ready";
  buildSha: string;
  checks: Record<string, boolean>;
}

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=UTF-8",
  "X-Content-Type-Options": "nosniff",
};

export function livenessResponse(service: string, buildSha = "development"): Response {
  return Response.json({
    contractVersion: HEALTH_CONTRACT_VERSION,
    kind: "liveness",
    service,
    status: "ok",
    buildSha,
  } satisfies LivenessContract, { headers: HEADERS });
}

export function readinessResponse(
  service: string,
  buildSha: string | undefined,
  checks: Record<string, boolean>,
): Response {
  const ready = Object.values(checks).length > 0 && Object.values(checks).every(Boolean);
  return Response.json({
    contractVersion: HEALTH_CONTRACT_VERSION,
    kind: "readiness",
    service,
    status: ready ? "ok" : "not_ready",
    buildSha: buildSha ?? "development",
    checks,
  } satisfies ReadinessContract, {
    status: ready ? 200 : 503,
    headers: HEADERS,
  });
}

export function unavailableReadiness(
  service: string,
  buildSha: string | undefined,
  check: string,
): Response {
  return readinessResponse(service, buildSha, { [check]: false });
}
