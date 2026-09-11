"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUiStore } from "@/lib/store/ui-store";
import { useQueueStore } from "@/lib/store/queue-store";
import { formatBytes, outputName } from "@/lib/store/queue-store";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut } from "lucide-react";
import { renderPdfFirstPage } from "@/lib/conversion/engines/media";

function DataPreview({ text, meta }: { text?: string; meta?: Record<string, unknown> }) {
  const header = (meta?.previewHeader as string[] | undefined) ?? [];
  const rows = (meta?.previewRows as string[][] | undefined) ?? [];
  return (
    <div className="flex flex-col gap-3">
      {header.length > 0 && rows.length > 0 && (
        <div className="border rounded-lg overflow-auto max-h-72 relay-scroll">
          <table className="w-full text-xs font-mono">
            <thead className="bg-surface-high sticky top-0">
              <tr>
                {header.map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold border-b border-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-surface-low">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 border-b border-border/50 max-w-48 truncate" title={c}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {text && (
        <pre className="bg-surface-low border border-border rounded-lg p-4 text-xs font-mono max-h-72 overflow-auto relay-scroll whitespace-pre-wrap">{text}</pre>
      )}
    </div>
  );
}

function PdfPreview({ buffer }: { buffer: ArrayBuffer }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    void renderPdfFirstPage(buffer, 620)
      .then((u) => !dead && setUrl(u))
      .catch(() => !dead && setUrl(null));
    return () => {
      dead = true;
    };
  }, [buffer]);
  if (!url) return <div className="h-64 bg-surface-high rounded-lg animate-pulse" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="PDF first page preview" className="max-h-[60vh] rounded-lg border shadow mx-auto" />;
}

function FontPreview({ buffer }: { buffer: ArrayBuffer }) {
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const blob = new Blob([buffer], { type: "font/ttf" });
    const url = URL.createObjectURL(blob);
    const face = new FontFace("RelayPreview", `url(${url})`);
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        setOk(true);
      })
      .catch(() => setError(true));
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [buffer]);
  if (error) return <p className="text-sm text-muted-foreground">This font cannot be previewed in this browser.</p>;
  if (!ok) return <div className="h-40 bg-surface-high rounded-lg animate-pulse" />;
  return (
    <div className="space-y-3">
      <p style={{ fontFamily: "RelayPreview" }} className="text-3xl border-b pb-3">
        The quick brown fox jumps over the lazy dog
      </p>
      <p style={{ fontFamily: "RelayPreview" }} className="text-lg text-muted-foreground">
        {"0123456789 — AaBbCcDdEeFfGg — !@#$%&*()"}
      </p>
    </div>
  );
}

function ArchivePreview({ meta }: { meta?: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-2 font-mono text-xs">
      <div className="flex gap-4 text-muted-foreground">
        <span>{String(meta?.entries ?? 0)} entries</span>
        {meta?.uncompressed ? <span>{formatBytes(Number(meta.uncompressed))} uncompressed</span> : null}
      </div>
      <p className="text-muted-foreground">Use the Extract Archive tool (Tools &amp; Archive) to browse and pull individual files out of the archive.</p>
    </div>
  );
}

export function PreviewDialog() {
  const { previewJobId, setPreviewJob } = useUiStore();
  const jobs = useQueueStore((s) => s.jobs);
  const downloadJob = useQueueStore((s) => s.downloadJob);
  const [zoom, setZoom] = useState(1);
  const job = useMemo(() => jobs.find((j) => j.id === previewJobId), [jobs, previewJobId]);

  const mime = job?.result?.mime ?? "";
  const isImage = mime.startsWith("image/");
  const isText = mime.startsWith("text/") || mime === "application/json" || mime === "application/yaml" || mime === "application/xml" || mime === "application/x-subrip";
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");
  const isPdf = mime === "application/pdf";
  const isFont = mime.startsWith("font/");
  const isData = Boolean(job?.result?.meta && "previewHeader" in (job.result.meta as object));
  const isZip = mime === "application/zip" || mime === "application/x-tar";

  const audioUrl = useMemo(() => (job?.result ? URL.createObjectURL(job.result.blob) : null), [job?.result]);

  useEffect(() => {
    setZoom(1);
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [previewJobId, audioUrl]);

  const buffer = useMemo(() => {
    if (!job?.result) return null;
    return job.result.blob.slice(0, 4 * 1024 * 1024).arrayBuffer();
  }, [job?.result]);

  return (
    <Dialog open={Boolean(previewJobId)} onOpenChange={(open) => !open && setPreviewJob(null)}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto relay-scroll">
        {job && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-base truncate">{outputName(job.fileName, job.result!.ext)}</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {formatBytes(job.result!.size)} · {job.result!.mime} · generated locally{job.result!.sha256 ? ` · SHA-256(first MB): ${job.result!.sha256.slice(0, 12)}…` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-1">
                  {isImage && (
                <div className="flex flex-col items-center gap-3">
                  <div className="overflow-auto max-w-full max-h-[55vh] relay-scroll rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={job.result!.url}
                      alt={`Converted output preview of ${job.fileName}`}
                      style={{ transform: `scale(${zoom})` }}
                      className="origin-top-left transition-transform"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Zoom out">
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="font-mono text-xs">{Math.round(zoom * 100)}%</span>
                    <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in">
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    {job.result!.meta && (job.result!.meta as Record<string, unknown>).width ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {String((job.result!.meta as Record<string, unknown>).width)}×{String((job.result!.meta as Record<string, unknown>).height)}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
              {isPdf && buffer && <PdfPreviewPromise promise={buffer} />}
              {isAudio && audioUrl && (
                <div className="flex flex-col gap-3">
                  <audio controls src={audioUrl} className="w-full" aria-label="Converted audio player" />
                  {job.result!.meta && (
                    <div className="flex gap-4 font-mono text-xs text-muted-foreground">
                      {Object.entries(job.result!.meta as Record<string, unknown>).map(([k, v]) => (
                        <span key={k}>
                          {k}: <span className="text-foreground font-semibold">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isVideo && (
                <video controls src={job.result!.url} className="w-full max-h-[55vh] rounded-lg border" aria-label="Converted video player" />
              )}
              {isFont && buffer && <FontPreviewPromise promise={buffer} />}
              {(isText || isData) && <DataPreview text={job.result!.textPreview} meta={job.result!.meta as Record<string, unknown>} />}
              {isZip && <ArchivePreview meta={job.result!.meta as Record<string, unknown>} />}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewJob(null)}>
                Close
              </Button>
              <Button onClick={() => downloadJob(job.id)}>
                <Download className="w-4 h-4 mr-1.5" aria-hidden /> Download
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PdfPreviewPromise({ promise }: { promise: Promise<ArrayBuffer> }) {
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  useEffect(() => {
    let dead = false;
    void promise.then((b) => !dead && setBuf(b));
    return () => {
      dead = true;
    };
  }, [promise]);
  if (!buf) return <div className="h-64 bg-surface-high rounded-lg animate-pulse" />;
  return <PdfPreview buffer={buf} />;
}

function FontPreviewPromise({ promise }: { promise: Promise<ArrayBuffer> }) {
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  useEffect(() => {
    let dead = false;
    void promise.then((b) => !dead && setBuf(b));
    return () => {
      dead = true;
    };
  }, [promise]);
  if (!buf) return <div className="h-40 bg-surface-high rounded-lg animate-pulse" />;
  return <FontPreview buffer={buf} />;
}
