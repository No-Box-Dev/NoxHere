import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type SettingsNavGroup = {
  label?: string;
  items: ReadonlyArray<{ id: string; label: string }>;
};

export function SettingsShell({ base, active, groups, children }: { base: string; active: string; groups: readonly SettingsNavGroup[]; children: ReactNode }) {
  return <div className="settings-shell">
    <aside className="settings-navigation" aria-label="Settings sections">
      <header><span className="eyebrow">PROJECT SETTINGS</span><h1>Settings</h1></header>
      {groups.map((group, index) => <div className="settings-navigation-group" key={group.label ?? index}>
        {group.label ? <span>{group.label}</span> : null}
        <nav>{group.items.map((item) => <NavLink className={active === item.id ? "active" : ""} to={`${base}/${item.id}`} key={item.id}>{item.label}</NavLink>)}</nav>
      </div>)}
    </aside>
    <main className="settings-content">{children}</main>
  </div>;
}

export function SettingsPageHeader({ title, description, scope = "Project" }: { title: string; description: string; scope?: "Project" | "Workspace" }) {
  return <header className="settings-page-header"><div><h2>{title}</h2><p>{description}</p></div><span>{scope} scope</span></header>;
}

export function SettingsSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return <section className="settings-content-section">
    {title || description ? <header>{title ? <h3>{title}</h3> : null}{description ? <p>{description}</p> : null}</header> : null}
    {children}
  </section>;
}
