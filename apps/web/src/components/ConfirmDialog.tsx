import { useCallback, useState } from "react";
import { ConfirmDialogView, type Confirmation } from "./ConfirmDialogView";

export function useConfirmDialog() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const confirm = useCallback(({ title, detail, confirmLabel = "Confirm", destructive = false }: { title: string; detail: string; confirmLabel?: string; destructive?: boolean }) => new Promise<boolean>((resolve) => setRequest({ title, detail, confirmLabel, destructive, resolve })), []);
  const finish = useCallback((confirmed: boolean) => {
    setRequest((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);
  return { confirm, confirmation: request ? <ConfirmDialogView request={request} onClose={finish} /> : null };
}
