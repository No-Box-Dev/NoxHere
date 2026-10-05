import { Check, Link2 } from "lucide-react";
import type { NoxAppDefinition } from "@/lib/apps";

export function ServiceActivationCard({
  app,
}: {
  app: NoxAppDefinition;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-accent/10 p-2 text-accent"><Link2 size={16} /></div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-stone-900">{app.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
              <Check size={11} /> Always available
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-stone-500">{app.description} {app.includes}.</p>
        </div>
      </div>
    </section>
  );
}
