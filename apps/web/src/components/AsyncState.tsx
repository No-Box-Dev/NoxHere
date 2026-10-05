import type { ReactNode } from "react";

type AsyncStateProps = {
  loading: boolean;
  error: Error | null;
  children: ReactNode;
};

export function AsyncState({ loading, error, children }: AsyncStateProps) {
  if (loading) return <div className="state-message" role="status"><span className="spinner" />Loading…</div>;
  if (error) return <div className="state-message error" role="alert"><b>Could not load this view</b><span>{error.message}</span></div>;
  return children;
}
