"use client";

/*
 * DetectPanel — the "what are we doing?" panel.
 *
 * 1. While files are being added it shows every file with a live
 *    "Detecting file type…" status.
 * 2. Once detection finishes it groups the files by detected type and asks
 *    "What format do you want?" — the user picks an output format and hits
 *    convert for the whole group at once.
 */

import { useEffect, useMemo, useState } from "react";
import { useQueueStore, type ConversionJob, formatBytes } from "@/lib/store/queue-store";
import { getAvailableRoutes } from "@/lib/conversion/registry";
import { CATEGORIES, getFormat } from "@/lib/conversion/formats";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Loader2, Play, ScanSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_CONFIRM_BYTES = 300 * 1024 * 1024;

export function DetectPanel() {
  const scanning = useQueueStore((s) => s.scanning);
  const jobs = useQueueStore((s) => s.jobs);
  const setTarget = useQueueStore((s) => s.setTarget);
  const startGroup = useQueueStore((s) => s.startGroup);
  const [dismissed, setDismissed] = useState(false);
  const [choice, setChoice] = useState<Record<string, string>>({});

  // A new scan re-opens the panel, even if it was dismissed before.
  useEffect(() => {
    if (scanning.length > 0) setDismissed(false);
  }, [scanning.length]);

  // Group all still-waiting files by their detected input type.
  const groups = useMemo(() => {
    const map = new Map<string, ConversionJob[]>();
    for (const j of jobs) {
      if (j.status !== "waiting") continue;
      const key = j.detection.formatId ?? "unknown";
      const arr = map.get(key);
      if (arr) arr.push(j);
      else map.set(key, [j]);
    }
    return [...map.entries()];
  }, [jobs]);

  if (dismissed) return null;
  if (scanning.length === 0 && groups.length === 0) return null;

  const busy = scanning.length > 0;
  const waitingCount = groups.reduce((a, [, g]) => a + g.length, 0);

  const convertGroup = (formatId: string, groupJobs: ConversionJob[], target: string) => {
    const oversized = groupJobs.find((j) => j.size > MAX_CONFIRM_BYTES);
    if (oversized) {
      const ok = window.confirm(
        `${oversized.fileName} is ${formatBytes(oversized.size)} — large files may require substantial device memory. Continue?`
      );
      if (!ok) return;
    }
    groupJobs.forEach((j) => setTarget(j.id, target));
    // start only this group's files — other groups keep waiting for their own format choice
    setTimeout(() => startGroup(groupJobs.map((j) => j.id)), 20);
    toast.success(`Converting ${groupJobs.length} file${groupJobs.length !== 1 ? "s" : ""} to ${target.toUpperCase()}`, {
      description: "Running on your device — track progress below.",
    });
  };

  return (
    <section
      aria-label="Detected files and output format choice"
      aria-busy={busy}
      data-testid="detect-panel"
      className="bg-surface border border-primary/25 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col gap-4"
    >
      {/* header — always tells the user what the app is doing right now */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border bg-highlight text-highlight-foreground border-highlight/60">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <ScanSearch className="w-5 h-5" aria-hidden />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm md:text-base truncate">
              {busy ? "Looking at your files…" : waitingCount === 1 ? "1 file detected — what format do you want?" : `${waitingCount} files detected — what format do you want?`}
            </span>
            <span className="text-xs text-muted-foreground">
              {busy ? "Detecting file type — this takes just a moment" : "Pick an output format for each file type, then convert. You can still change it on each card."}
            </span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss panel"
          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-high transition-colors"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      {/* live "what we're doing" list — one row per file being detected */}
      {busy && (
        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto relay-scroll" data-testid="scanning-list">
          {scanning.map((s) => (
            <div key={s.id} className="flex items-center gap-3 text-sm bg-surface-low border border-border rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" aria-hidden />
              <span className="truncate flex-1 min-w-0" title={s.name}>
                {s.name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(s.size)}</span>
              <span className="text-xs text-primary font-semibold shrink-0 hidden sm:inline">Detecting file type…</span>
            </div>
          ))}
        </div>
      )}

      {/* detected groups — pick the output format, convert the whole group */}
      {groups.map(([formatId, groupJobs]) => {
        const routes = getAvailableRoutes(formatId);
        const fmt = getFormat(formatId);
        const current = choice[formatId] ?? groupJobs[0]?.target ?? routes[0]?.output ?? "";
        const label = fmt?.name ?? formatId.toUpperCase();
        const category = fmt?.category ? CATEGORIES[fmt.category]?.label : undefined;
        return (
          <div key={formatId} className="border-t border-border pt-3.5 flex flex-col gap-2.5" data-testid={`format-group-${formatId}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-primary font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" aria-hidden />
                Detected: {label}
              </span>
              {category && <span className="text-xs text-muted-foreground">— {category}</span>}
              <span className="text-xs font-semibold bg-accent-light/60 dark:bg-accent-light/20 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                {groupJobs.length} file{groupJobs.length !== 1 ? "s" : ""}
              </span>
              <span className="ml-auto hidden md:flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
                <span className="inline-flex items-center gap-1 text-highlight-foreground bg-highlight px-1.5 py-0.5 rounded font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Detected
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-semibold">Pick format</span>
                <ChevronRight className="w-3 h-3" />
                <span>Convert</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground w-full sm:w-auto">Convert to:</span>
              {routes.map((r) => {
                const selected = current === r.output;
                return (
                  <button
                    key={r.output}
                    onClick={() => setChoice((c) => ({ ...c, [formatId]: r.output }))}
                    aria-pressed={selected}
                    title={r.note ?? undefined}
                    className={cn(
                      "px-3.5 py-2 rounded-lg border font-mono text-sm font-semibold transition-all min-h-[40px]",
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-surface border-border hover:border-primary/50 hover:text-primary"
                    )}
                  >
                    {r.output.toUpperCase()}
                    {r.output === "jpg" ? " (smaller)" : r.output === "png" ? " (lossless)" : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-start sm:justify-end">
              <Button
                size="sm"
                className="min-h-[44px] px-5 text-sm font-bold gap-2 shadow-md"
                onClick={() => convertGroup(formatId, groupJobs, current)}
                data-testid={`convert-group-${formatId}`}
              >
                <Play className="w-4 h-4" aria-hidden />
                Convert {groupJobs.length} to {current.toUpperCase()}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
