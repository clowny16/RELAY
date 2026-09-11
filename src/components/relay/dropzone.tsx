"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueueStore } from "@/lib/store/queue-store";
import { useUiStore } from "@/lib/store/ui-store";
import { getFormat } from "@/lib/conversion/formats";
import { toast } from "sonner";
import { CheckCircle2, FileUp, FolderOpen, Loader2, PlusCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropzone() {
  const addFiles = useQueueStore((s) => s.addFiles);
  const setView = useUiStore((s) => s.setView);
  const scanning = useQueueStore((s) => s.scanning);
  const jobs = useQueueStore((s) => s.jobs);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  // File types currently sitting in the box: files still being detected plus
  // every waiting (not yet converted) job grouped by its detected type.
  const { scanningCount, typeSummary } = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const j of jobs) {
      if (j.status !== "waiting" && j.status !== "paused") continue;
      const key = j.detection.formatId ?? "unknown";
      const label = getFormat(j.detection.formatId)?.name ?? key.toUpperCase();
      const entry = map.get(key);
      if (entry) entry.count += 1;
      else map.set(key, { label, count: 1 });
    }
    return { scanningCount: scanning.length, typeSummary: [...map.values()] };
  }, [jobs, scanning.length]);

  const scrollToFormats = useCallback(() => {
    const target = document.querySelector('[data-testid="detect-panel"]') ?? document.querySelector('section[aria-label="Conversion queue"]');
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleFiles = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (files.length === 0) return;
      setView("convert");
      const { added, rejected } = await addFiles(files);
      if (added > 0) toast.success(`${added} file${added > 1 ? "s" : ""} added — type detected`, { description: "Pick an output format in the yellow panel, then hit Convert." });
      rejected.slice(0, 3).forEach((r) => toast.error(`Skipped: ${r.name}`, { description: r.reason }));
      if (rejected.length > 3) toast.warning(`${rejected.length - 3} more files skipped`);
    },
    [addFiles, setView]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        void handleFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  // Global drag state so dropping anywhere on the page works
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        dragDepth.current++;
        setDragging(true);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void handleFiles(e.dataTransfer?.files ?? null);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  return (
    <div
      className={cn(
        "relative group bg-surface hover:bg-surface-low transition-all duration-300 rounded-2xl border-2 border-dashed p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-sm",
        dragging ? "bg-accent-light/20 dark:bg-accent-light/10 border-primary ring-4 ring-primary/20 scale-[1.01]" : "border-border"
      )}
      data-testid="dropzone"
    >
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-2xl">
        <div
          className={cn(
            "w-20 h-20 rounded-2xl bg-accent-light/50 dark:bg-accent-light/20 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm",
            dragging && "scale-110 bg-primary text-primary-foreground"
          )}
        >
          <FileUp className="w-10 h-10" aria-hidden />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-xl md:text-2xl font-bold tracking-tight">{dragging ? "Drop to start converting" : "Drop files here to convert"}</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 flex-wrap">
            <span>or paste with</span>
            <kbd className="font-mono text-xs text-foreground font-semibold px-1.5 py-0.5 rounded-md bg-surface-high border border-border">Ctrl+V</kbd>
            <span>— files never leave your device</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <label
            className="bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground transition-all text-sm font-semibold px-6 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-md min-h-[44px]"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            <span>Choose Files</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              aria-label="Choose files to convert"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className="bg-surface hover:bg-surface-high active:scale-[0.98] text-foreground border border-border transition-all text-sm font-medium px-5 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm min-h-[44px]"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && folderInput.current?.click()}
          >
            <FolderOpen className="w-4 h-4 text-muted-foreground" aria-hidden />
            <span>Select Folder</span>
            <input
              ref={folderInput}
              type="file"
              multiple
              className="sr-only"
              // @ts-expect-error non-standard folder attributes
              webkitdirectory=""
              directory=""
              aria-label="Select a folder to convert"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden />
          <span>100% private · Free · No sign-up · Works offline</span>
        </div>

        {/* detected file types — shown right inside the box where files are chosen */}
        {(scanningCount > 0 || typeSummary.length > 0) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5" data-testid="dropzone-file-types">
            {scanningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-accent-light/60 dark:bg-accent-light/20 border border-primary/25 text-primary">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                Detecting {scanningCount} file{scanningCount !== 1 ? "s" : ""}…
              </span>
            )}
            {typeSummary.map((t) => (
              <button
                key={t.label}
                onClick={scrollToFormats}
                title="Jump to the format options"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-highlight text-highlight-foreground border border-highlight/60 hover:scale-105 transition-transform cursor-pointer"
                data-testid="dropzone-type-chip"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                {t.label}
                <span className="opacity-70">× {t.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="pt-1 flex flex-wrap items-center justify-center gap-1.5">
          {["PDF", "Word", "Images", "Audio", "Video → GIF", "Archives", "Data", "eBooks", "Fonts"].map((pill) => (
            <span key={pill} className="text-xs px-2.5 py-1 rounded-full bg-surface-high border border-border text-foreground">
              {pill}
            </span>
          ))}
          <span className="text-xs px-2.5 py-1 rounded-full bg-accent-light/50 dark:bg-accent-light/20 border border-primary/30 text-primary font-semibold">+60 more</span>
        </div>

        {/* how it works */}
        <div className="mt-4 pt-6 border-t border-border/60 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            { n: "1", title: "Drop your files", desc: "Drag & drop, browse, or paste" },
            { n: "2", title: "We detect the type", desc: "You pick the output format you want" },
            { n: "3", title: "Convert & download", desc: "Processed on your device, instantly" },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0" aria-hidden>
                {s.n}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{s.title}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
