import type { ReactNode } from "react";

type StatusTagProps = {
  tone?: "neutral" | "positive" | "warning" | "danger";
  children: ReactNode;
};

export function StatusTag({ tone = "neutral", children }: StatusTagProps) {
  return <span className={`status-tag ${tone}`}>{children}</span>;
}
