import { WorkerEntrypoint } from "cloudflare:workers";
import { validateConfigPatch } from "./config";
import { deleteAttachment, getAttachment, listAttachments, putAttachment } from "./attachments";
import { createFeature, listFeatures, updateFeature } from "./features";
import { deleteFeatureAttachment, getFeatureAttachment, listFeatureAttachments, putFeatureAttachment } from "./feature-attachments";
import { activityMessage, featureAddedMessage, testMessage } from "./messages";
import { NOXTICKET_MANIFEST } from "./manifest";
import { checkReadiness } from "./readiness";
import {
  createSpec,
  getSpec,
  listSpecs,
  setSpecArchived,
  updateSpec,
  type SpecFilters,
  type TicketScope,
} from "./specs";

export default class NoxTicketService extends WorkerEntrypoint<Env> {
  describe() { return NOXTICKET_MANIFEST; }

  validateConfigPatch(current: unknown, patch: unknown) {
    return validateConfigPatch(current, patch);
  }

  listSpecs(scope: TicketScope, filters?: SpecFilters) {
    return listSpecs(this.env.DB, scope, filters);
  }

  getSpec(scope: TicketScope, id: number) {
    return getSpec(this.env.DB, scope, id);
  }

  createSpec(scope: TicketScope, input: unknown) {
    return createSpec(this.env.DB, scope, input);
  }

  updateSpec(scope: TicketScope, id: number, input: unknown) {
    return updateSpec(this.env.DB, scope, id, input);
  }

  setSpecArchived(scope: TicketScope, id: number, archived: boolean) {
    return setSpecArchived(this.env.DB, scope, id, archived);
  }

  listAttachments(scope: TicketScope, specId: number) {
    return listAttachments(this.env.DB, scope, specId);
  }

  putAttachment(scope: TicketScope, specId: number, filename: string, bytes: ArrayBuffer) {
    return putAttachment(this.env.DB, this.env.SPEC_ATTACHMENTS, scope, specId, filename, bytes);
  }

  getAttachment(scope: TicketScope, specId: number, attachmentId: number) {
    return getAttachment(this.env.DB, this.env.SPEC_ATTACHMENTS, scope, specId, attachmentId);
  }

  deleteAttachment(scope: TicketScope, specId: number, attachmentId: number) {
    return deleteAttachment(this.env.DB, this.env.SPEC_ATTACHMENTS, scope, specId, attachmentId);
  }

  listFeatures(scope: TicketScope, state?: string) { return listFeatures(this.env.DB, scope, state); }
  createFeature(scope: TicketScope, input: unknown) { return createFeature(this.env.DB, scope, input); }
  updateFeature(scope: TicketScope, number: number, input: unknown) { return updateFeature(this.env.DB, scope, number, input); }
  listFeatureAttachments(scope: TicketScope, featureId: number) { return listFeatureAttachments(this.env.DB, scope, featureId); }
  putFeatureAttachment(scope: TicketScope, featureId: number, filename: string, bytes: ArrayBuffer) { return putFeatureAttachment(this.env.DB, this.env.SPEC_ATTACHMENTS, scope, featureId, filename, bytes); }
  getFeatureAttachment(scope: TicketScope, featureId: number, attachmentId: number) { return getFeatureAttachment(this.env.DB, this.env.SPEC_ATTACHMENTS, scope, featureId, attachmentId); }
  deleteFeatureAttachment(scope: TicketScope, featureId: number, attachmentId: number) { return deleteFeatureAttachment(this.env.DB, this.env.SPEC_ATTACHMENTS, scope, featureId, attachmentId); }
  buildActivityMessage(input: Parameters<typeof activityMessage>[0]) { return activityMessage(input); }
  buildFeatureAddedMessage(input: Parameters<typeof featureAddedMessage>[0]) { return featureAddedMessage(input); }
  buildTestMessage(orgLogin: string) { return testMessage(orgLogin); }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      try {
        return Response.json(await checkReadiness(this.env.DB, this.env.BUILD_SHA));
      } catch (error) {
        console.error(JSON.stringify({
          event: "noxticket_readiness_failed",
          error: error instanceof Error ? error.message : String(error),
        }));
        return Response.json({ service: "noxticket", status: "unavailable", contractVersion: 1 }, { status: 503 });
      }
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
