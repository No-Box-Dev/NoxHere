import { AdminGate } from "@/components/admin/AdminGate";
import { ServiceActivationCard } from "@/components/admin/ServiceActivationCard";
import { NoxTicketSection } from "@/components/admin/tools/NoxTicketSection";
import { getNoxApp } from "@/lib/apps";
import type { OptionalServiceAdminPageProps } from "./types";

export function NoxTicketAdminPage(props: OptionalServiceAdminPageProps) {
  return <section className="space-y-6" aria-labelledby="noxticket-page-title">
    <div><h1 id="noxticket-page-title" className="text-xl font-semibold text-stone-900">Planning</h1><p className="mt-1 text-sm text-stone-500">Feature workflow, board stages, rules, and issue delivery.</p></div>
    <ServiceActivationCard app={getNoxApp("noxticket")} />
    <AdminGate title="Planning settings" description="Set the feature repo, board stages, repo rules, and Slack route.">
      {props.status ? <NoxTicketSection noxConnect={props.status} /> : props.loading}
    </AdminGate>
  </section>;
}
