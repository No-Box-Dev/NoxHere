import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function ServiceTabs({ base, active, tabs, actions, onIntent }: { base: string; active: string; tabs: readonly (readonly [string, string])[]; actions?: ReactNode; onIntent?: (id: string) => void }) {
  return <nav className="primary-tabs service-tabs" aria-label="Service views"><span className="service-tab-links">{tabs.map(([id, label]) => <NavLink key={id} className={active === id ? "active" : ""} to={`${base}/${id}`} onMouseEnter={() => onIntent?.(id)} onFocus={() => onIntent?.(id)}>{label}</NavLink>)}</span>{actions ? <span className="service-tab-actions">{actions}</span> : null}</nav>;
}
