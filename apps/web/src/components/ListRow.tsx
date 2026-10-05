import type { ReactNode } from "react";

type ListRowProps = {
  symbol: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
  title: string;
  description: ReactNode;
  meta: ReactNode;
  onClick?: () => void;
};

export function ListRow({ symbol, tone = "neutral", title, description, meta, onClick }: ListRowProps) {
  const contents = (
    <>
      <span className={`list-symbol ${tone}`}>{symbol}</span>
      <span className="list-copy"><b>{title}</b><small>{description}</small></span>
      <span className="list-meta">{meta}</span>
    </>
  );

  return onClick ? <button type="button" className="list-row" onClick={onClick}>{contents}</button> : <div className="list-row">{contents}</div>;
}
