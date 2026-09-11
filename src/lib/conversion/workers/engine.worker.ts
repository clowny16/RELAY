/* RELAY conversion engine worker.
 * Handles CPU-heavy conversions off the main thread: images, archives, data,
 * documents, ebooks, fonts, meshes, pdf creation. */
/// <reference lib="webworker" />
import type { ArchiveListing, ArchiveEntryInfo, ConvertContext, ConversionResultPayload, Stage } from "../types";
import { convertImage } from "../engines/image";
import { convertArchive, listArchive, listArchiveAsync, extractEntries, extractEntriesAsync, sanitizePath } from "../engines/archive";
import { convertData } from "../engines/data";
import { convertDocs } from "../engines/docs";
import { convertEbook } from "../engines/ebook";
import { convertFont } from "../engines/font";
import { convertMesh } from "../engines/mesh";
import { runPdfMake, mergePdfs, splitPdf, rotatePdf, compressPdf } from "../engines/pdfmake";

type WorkerRequest =
  | { id: string; kind: "convert"; inputFormat: string; outputFormat: string; fileName: string; mime: string; options: Record<string, unknown>; buffer: ArrayBuffer }
  | { id: string; kind: "list"; inputFormat: string; fileName: string; buffer: ArrayBuffer }
  | { id: string; kind: "extract"; inputFormat: string; selected: string[] | null; buffer: ArrayBuffer }
  | { id: string; kind: "pdf-tool"; tool: "merge" | "split" | "rotate" | "compress"; buffers: ArrayBuffer[]; arg?: string | number };

type WorkerResponse =
  | { id: string; type: "progress"; progress: number; stage: Stage; detail?: string }
  | { id: string; type: "result"; result: ConversionResultPayload }
  | { id: string; type: "listing"; listing: ArchiveListing }
  | { id: string; type: "entries"; entries: { path: string; size: number; data: ArrayBuffer }[] }
  | { id: string; type: "pdf-tool-result"; result: { bytes: Uint8Array; pages?: number } }
  | { id: string; type: "error"; message: string; cancelled?: boolean };

let currentJob: string | null = null;
const cancelledJobs = new Set<string>();

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

