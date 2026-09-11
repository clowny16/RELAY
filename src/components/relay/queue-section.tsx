"use client";

import { useQueueStore } from "@/lib/store/queue-store";
import { JobCard } from "./job-card";
import { Layers, Pause, Play, PlayCircle, Trash2, Archive, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/store/queue-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function QueueSection() {
  const { jobs, filter, setFilter, paused, pauseAll, resumeAll, clearCompleted, downloadAll, startAll } = useQueueStore();

  const counts = {
    all: jobs.length,
    active: jobs.filter((j) => j.status === "preparing" || j.status === "converting" || j.status === "finalizing").length,
    pending: jobs.filter((j) => j.status === "waiting" || j.status === "paused").length,
    complete: jobs.filter((j) => j.status === "complete").length,
    failed: jobs.filter((j) => j.status === "failed" || j.status === "cancelled").length,
  };

  const filtered = jobs.filter((j) => {
    switch (filter) {
      case "active":
        return j.status === "preparing" || j.status === "converting" || j.status === "finalizing";
      case "pending":
        return j.status === "waiting" || j.status === "paused";
      case "complete":
        return j.status === "complete";
      case "failed":
        return j.status === "failed" || j.status === "cancelled";
      default:
        return true;
    }
  });

  const totalBytes = jobs.reduce((a, j) => a + j.size, 0);
  const completedCount = counts.complete;

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: `ALL [${counts.all}]` },
    { id: "active", label: `PROCESSING [${counts.active}]` },
    { id: "pending", label: `PENDING [${counts.pending}]` },
    { id: "complete", label: `COMPLETED [${counts.complete}]` },
    ...(counts.failed ? [{ id: "failed" as const, label: `FAILED [${counts.failed}]` }] : []),
  ];

  return (
    <section className="flex flex-col gap-4" aria-label="Conversion queue">
      {/* subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Active Batch Queue
            {counts.all > 0 && <span className="font-mono text-xs bg-accent-light/60 dark:bg-accent-light/20 border border-primary/20 text-primary px-2 py-0.5 rounded font-bold">{counts.all} ITEMS</span>}
          </h2>
          {totalBytes > 0 && <span className="font-mono text-xs text-muted-foreground hidden md:inline">{formatBytes(totalBytes)} buffered in RAM</span>}
        </div>
        {counts.all > 0 && (
          <div className="flex items-center gap-0.5 bg-surface border border-border p-1 rounded-lg shadow-sm overflow-x-auto relay-scroll" role="tablist" aria-label="Filter queue">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 font-mono text-[11px] rounded whitespace-nowrap transition-colors",
                  filter === f.id ? "bg-accent-light dark:bg-accent-light/30 text-primary font-bold border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* empty state */}
      {counts.all === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-2 text-center">
          <Inbox className="w-10 h-10 text-muted-foreground/50" aria-hidden />
          <div className="font-semibold">No files yet</div>
          <p className="text-sm text-muted-foreground">Drop a file above to start converting — nothing gets uploaded.</p>
        </div>
      )}

      {/* list */}
      <div className="flex flex-col gap-3">
        {filtered.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {/* sticky batch toolbar */}
      {counts.all > 0 && (
        <div className="bg-surface border border-border p-3 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg sticky bottom-4 z-40" data-testid="batch-toolbar">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-light/60 dark:bg-accent-light/20 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" aria-hidden />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">{counts.all} Files Buffered ({formatBytes(totalBytes)} Session Total)</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {counts.complete} converted · {counts.active} in execution · {counts.pending} in standby{paused ? " · PAUSED" : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Button variant="outline" size="sm" className="h-9 font-mono text-[11px] gap-1" onClick={() => { clearCompleted(); toast.success("Completed items cleared — memory reclaimed"); }}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear Complete
            </Button>
            {paused ? (
              <Button variant="outline" size="sm" className="h-9 font-mono text-[11px] gap-1" onClick={() => { resumeAll(); toast.info("Queue resumed"); }}>
                <Play className="w-3.5 h-3.5" aria-hidden /> Resume All
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-9 font-mono text-[11px] gap-1" onClick={() => { pauseAll(); toast.info("Queue paused — running jobs will finish"); }}>
                <Pause className="w-3.5 h-3.5" aria-hidden /> Pause All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 font-mono text-[11px] gap-1 border-primary/30 text-primary", completedCount === 0 && "opacity-50 pointer-events-none")}
              onClick={() =>
                void downloadAll().then(() => toast.success("Packaged locally into relay-conversions.zip", { description: "No server-side ZIP generation." }))
              }
            >
              <Archive className="w-3.5 h-3.5" aria-hidden /> Zip &amp; Save All
            </Button>
            <Button size="sm" className="h-9 font-mono text-[11px] font-bold gap-1" onClick={() => { startAll(); }} disabled={paused || counts.pending === 0}>
              <PlayCircle className="w-4 h-4" aria-hidden /> Execute All
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
