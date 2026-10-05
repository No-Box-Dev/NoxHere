import { z } from "zod";

const stageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict();

const configSchema = z.object({
  featureRepository: z.string().trim().min(1).max(100).nullable(),
  workflow: z.object({ stages: z.array(stageSchema).min(1).max(12) }).strict(),
}).strict();

const patchSchema = z.object({
  featureRepository: z.string().trim().min(1).max(100).nullable().optional(),
  workflow: z.object({ stages: z.array(stageSchema).min(1).max(12) }).strict().optional(),
}).strict().superRefine((value, context) => {
  const stages = value.workflow?.stages;
  if (!stages) return;
  const ids = new Set<string>();
  for (const [index, stage] of stages.entries()) {
    if (ids.has(stage.id)) context.addIssue({ code: "custom", path: ["workflow", "stages", index, "id"], message: `Duplicate stage id: ${stage.id}` });
    ids.add(stage.id);
  }
});

export function validateConfigPatch(current: unknown, patch: unknown) {
  const parsedCurrent = configSchema.safeParse(current);
  const parsedPatch = patchSchema.safeParse(patch);
  if (!parsedCurrent.success || !parsedPatch.success) {
    const issues = [...(!parsedCurrent.success ? parsedCurrent.error.issues : []), ...(!parsedPatch.success ? parsedPatch.error.issues : [])];
    return {
      contract: "nox.service-config-validation",
      version: 1,
      valid: false,
      issues: issues.slice(0, 20).map((issue) => ({ message: `${issue.path.join(".") || "config"}: ${issue.message}` })),
    } as const;
  }
  const normalizedPatch = parsedPatch.data;
  return {
    contract: "nox.service-config-validation",
    version: 1,
    valid: true,
    patch: normalizedPatch,
    config: { ...parsedCurrent.data, ...normalizedPatch },
  } as const;
}
