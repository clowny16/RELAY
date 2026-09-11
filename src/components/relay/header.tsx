"use client";

import { useTheme } from "next-themes";
import { useUiStore, type ViewId } from "@/lib/store/ui-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { useQueueStore } from "@/lib/store/queue-store";
import { formatBytes } from "@/lib/store/queue-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lock, MemoryStick, Search, Sun, Moon, Monitor, User, LogOut, Bolt, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getPoolStats } from "@/lib/conversion/worker-client";

const NAV: { id: ViewId; label: string }[] = [
  { id: "convert", label: "Convert" },
  { id: "tools", label: "Tools & Archive" },
  { id: "formats", label: "Format Matrix" },
  { id: "privacy", label: "Architecture & Privacy" },
  { id: "pricing", label: "Pricing" },
];

export function Header() {
  const { view, setView, setSearchOpen, setAuthOpen } = useUiStore();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuthStore();
  const jobs = useQueueStore((s) => s.jobs);
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

  const buffered = jobs.reduce((a, j) => a + j.size, 0);
  const planLabel = user?.plan === "free" ? "FREE" : user?.plan.toUpperCase() ?? "GUEST";

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-md border-b border-border-rule">
      <div className="h-16 w-full px-4 lg:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <button className="flex items-baseline gap-1.5 group shrink-0" onClick={() => setView("convert")} aria-label="RELAY home">
            <span className="font-mono font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">RELAY</span>
            <span className="font-mono text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-surface-high border border-border-rule">v2.4-client</span>
          </button>
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent-light/50 dark:bg-accent-light/30 border border-primary/30">
            <Lock className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
            <span className="font-mono text-[11px] font-semibold tracking-wider text-primary uppercase">100% In-Browser / Zero Upload</span>
          </div>
        </div>

        <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-low border border-border-rule">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                view === item.id
                  ? "bg-surface text-primary border border-border-rule shadow-sm font-medium"
                  : "text-muted-foreground hover:bg-surface-high hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search conversions"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface border border-border-rule shadow-sm hover:border-primary transition-colors"
          >
            <Search className="w-4 h-4 text-muted-foreground" aria-hidden />
            <span className="hidden xl:inline font-mono text-[11px] text-muted-foreground">Search</span>
            <kbd className="hidden xl:inline font-mono text-[10px] text-muted-foreground bg-surface-high border border-border-rule rounded px-1">⌘K</kbd>
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border-rule shadow-sm" title="Total bytes buffered locally">
            <MemoryStick className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
            <span className="font-mono text-[11px] text-muted-foreground">Buffered:</span>
            <span className="font-mono text-[11px] text-primary font-semibold">{formatBytes(buffered)}</span>
          </div>

          {mounted && (
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border-rule shadow-sm ${offline ? "text-destructive" : ""}`}
              title={offline ? "You are offline — cached conversions still work" : "Service worker cached"}
            >
              {offline ? <WifiOff className="w-3 h-3" aria-hidden /> : <span className="w-2 h-2 rounded-full bg-primary" aria-hidden />}
              <span className="font-mono text-[11px] text-muted-foreground">{offline ? "Offline Mode" : "Offline Ready (PWA)"}</span>
            </div>
          )}

          <button
            onClick={() => setView("pricing")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface border border-border-rule hover:border-primary hover:text-primary transition-all shadow-sm"
          >
            <Bolt className="w-4 h-4 text-primary" aria-hidden />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">{mounted ? planLabel : "GUEST"}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity" aria-label="Account menu">
                <User className="w-4.5 h-4.5 text-primary-foreground" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user ? (
                <>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name ?? "Account"}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      <span className="mt-1 text-[10px] font-mono uppercase tracking-wider text-primary">{user.plan} plan</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setView("pricing")}>
                    <ShieldCheck className="w-4 h-4 mr-2" aria-hidden /> Manage subscription
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void signOut()}>
                    <LogOut className="w-4 h-4 mr-2" aria-hidden /> Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel>Guest mode — full local access</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAuthOpen(true)}>
                    <User className="w-4 h-4 mr-2" aria-hidden /> Sign in / Create account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("pricing")}>
                    <Bolt className="w-4 h-4 mr-2" aria-hidden /> Compare plans
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs" onClick={() => setTheme("light")}>
                  Light
                </Button>
                <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs" onClick={() => setTheme("dark")}>
                  Dark
                </Button>
                <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs" onClick={() => setTheme("system")}>
                  <Monitor className="w-3.5 h-3.5" aria-hidden />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function Ticker() {
  const jobs = useQueueStore((s) => s.jobs);
  const history = useQueueStore((s) => s.history);
  const [pool, setPool] = useState({ total: 0, active: 0 });
  const [cores, setCores] = useState(8);

  useEffect(() => {
    setCores(navigator.hardwareConcurrency || 8);
    const t = setInterval(() => setPool(getPoolStats()), 500);
    setPool(getPoolStats());
    return () => clearInterval(t);
  }, []);

  const buffered = jobs.reduce((a, j) => a + j.size, 0);
  const sessionHash = history.length ? `${history[0].id.slice(-4)}..${history[0].id.slice(0, 4)}` : "8f19..b3e0";

  return (
    <div className="w-full bg-surface border-b border-border-rule px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between text-muted-foreground gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" aria-hidden />
          <span className="font-mono text-[11px] text-primary font-semibold">RUNTIME: WASM-ISOLATED SANDBOX</span>
        </div>
        <span className="text-border" aria-hidden>/</span>
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px]">
          <span>WORKERS:</span>
          <span className="text-foreground font-semibold">
            {pool.active}/{pool.total} POOL · {cores} CORES
          </span>
        </div>
        <span className="hidden sm:inline text-border" aria-hidden>/</span>
        <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px]">
          <span>BUFFERED:</span>
          <span className="text-foreground font-semibold">{formatBytes(buffered)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-accent-light/50 dark:bg-accent-light/30 border border-primary/20 px-1.5 py-0.5 rounded text-primary">
          <Lock className="w-3 h-3" aria-hidden />
          <span className="font-mono text-[11px] font-semibold tracking-wider">0 BYTES UPLOADED</span>
        </div>
        <div className="font-mono text-[11px] hidden lg:block">
          SESSION_HASH: <span className="text-foreground font-semibold">{sessionHash}</span>
        </div>
      </div>
    </div>
  );
}
