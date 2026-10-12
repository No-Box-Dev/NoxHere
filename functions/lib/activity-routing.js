import { resolveProjectSlackDestination } from "./project-routing.js";

/** Resolve Activity through NoxHere's shared project routing core. */
export async function resolveActivityDestination(db, orgId, repo, kind) {
  return resolveProjectSlackDestination(
    db,
    orgId,
    kind === "release_notes" ? "activity_release_notes" : "activity_posts",
    { repo },
  );
}
