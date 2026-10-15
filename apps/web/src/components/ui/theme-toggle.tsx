import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  let stored: string | null = null;
  try { stored = window.localStorage.getItem("noxhere.theme"); } catch { /* Storage can be disabled. */ }
  if (stored === "light" || stored === "dark") return stored;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { window.localStorage.setItem("noxhere.theme", theme); } catch { /* The preference remains active for this page. */ }
  }, [theme]);
  const next = theme === "dark" ? "light" : "dark";
  return <Button variant="ghost" size="icon" aria-label={`Use ${next} mode`} title={`Use ${next} mode`} onClick={() => setTheme(next)}>{theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</Button>;
}
