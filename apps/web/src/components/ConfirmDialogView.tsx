import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export type Confirmation = { title: string; detail: string; confirmLabel: string; destructive: boolean; resolve: (confirmed: boolean) => void };

export function ConfirmDialogView({ request, onClose }: { request: Confirmation; onClose: (confirmed: boolean) => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(false); }}><div ref={dialog} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-detail">
    <header><h2 id="confirm-dialog-title">{request.title}</h2></header>
    <p id="confirm-dialog-detail">{request.detail}</p>
    <footer><Button ref={cancel} type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button><Button type="button" variant={request.destructive ? "destructive" : "cut"} onClick={() => onClose(true)}>{request.confirmLabel}</Button></footer>
  </div></div>;
}
