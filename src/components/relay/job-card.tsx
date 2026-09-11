"use client";

import { useState } from "react";
import { useQueueStore, type ConversionJob, formatBytes, outputName } from "@/lib/store/queue-store";
import { getAvailableRoutes, getRoute } from "@/lib/conversion/registry";
import { CATEGORIES, getFormat } from "@/lib/conversion/formats";
import { jobOptionsSchema } from "@/lib/store/queue-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  FileImage,
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  FileCode,
  FileBox,
  FileType,
  FileDigit,
  Captions,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Eye,
  SlidersHorizontal,
  TrendingDown,
  Loader2,
  ScanSearch,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUiStore } from "@/lib/store/ui-store";

function categoryIcon(category: string | undefined) {
  switch (category) {
    case "image":
      return FileImage;
    case "document":
      return FileText;
    case "archive":
      return FileArchive;
    case "audio":
      return FileAudio;
    case "video":
      return FileVideo;
    case "data":
      return FileDigit;
    case "threeD":
      return FileBox;
    case "font":
      return FileType;
    case "subtitle":
      return Captions;
    default:
      return FileCode;
  }
}

function CategoryIcon({ category, className }: { category: string | undefined; className?: string }) {
  switch (category) {
    case "image":
      return <FileImage className={className} aria-hidden />;
    case "document":
      return <FileText className={className} aria-hidden />;
    case "archive":
      return <FileArchive className={className} aria-hidden />;
    case "audio":
      return <FileAudio className={className} aria-hidden />;
    case "video":
      return <FileVideo className={className} aria-hidden />;
    case "data":
      return <FileDigit className={className} aria-hidden />;
    case "threeD":
      return <FileBox className={className} aria-hidden />;
    case "font":
      return <FileType className={className} aria-hidden />;
    case "subtitle":
      return <Captions className={className} aria-hidden />;
    default:
      return <FileCode className={className} aria-hidden />;
  }
}

function statusPill(job: ConversionJob) {
  switch (job.status) {
    case "complete":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-primary font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Done
          {job.finishedAt && job.startedAt ? ` in ${((job.finishedAt - job.startedAt) / 1000).toFixed(1)}s` : ""}
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive font-bold">
          <XCircle className="w-3.5 h-3.5" aria-hidden /> Failed
        </span>
      );
    case "cancelled":
      return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-bold">Cancelled</span>;
    case "waiting":
      return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">Waiting</span>;
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> {job.stage === "queued" ? "Starting…" : job.stage === "preparing" ? "Preparing…" : job.stage === "finalizing" ? "Finishing…" : "Converting…"}
        </span>
      );
  }
}

