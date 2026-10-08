import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableOption = { value: string; label: string; keywords?: string };

export function SearchableSelect({ ariaLabel, value, options, onChange, placeholder = "Search…", emptyLabel, className }: { ariaLabel: string; value: string; options: SearchableOption[]; onChange: (value: string) => void; placeholder?: string; emptyLabel?: string; className?: string }) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const candidates = emptyLabel ? [{ value: "", label: emptyLabel }, ...options] : options;
    return needle && needle !== selected?.label.toLowerCase()
      ? candidates.filter((option) => `${option.label} ${option.keywords ?? ""}`.toLowerCase().includes(needle))
      : candidates;
  }, [emptyLabel, options, query, selected?.label]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (next: SearchableOption) => { onChange(next.value); setQuery(next.label); setOpen(false); };
  return <div className={`searchable-select ${className ?? ""}`} ref={root}>
    <input role="combobox" aria-label={ariaLabel} aria-controls={listId} aria-expanded={open} aria-autocomplete="list" value={open ? query : selected?.label ?? emptyLabel ?? ""} placeholder={placeholder} onFocus={() => { setOpen(true); setQuery(""); setActiveIndex(0); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); setQuery(selected?.label ?? emptyLabel ?? ""); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.max(0, Math.min(filtered.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))); }
      if (event.key === "Enter" && open && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
    }} />
    <button type="button" className="searchable-select-toggle" aria-label={`Show ${ariaLabel} options`} onClick={() => setOpen((current) => { if (!current) { setQuery(""); setActiveIndex(0); } return !current; })}>⌄</button>
    {open ? <div className="searchable-select-options" id={listId} role="listbox">{filtered.length ? filtered.map((option, index) => <button type="button" role="option" aria-selected={option.value === value} className={index === activeIndex ? "active" : ""} key={option.value || "__empty"} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>{option.label}</button>) : <p>No matches</p>}</div> : null}
  </div>;
}
