import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export type Confirmation = { title: string; detail: string; confirmLabel: string; destructive: boolean; resolve: (confirmed: boolean) => void };

export function ConfirmDialogView({ request, onClose }: { request: Confirmation; onClose: (confirmed: boolean) => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(false); }}><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-detail">
    <header><h2 id="confirm-dialog-title">{request.title}</h2></header>
    <p id="confirm-dialog-detail">{request.detail}</p>
    <footer><Button ref={cancel} type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button><Button type="button" variant={request.destructive ? "destructive" : "cut"} onClick={() => onClose(true)}>{request.confirmLabel}</Button></footer>
  </div></div>;
}