export function JobCard({ job }: { job: ConversionJob }) {
  const { setTarget, setOption, startJob, cancelJob, retryJob, removeJob, downloadJob } = useQueueStore();
  const setPreviewJob = useUiStore((s) => s.setPreviewJob);
  const [advanced, setAdvanced] = useState(false);
  const fmt = getFormat(job.detection.formatId);
  const routes = getAvailableRoutes(job.detection.formatId!);
  const route = getRoute(job.detection.formatId!, job.target);
  const active = job.status === "preparing" || job.status === "converting" || job.status === "finalizing";
  const showProgress = active || job.status === "complete";
  const outBytes = job.result?.size ?? 0;
  const ratio = outBytes > 0 && job.size > 0 ? Math.round((1 - outBytes / job.size) * 100) : null;
  const meta = (job.result?.meta ?? {}) as Record<string, unknown>;
  const schema = jobOptionsSchema(job);

  const convert = () => {
    if (job.size > 300 * 1024 * 1024) {
      const ok = window.confirm(`This ${formatBytes(job.size)} file may require substantial device memory. Continue?`);
      if (!ok) return;
    }
    startJob(job.id);
  };

  const tryAnotherFormat = () => {
    setAdvanced(true);
    toast.info("Pick a different output format from the selector.");
  };

  const optionsGrid = schema.length > 0 ? (
    <div className="bg-surface-low border border-border p-3 rounded-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[11px] mt-2">
      {schema.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-muted-foreground font-semibold" htmlFor={`opt-${job.id}-${field.key}`}>
            {field.label.toUpperCase()}
          </label>
          {field.type === "select" ? (
            <Select value={String(job.options[field.key] ?? field.default)} onValueChange={(v) => setOption(job.id, field.key, v)}>
              <SelectTrigger id={`opt-${job.id}-${field.key}`} className="h-8 text-xs font-mono bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs font-mono">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === "boolean" ? (
            <label className="flex items-center gap-2 mt-1 cursor-pointer text-foreground">
              <input
                id={`opt-${job.id}-${field.key}`}
                type="checkbox"
                className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
                checked={Boolean(job.options[field.key] ?? field.default)}
                onChange={(e) => setOption(job.id, field.key, e.target.checked)}
              />
              <span>{field.hint ?? "Enabled"}</span>
            </label>
          ) : field.type === "range" ? (
            <div className="flex items-center gap-2">
              <input
                id={`opt-${job.id}-${field.key}`}
                type="range"
                className="flex-1 accent-[var(--primary)]"
                min={field.min}
                max={field.max}
                step={field.step}
                value={Number(job.options[field.key] ?? field.default)}
                onChange={(e) => setOption(job.id, field.key, Number(e.target.value))}
                aria-label={field.label}
              />
              <span className="text-foreground font-semibold w-10 text-right">{String(job.options[field.key] ?? field.default)}</span>
            </div>
          ) : (
            <input
              id={`opt-${job.id}-${field.key}`}
              type={field.type === "number" ? "number" : "text"}
              className="bg-surface border border-border px-2 py-1 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={String(job.options[field.key] ?? field.default)}
              onChange={(e) => setOption(job.id, field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
              placeholder={field.hint}
            />
          )}
          {field.type !== "boolean" && field.hint && <span className="text-muted-foreground text-[10px]">{field.hint}</span>}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 md:p-5 flex flex-col gap-3 shadow-sm" data-testid="job-card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* left: file info */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border", job.status === "failed" ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-accent-light/50 dark:bg-accent-light/20 border-primary/20 text-primary")}>
            <CategoryIcon category={fmt?.category} className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate max-w-[16rem] sm:max-w-xs" title={job.fileName}>
                {job.fileName}
              </span>
              <span
                className={cn(
                  "font-mono text-[11px] px-1.5 py-0.5 rounded border",
                  job.detection.mismatch
                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : "bg-accent-light/40 dark:bg-accent-light/20 border-primary/20 text-primary"
                )}
                title={job.detection.signatureHex ? `Detected file signature: ${job.detection.signatureHex}` : undefined}
              >
                {fmt?.name.toUpperCase() ?? "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs mt-1 flex-wrap">
              <span>{formatBytes(job.size)}</span>
              {meta.width ? (
                <>
                  <span aria-hidden>•</span>
                  <span>
                    {String(meta.width)}×{String(meta.height)}
                  </span>
                </>
              ) : null}
              {meta.entries ? (
                <>
                  <span aria-hidden>•</span>
                  <span>{String(meta.entries)} entries</span>
                </>
              ) : null}
              {meta.pages ? (
                <>
                  <span aria-hidden>•</span>
                  <span>{String(meta.pages)} page(s)</span>
                </>
              ) : null}
              {job.detection.mismatch && (
                <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                  <AlertTriangle className="w-3 h-3" aria-hidden /> file looks like a different type — using what we detected
                </span>
              )}
              {route?.browserDependent && !job.result && (
                <span className="text-muted-foreground" title="Depends on codecs available in your browser">
                  • browser-dependent
                </span>
              )}
              {job.speedBps ? (
                <>
                  <span aria-hidden>•</span>
                  <span>{formatBytes(job.speedBps)}/s</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* center: output selector + savings (hidden while waiting — the picker below takes over) */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {job.status !== "waiting" && (
            <>
              <span className="text-xs text-muted-foreground font-medium hidden md:inline">{job.status === "complete" ? "Saved as:" : "Convert to:"}</span>
              <Select
                value={job.target}
                onValueChange={(v) => setTarget(job.id, v)}
                disabled={active}
              >
                <SelectTrigger className="w-[150px] h-8 font-mono text-xs" aria-label={`Output format for ${job.fileName}`}>
                  <SelectValue placeholder="Output" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.output} value={r.output} className="font-mono text-xs">
                      {r.output.toUpperCase()}
                      {r.output === "jpg" ? " (quality)" : r.output === "png" ? " (lossless)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {job.status === "complete" && outBytes > 0 && (
            <div className="bg-accent-light/50 dark:bg-accent-light/20 border border-primary/30 text-primary text-xs px-2 py-1.5 rounded-lg flex items-center gap-1 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" aria-hidden />
              <span>
                {formatBytes(outBytes)}
                {ratio !== null && ratio !== 0 && ` (${ratio > 0 ? "-" : "+"}${Math.abs(ratio)}%)`}
              </span>
            </div>
          )}
        </div>

        {/* right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {job.status === "complete" && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setPreviewJob(job.id)}>
                <Eye className="w-3.5 h-3.5" aria-hidden /> Preview
              </Button>
              <Button size="sm" className="h-8 text-xs font-bold gap-1.5" onClick={() => downloadJob(job.id)}>
                <Download className="w-3.5 h-3.5" aria-hidden /> Save {job.result!.ext.toUpperCase()}
              </Button>
            </>
          )}
          {active && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 hover:text-destructive hover:border-destructive/40" onClick={() => cancelJob(job.id)}>
              <Square className="w-3.5 h-3.5" aria-hidden /> Cancel
            </Button>
          )}
          {(job.status === "failed" || job.status === "cancelled") && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => retryJob(job.id)}>
                <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Retry
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-destructive" onClick={() => removeJob(job.id)} aria-label="Remove file">
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </Button>
            </>
          )}
          {(job.status === "complete" || job.status === "waiting") && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => removeJob(job.id)} aria-label="Remove file">
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* waiting: detected type + format picker + convert — the main flow */}
      {job.status === "waiting" && (
        <div className="flex flex-col gap-3 border-t border-border pt-3" data-testid="format-picker">
          {/* what we detected */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm">
              <ScanSearch className="w-4 h-4" aria-hidden />
              Detected: {fmt?.name ?? job.detection.label ?? job.detection.formatId?.toUpperCase()}
            </span>
            {fmt?.category && CATEGORIES[fmt.category] && (
              <span className="text-xs text-muted-foreground">— {CATEGORIES[fmt.category].label}</span>
            )}
            {/* mini step indicator */}
            <span className="ml-auto hidden md:flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
              <span className="inline-flex items-center gap-1 text-primary font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Detected</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-primary font-semibold">Pick format</span>
              <ChevronRight className="w-3 h-3" />
              <span>Convert</span>
            </span>
          </div>

          {/* pick the output format */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground w-full sm:w-auto">Convert to:</span>
            {routes.map((r) => {
              const selected = job.target === r.output;
              return (
                <button
                  key={r.output}
                  onClick={() => setTarget(job.id, r.output)}
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
            {route?.browserDependent && (
              <span className="text-xs text-muted-foreground" title="Depends on codecs available in your browser">· depends on your browser</span>
            )}
          </div>

          {/* convert */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <Collapsible open={advanced} onOpenChange={setAdvanced}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden />
                Advanced settings
              </CollapsibleTrigger>
            </Collapsible>
            <Button size="lg" className="min-h-[44px] px-6 text-sm font-bold gap-2 shadow-md" onClick={convert} data-testid="convert-button">
              <Play className="w-4 h-4" aria-hidden />
              Convert to {job.target.toUpperCase()}
            </Button>
          </div>
        </div>
      )}

      {/* error row */}
      {job.status === "failed" && job.error && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          <span className="text-xs text-destructive">{job.error}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => retryJob(job.id)}>
              <RotateCcw className="w-3 h-3 mr-1" aria-hidden /> Retry
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={tryAnotherFormat}>
              Try another format
            </Button>
          </div>
        </div>
      )}

      {/* advanced settings — while waiting the trigger lives in the format-picker row */}
      {schema.length > 0 && job.status !== "waiting" && (
        <Collapsible open={advanced} onOpenChange={setAdvanced}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <SlidersHorizontal className="w-3 h-3" aria-hidden />
              Advanced Settings
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>{optionsGrid}</CollapsibleContent>
        </Collapsible>
      )}
      {schema.length > 0 && job.status === "waiting" && advanced && optionsGrid}

      {/* progress ribbon */}
      {(showProgress || job.status === "failed") && (
        <div className={cn("flex flex-col gap-1.5", !active && "pt-1 border-t border-border/60")}>
          {active && (
            <>
              <Progress value={job.progress < 0 ? undefined : job.progress * 100} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">{job.progress >= 0 ? `${Math.round(job.progress * 100)}%` : "Working…"}</span>
                  <span className="hidden sm:inline">{job.detail ?? job.stage}</span>
                </div>
                <span className="hidden md:inline">processing on your device</span>
              </div>
            </>
          )}
          {job.status === "complete" && (
            <div className="flex items-center gap-2">
              <Progress value={100} className="h-1" />
              <span className="shrink-0 flex items-center gap-1 font-mono text-[11px] text-primary font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {outputName(job.fileName, job.result!.ext)}
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
