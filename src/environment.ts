import { z } from "zod";

export const NOXCUE_ENVIRONMENTS = ["production", "staging", "development", "preview", "test", "local"] as const;
export const cueEnvironmentSchema = z.enum(NOXCUE_ENVIRONMENTS);
export type CueEnvironment = z.infer<typeof cueEnvironmentSchema>;
