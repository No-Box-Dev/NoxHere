import { AdminGate } from "@/components/admin/AdminGate";
import { ServiceActivationCard } from "@/components/admin/ServiceActivationCard";
import { NoxFeedSection } from "@/components/admin/tools/NoxFeedSection";
import { getNoxApp } from "@/lib/apps";
import type { OptionalServiceAdminPageProps } from "./types";

export function NoxFeedAdminPage(props: OptionalServiceAdminPageProps) {
  return <section className="space-y-6" aria-labelledby="noxfeed-page-title">
    <div><h1 id="noxfeed-page-title" className="text-xl font-semibold text-stone-900">Activity</h1><p className="mt-1 text-sm text-stone-500">Activity delivery, narration, release notes, and history.</p></div>
    <ServiceActivationCard app={getNoxApp("noxfeed")} />
    <AdminGate title="Activity settings" description="Set Slack routes, narration, models, and activity backfills.">
      {props.status ? <NoxFeedSection noxConnect={props.status} /> : props.loading}
    </AdminGate>
  </section>;
}
