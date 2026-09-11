"use client";

import { useTheme } from "next-themes";
import { useUiStore, type ViewId } from "@/lib/store/ui-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Sun, Moon, Monitor, WifiOff, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const NAV: { id: ViewId; label: string }[] = [
  { id: "convert", label: "Convert" },
  { id: "tools", label: "Tools" },
  { id: "formats", label: "Formats" },
  { id: "privacy", label: "Privacy" },
];

export function Header() {
  const { view, setView, setSearchOpen } = useUiStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-md border-b border-border-rule">
      <div className="h-16 w-full px-4 lg:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <button className="flex items-center gap-2 group shrink-0" onClick={() => setView("convert")} aria-label="RELAY home">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-4.5 h-4.5 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-bold text-lg tracking-tight text-foreground group-hover:text-primary transition-colors">RELAY</span>
          </button>
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-light/50 dark:bg-accent-light/20 border border-primary/25">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary">100% private — files never leave your device</span>
          </div>
        </div>

        <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-low border border-border-rule">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={`px-3.5 py-1.5 rounded-md text-sm transition-all ${
                view === item.id
                  ? "bg-surface text-foreground border border-border-rule shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-surface-high hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {offline && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-destructive/30 text-destructive shadow-sm" title="You're offline — conversions still work">
              <WifiOff className="w-4 h-4" aria-hidden />
              <span className="hidden sm:inline text-xs font-medium">Offline — still works</span>
            </div>
          )}

          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search conversions"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface border border-border-rule shadow-sm hover:border-primary transition-colors min-h-[44px] min-w-[44px] justify-center"
          >
            <Search className="w-4 h-4 text-muted-foreground" aria-hidden />
            <span className="hidden xl:inline text-sm text-muted-foreground">Search</span>
            <kbd className="hidden xl:inline font-mono text-[10px] text-muted-foreground bg-surface-high border border-border-rule rounded px-1">⌘K</kbd>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-lg shadow-sm" aria-label="Change theme">
                {mounted ? (theme === "dark" ? <Moon className="w-4 h-4" aria-hidden /> : <Sun className="w-4 h-4" aria-hidden />) : <Sun className="w-4 h-4" aria-hidden />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="w-4 h-4 mr-2" aria-hidden /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="w-4 h-4 mr-2" aria-hidden /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="w-4 h-4 mr-2" aria-hidden /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/** Friendly reassurance strip under the header. */
export function Ticker() {
  return (
    <div className="w-full bg-surface border-b border-border-rule px-4 lg:px-6 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-1 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span className="text-xs">Files are converted on your device — nothing is ever uploaded.</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-highlight" aria-hidden />
            Free forever · No sign-up
          </span>
          <span className="hidden md:inline">Works offline</span>
        </div>
      </div>
    </div>
  );
}
