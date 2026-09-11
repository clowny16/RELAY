"use client";

import { useQueueStore } from "@/lib/store/queue-store";
import { formatBytes } from "@/lib/store/queue-store";
import { History, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <section className="flex flex-col gap-3 pt-2 pb-6" aria-label="Session history">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase text-muted-foreground font-semibold tracking-wider">Ephemeral Session Log (RAM-Only · Clears on tab close)</span>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="font-mono text-[11px] text-muted-foreground h-7" onClick={clearHistory}>
            <Trash2 className="w-3 h-3 mr-1" aria-hidden /> Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <History className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" aria-hidden />
          <p className="text-sm text-muted-foreground">No recent conversions. Your local session log will appear here — metadata only, never file contents.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col divide-y divide-border shadow-sm max-h-72 overflow-y-auto relay-scroll">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-2 text-muted-foreground font-mono text-[11px] gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-primary font-bold shrink-0">SAVED</span>
                <span className="text-foreground font-semibold truncate" title={`${h.from} → ${h.to}`}>
                  {h.from} → {h.to}
                </span>
                <span className="hidden sm:inline shrink-0">
                  ({formatBytes(h.inSize)} → {formatBytes(h.outSize)})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span>{timeAgo(h.at)}</span>
                <button onClick={() => removeHistory(h.id)} aria-label="Delete history item" className="text-muted-foreground hover:text-destructive transition-colors">
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
    <footer className="w-full bg-surface border-t border-border py-8 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">RELAY // LOCAL RUNTIME</span>
          <span className="text-border" aria-hidden>|</span>
          <span className="font-mono text-[11px] text-muted-foreground">WASM ENGINE v2.4</span>
          <span className="text-border" aria-hidden>|</span>
          <span className="font-mono text-[11px] text-primary font-semibold">ZERO UPLOADS · CLIENT-SIDE LOCAL EXECUTION ONLY</span>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">© {new Date().getFullYear()} RELAY — files are processed on your device, not ours.</div>
      </div>
    </footer>
  );
}
