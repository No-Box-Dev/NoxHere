import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type StatusTagProps = {
  tone?: "neutral" | "positive" | "warning" | "danger";
  children: ReactNode;
};

export function StatusTag({ tone = "neutral", children }: StatusTagProps) {
  const variant = tone === "positive" ? "success" : tone === "neutral" ? "neutral" : tone;
  return <Badge className={`status-tag ${tone}`} variant={variant}>{children}</Badge>;
}
