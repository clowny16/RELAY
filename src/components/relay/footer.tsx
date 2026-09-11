"use client";

import { useQueueStore } from "@/lib/store/queue-store";
import { formatBytes } from "@/lib/store/queue-store";
import { History, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelayMark } from "@/components/relay/logo";

function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} mins ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hrs ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

export function HistoryTray() {
  const { history, clearHistory, removeHistory } = useQueueStore();

  return (
    <section className="flex flex-col gap-3 pt-2 pb-6" aria-label="Recent conversions">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Recent conversions — kept in memory only, cleared when you close the tab</span>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={clearHistory}>
            <Trash2 className="w-3 h-3 mr-1" aria-hidden /> Clear
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <History className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" aria-hidden />
          <p className="text-sm text-muted-foreground">Converted files will show up here — names and sizes only, never the file contents.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col divide-y divide-border shadow-sm max-h-72 overflow-y-auto relay-scroll">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-2 text-muted-foreground text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-primary font-bold shrink-0 font-mono uppercase">{h.from} → {h.to}</span>
                <span className="hidden sm:inline shrink-0">
                  {formatBytes(h.inSize)} → {formatBytes(h.outSize)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span>{timeAgo(h.at)}</span>
                <button onClick={() => removeHistory(h.id)} aria-label="Delete history item" className="text-muted-foreground hover:text-destructive transition-colors min-h-[24px] min-w-[24px] flex items-center justify-center">
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Footer() {
  return (
    <footer className="w-full bg-surface border-t border-border py-6 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <RelayMark className="w-5 h-5 rounded-md" />
            <span className="font-extrabold text-sm tracking-tight text-foreground">RELAY</span>
          </span>
          <span className="text-border" aria-hidden>|</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden />
            Files are processed on your device, not ours
          </span>
        </div>
        <div className="text-xs text-muted-foreground" suppressHydrationWarning>Free forever · No account · No uploads · © {new Date().getFullYear()} RELAY</div>
      </div>
    </footer>
  );
}
