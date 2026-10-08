import { useEffect, useRef } from "react";

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
    <footer><button ref={cancel} type="button" className="button" onClick={() => onClose(false)}>Cancel</button><button type="button" className={`button ${request.destructive ? "destructive" : "primary-button"}`} onClick={() => onClose(true)}>{request.confirmLabel}</button></footer>
  </div></div>;
}