function ctxFrom(req: Extract<WorkerRequest, { kind: "convert" }>): ConvertContext {
  return {
    fileName: req.fileName,
    inputFormat: req.inputFormat,
    outputFormat: req.outputFormat,
    options: req.options,
    signal: {
      get aborted() {
        return cancelledJobs.has(req.id);
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as AbortSignal,
    onProgress: (p) => post({ id: req.id, type: "progress", progress: p.progress, stage: p.stage, detail: p.detail }),
  };
}

async function handle(req: WorkerRequest) {
  currentJob = req.id;
  try {
    if (req.kind === "convert") {
      const ctx = ctxFrom(req);
      let result: ConversionResultPayload;

      // PDF creation outputs route to the pdfmake engine regardless of text/image input
      const PDFMAKE_INPUTS = ["txt", "md", "html", "docx", "epub", "fb2", "cbz", "jpg", "png", "webp", "bmp", "gif", "ico", "svg", "tiff", "avif", "heic", "srt", "vtt", "csv", "json"];
      if (req.outputFormat === "pdf" && PDFMAKE_INPUTS.includes(req.inputFormat)) {
        result = await runPdfMake(ctx, req.buffer);
      } else
      switch (req.inputFormat) {
        case "jpg":
        case "png":
        case "gif":
        case "webp":
        case "bmp":
        case "ico":
        case "svg":
        case "tiff":
        case "avif":
          result = await convertImage(ctx, req.buffer, req.mime);
          break;
        case "tar":
        case "zip":
        case "gz":
        case "bz2":
        case "tar-gz":
        case "tar-bz2":
          result = await convertArchive(ctx, req.buffer, req.fileName);
          break;
        case "csv":
        case "tsv":
        case "json":
        case "jsonl":
        case "ndjson":
        case "yaml":
        case "toml":
        case "xml":
        case "ini":
        case "xlsx":
          result = await convertData(ctx, req.buffer);
          break;
        case "md":
        case "html":
        case "txt":
        case "docx":
        case "rtf":
        case "srt":
        case "vtt":
          result = await convertDocs(ctx, req.buffer);
          break;
        case "epub":
        case "fb2":
          result = await convertEbook(ctx, req.buffer);
          break;
        case "ttf":
        case "otf":
        case "woff":
          result = await convertFont(ctx, req.buffer);
          break;
        case "stl":
        case "obj":
        case "ply":
          result = await convertMesh(ctx, req.buffer);
          break;
        default:
          result = await runPdfMake(ctx, req.buffer);
      }
      if (cancelledJobs.has(req.id)) throw new DOMException("Cancelled", "AbortError");
      const transferable = result.bytes.buffer.slice(
        result.bytes.byteOffset,
        result.bytes.byteOffset + result.bytes.byteLength
      );
      post({ id: req.id, type: "result", result: { ...result, bytes: new Uint8Array(transferable as ArrayBuffer) } }, [transferable]);
      return;
    }

    if (req.kind === "list") {
      let listing: ArchiveListing;
      if (req.inputFormat === "tar-bz2") listing = await listArchiveAsync(new Uint8Array(req.buffer), req.inputFormat);
      else listing = listArchive(new Uint8Array(req.buffer), req.inputFormat);
      post({ id: req.id, type: "listing", listing });
      return;
    }

    if (req.kind === "extract") {
      const selected = req.selected ? new Set(req.selected.filter((s) => sanitizePath(s))) : undefined;
      const entries =
        req.inputFormat === "tar-bz2"
          ? await extractEntriesAsync(new Uint8Array(req.buffer), req.inputFormat, selected)
          : extractEntries(new Uint8Array(req.buffer), req.inputFormat, selected);
      const payload = entries.map((e) => ({ path: e.path, size: e.size, data: (e.data ?? new Uint8Array(0)).slice().buffer as ArrayBuffer }));
      post({ id: req.id, type: "entries", entries: payload }, payload.map((p) => p.data));
      return;
    }

    if (req.kind === "pdf-tool") {
      let bytes: Uint8Array;
      let pages: number | undefined;
      if (req.tool === "merge") {
        bytes = await mergePdfs(req.buffers, (p) => post({ id: req.id, type: "progress", progress: p, stage: "processing", detail: "Merging documents…" }));
        pages = undefined;
      } else if (req.tool === "split") {
        bytes = await splitPdf(req.buffers[0], String(req.arg ?? ""));
      } else if (req.tool === "rotate") {
        bytes = await rotatePdf(req.buffers[0], Number(req.arg ?? 90));
      } else {
        bytes = await compressPdf(req.buffers[0]);
      }
      const transferable = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      post({ id: req.id, type: "pdf-tool-result", result: { bytes: new Uint8Array(transferable as ArrayBuffer), pages } }, [transferable]);
      return;
    }
  } catch (err) {
    const e = err as Error;
    const cancelled = e?.name === "AbortError" || cancelledJobs.has(req.id);
    post({ id: req.id, type: "error", message: cancelled ? "Cancelled" : friendlyError(e), cancelled });
  } finally {
    currentJob = null;
  }
}

export function friendlyError(e: Error | string): string {
  const raw = typeof e === "string" ? e : e?.message ?? "Unknown error";
  const m = raw.toLowerCase();
  if (raw.includes("decode") || m.includes("codec")) return "This file could not be decoded. The codec may be unsupported in your browser or the file may be corrupted.";
  if (m.includes("memory") || m.includes("allocation")) return "Ran out of memory. Try a smaller file, or close other tabs and retry.";
  if (m.includes("password") || m.includes("encrypt")) return "This file is password-protected and cannot be processed locally.";
  if (m.includes("drm")) return "This file is DRM-protected and cannot be converted.";
  if (m.includes("corrupt")) return "This file appears to be corrupted or is not a valid document of its kind.";
  if (m.includes("too many entries") || m.includes("safety limit")) return raw;
  if (m.includes("cancelled")) return "Conversion cancelled.";
  return raw.length > 240 ? "This file could not be converted. The format may be unsupported or the file may be corrupted." : raw;
}

self.onmessage = (ev: MessageEvent<WorkerRequest | { type: "cancel"; id: string }>) => {
  const data = ev.data as WorkerRequest | { type: "cancel"; id: string };
  if ("type" in data && data.type === "cancel") {
    cancelledJobs.add(data.id);
    return;
  }
  cancelledJobs.delete(data.id);
  void handle(data as WorkerRequest);
};
