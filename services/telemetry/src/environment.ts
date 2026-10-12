import { z } from "zod";

const TELEMETRY_ENVIRONMENTS = ["production", "staging", "development", "preview", "test", "local"] as const;
export const telemetryEnvironmentSchema = z.enum(TELEMETRY_ENVIRONMENTS);
export type TelemetryEnvironment = z.infer<typeof telemetryEnvironmentSchema>;
