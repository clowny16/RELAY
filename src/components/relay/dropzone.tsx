"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueueStore } from "@/lib/store/queue-store";
import { useUiStore } from "@/lib/store/ui-store";
import { toast } from "sonner";
import { FileUp, FolderOpen, PlusCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropzone() {
  const addFiles = useQueueStore((s) => s.addFiles);
  const setView = useUiStore((s) => s.setView);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (files.length === 0) return;
      setView("convert");
      const { added, rejected } = await addFiles(files);
      if (added > 0) toast.success(`${added} file${added > 1 ? "s" : ""} queued — processing locally`, { description: "Your files never left this device." });
      rejected.slice(0, 3).forEach((r) => toast.error(`Rejected: ${r.name}`, { description: r.reason }));
      if (rejected.length > 3) toast.warning(`${rejected.length - 3} more files rejected`);
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
        "relative group bg-surface hover:bg-surface-low transition-all duration-300 rounded-xl border-2 border-dashed p-6 md:p-10 flex flex-col items-center justify-center text-center shadow-sm",
        dragging ? "bg-accent-light/20 dark:bg-accent-light/10 border-primary ring-2 ring-primary/40" : "border-border"
      )}
      data-testid="dropzone"
    >
      {/* Crosshair corner decor */}
      <div className="absolute top-3 left-3 font-mono text-[10px] text-muted-foreground opacity-60 select-none" aria-hidden>
        +0.0
      </div>
      <div className="absolute top-3 right-3 font-mono text-[10px] text-muted-foreground opacity-60 select-none" aria-hidden>
        +1.0
      </div>
      <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground opacity-60 select-none" aria-hidden>
        -0.0
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-[10px] text-muted-foreground opacity-60 select-none" aria-hidden>
        -1.0
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 max-w-2xl py-2">
        <div className="flex items-center gap-1.5 bg-surface-high border border-border px-3 py-1 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden />
          <span className="font-mono text-[11px] font-semibold text-primary">CLIENT-SIDE SANDBOX: VERIFIED ZERO NETWORK TRANSMISSION</span>
        </div>

        <div
          className={cn(
            "w-16 h-16 rounded-xl bg-accent-light/50 dark:bg-accent-light/20 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm",
            dragging && "scale-110 bg-primary text-primary-foreground"
          )}
        >
          <FileUp className="w-8 h-8" aria-hidden />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-lg font-bold tracking-tight">{dragging ? "Drop your files to start converting" : "Drop files or folders here to transform"}</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 flex-wrap">
            <span>Direct stream memory intake</span>
            <span className="text-border" aria-hidden>•</span>
            <kbd className="font-mono text-[11px] text-foreground font-semibold px-1.5 py-0.5 rounded bg-surface-high border border-border">Cmd+V</kbd>
            <span>from clipboard</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          <label
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm min-h-[44px]"
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
            className="bg-surface hover:bg-surface-high text-foreground border border-border transition-colors text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm min-h-[44px]"
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
          <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span>Your files never leave your device</span>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground font-semibold mr-1">SUPPORTED PIPELINES:</span>
          {["Documents (.PDF, .DOCX, .TXT, .MD, .EPUB)", "Images (.HEIC, .AVIF, .WEBP, .TIFF, .PNG)", "Archives (.TAR, .ZIP, .GZ, .BZ2)", "Media (.MP4, .WEBM, .WAV, .FLAC)"].map((pill) => (
            <span key={pill} className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface border border-border text-foreground">
              {pill}
            </span>
          ))}
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-accent-light/50 dark:bg-accent-light/20 border border-primary/30 text-primary font-bold">+60 MORE</span>
        </div>
      </div>
    </div>
  );
}
