/* RELAY conversion core — shared types (worker-safe: no DOM references here) */

export type CategoryId =
  | "document"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "ebook"
  | "data"
  | "threeD"
  | "font"
  | "subtitle"
  | "developer";

export type EngineId =
  | "image" // OffscreenCanvas pipeline (worker)
  | "archive" // tar/zip/gz/bz2 (worker)
  | "data" // csv/json/yaml/toml/xml/xlsx (worker)
  | "docs" // markdown/html/text/srt/vtt/docx (worker)
  | "epub" // epub/cbz unpack (worker)
  | "font" // opentype (worker)
  | "mesh" // stl/obj/ply/glb (worker)
  | "pdfmake" // pdf-lib based: txt/md/images/cbz -> pdf, pdf merge/split (worker)
  | "pdf" // pdfjs based (main thread)
  | "audio" // decodeAudioData + lame (main thread)
  | "video" // MediaRecorder / frame capture (main thread)
  | "heic"; // heic2any (main thread)

export interface FormatDef {
  id: string;
  name: string;
  category: CategoryId;
  extensions: string[];
  mime: string;
  binary: boolean;
  blurb?: string;
}

export type OptionType = "select" | "number" | "boolean" | "range" | "text";

export interface OptionField {
  key: string;
  label: string;
  type: OptionType;
  default: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

/** A registered conversion route. `comingSoon` routes are shown only in the
 *  Format Matrix with an honest "coming soon" badge — never in the selector. */
export interface ConversionRoute {
  output: string;
  engine: EngineId;
  options?: OptionField[];
  note?: string;
  comingSoon?: boolean;
  browserDependent?: boolean;
}

export interface ConversionResultPayload {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  /** text snippet (data/text previews), max ~2000 chars */
  textPreview?: string;
  /** extra metadata: dimensions, entry counts, pdf pages, font family... */
  meta?: Record<string, unknown>;
}

export type Stage =
  | "queued"
  | "preparing"
  | "loading-engine"
  | "reading"
  | "processing"
  | "finalizing"
  | "complete";

export interface ProgressInfo {
  /** 0..1, or -1 for indeterminate */
  progress: number;
  stage: Stage;
  detail?: string;
  /** bytes processed so far, when known */
  processedBytes?: number;
}

export interface ConvertContext {
  fileName: string;
  inputFormat: string;
  outputFormat: string;
  options: Record<string, unknown>;
  signal: AbortSignal;
  onProgress: (p: ProgressInfo) => void;
}

export interface Detection {
  formatId: string | null;
  /** how confident we are */
  via: "signature" | "extension" | "content" | "unknown";
  /** short hex signature e.g. "89 50 4E 47" */
  signatureHex?: string;
  /** human label, e.g. "JPEG Image" */
  label?: string;
  /** set when signature disagrees with extension */
  mismatch?: boolean;
}

export interface ArchiveEntryInfo {
  path: string;
  size: number;
  isDir: boolean;
}

export interface ArchiveListing {
  entries: ArchiveEntryInfo[];
  totalUncompressed: number;
  archiveKind: string;
}
