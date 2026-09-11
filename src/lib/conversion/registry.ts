import type { CategoryId, ConversionRoute, OptionField } from "./types";
import { FORMATS, getFormat } from "./formats";

/* ------------------------------------------------------------------ */
/* Shared option schemas                                               */
/* ------------------------------------------------------------------ */

const opt = (
  key: string,
  label: string,
  type: OptionField["type"],
  def: string | number | boolean,
  extra?: Partial<OptionField>
): OptionField => ({ key, label, type, default: def, ...extra });

const O = {
  imgQuality: opt("quality", "Quality", "range", 92, { min: 10, max: 100, step: 1, hint: "Applies to JPEG / WebP encoders" }),
  imgWidth: opt("width", "Width (px)", "number", 0, { hint: "0 = keep original" }),
  imgHeight: opt("height", "Height (px)", "number", 0, { hint: "0 = keep aspect ratio" }),
  imgBg: opt("background", "Flatten background", "select", "#ffffff", {
    options: [
      { value: "#ffffff", label: "White" },
      { value: "#000000", label: "Black" },
      { value: "transparent", label: "Keep transparent" },
    ],
    hint: "Used when the source has an alpha channel",
  }),
  archLevel: opt("level", "Compression level", "range", 6, { min: 1, max: 9, step: 1, hint: "ZIP deflate level" }),
  audioSampleRate: opt("sampleRate", "Sample rate", "select", "keep", {
    options: [
      { value: "keep", label: "Preserve source" },
      { value: "44100", label: "44.1 kHz" },
      { value: "48000", label: "48 kHz" },
      { value: "22050", label: "22.05 kHz" },
    ],
  }),
  audioChannels: opt("channels", "Channels", "select", "keep", {
    options: [
      { value: "keep", label: "Preserve source" },
      { value: "1", label: "Mono" },
      { value: "2", label: "Stereo" },
    ],
  }),
  mp3Bitrate: opt("bitrate", "MP3 bitrate", "select", "192", {
    options: [
      { value: "128", label: "128 kbps" },
      { value: "192", label: "192 kbps" },
      { value: "256", label: "256 kbps" },
      { value: "320", label: "320 kbps" },
    ],
  }),
  csvDelimiter: opt("delimiter", "Delimiter", "select", "auto", {
    options: [
      { value: "auto", label: "Auto-detect" },
      { value: ",", label: "Comma ," },
      { value: ";", label: "Semicolon ;" },
      { value: "\t", label: "Tab" },
      { value: "|", label: "Pipe |" },
    ],
  }),
  csvHeader: opt("header", "First row is header", "boolean", true),
  csvQuote: opt("quote", 'Quote character', "select", '"', {
    options: [
      { value: '"', label: 'Double quote "' },
      { value: "'", label: "Single quote '" },
    ],
  }),
  dataPretty: opt("pretty", "Pretty-print output", "boolean", true),
  pdfDpi: opt("dpi", "Render DPI", "select", "144", {
    options: [
      { value: "96", label: "96 DPI (screen)" },
      { value: "144", label: "144 DPI (balanced)" },
      { value: "216", label: "216 DPI (high)" },
      { value: "300", label: "300 DPI (print)" },
    ],
    hint: "Higher DPI = larger images, more memory",
  }),
  pdfPages: opt("pages", "Page range", "text", "", { hint: 'e.g. "1-3,5,8-" — empty = all pages' }),
  docPageSize: opt("pageSize", "Page size", "select", "a4", {
    options: [
      { value: "a4", label: "A4" },
      { value: "letter", label: "US Letter" },
    ],
  }),
  imgPdfMargin: opt("margin", "Page margin", "select", "0", {
    options: [
      { value: "0", label: "None" },
      { value: "24", label: "24 pt" },
      { value: "48", label: "48 pt" },
    ],
  }),
  gifFps: opt("fps", "Frame rate", "select", "10", {
    options: [
      { value: "8", label: "8 fps" },
      { value: "10", label: "10 fps" },
      { value: "15", label: "15 fps" },
      { value: "20", label: "20 fps" },
    ],
  }),
  gifWidth: opt("width", "Width (px)", "select", "360", {
    options: [
      { value: "240", label: "240 px" },
      { value: "360", label: "360 px" },
      { value: "480", label: "480 px" },
    ],
  }),
  gifSeconds: opt("seconds", "Max duration (s)", "range", 10, { min: 1, max: 30, step: 1, hint: "Longer GIFs consume heavy memory" }),
  webmQuality: opt("crf", "Quality", "select", "balanced", {
    options: [
      { value: "high", label: "High quality" },
      { value: "balanced", label: "Balanced" },
      { value: "small", label: "Small file" },
    ],
  }),
  webmSeconds: opt("seconds", "Max duration (s)", "range", 60, { min: 5, max: 600, step: 5 }),
};

const IMG_OUT = [O.imgQuality, O.imgWidth, O.imgHeight];
const IMG_FLAT = [O.imgQuality, O.imgWidth, O.imgHeight, O.imgBg];

/* ------------------------------------------------------------------ */
/* Conversion matrix — every REAL, implemented route is listed here.   */
/* comingSoon routes are surfaced honestly but never offered in UI.    */
/* ------------------------------------------------------------------ */

const R = (
  output: string,
  engine: ConversionRoute["engine"],
  extra?: Partial<ConversionRoute>
): ConversionRoute => ({ output, engine, ...extra });

export const CONVERSIONS: Record<string, ConversionRoute[]> = {
  /* ---------------- images ---------------- */
  jpg: [R("png", "image"), R("webp", "image", { options: IMG_OUT, browserDependent: true, note: "WebP encoding depends on browser support" }), R("bmp", "image", { options: IMG_OUT }), R("gif", "image", { options: [O.imgWidth, O.imgHeight] }), R("ico", "image", { options: [O.imgWidth], note: "Single-size icon (256px max)" }), R("pdf", "pdfmake", { options: [O.imgPdfMargin], note: "One image per page" })],
  png: [R("jpg", "image", { options: IMG_FLAT }), R("webp", "image", { options: IMG_OUT, browserDependent: true, note: "WebP encoding depends on browser support" }), R("bmp", "image", { options: IMG_OUT }), R("gif", "image", { options: [O.imgWidth, O.imgHeight] }), R("ico", "image", { options: [O.imgWidth], note: "Single-size icon (256px max)" }), R("pdf", "pdfmake", { options: [O.imgPdfMargin], note: "One image per page" })],
  webp: [R("jpg", "image", { options: IMG_FLAT }), R("png", "image"), R("bmp", "image", { options: IMG_OUT }), R("gif", "image", { options: [O.imgWidth, O.imgHeight] }), R("ico", "image", { options: [O.imgWidth] }), R("pdf", "pdfmake", { options: [O.imgPdfMargin] })],
  gif: [R("jpg", "image", { options: IMG_FLAT, note: "First frame" }), R("png", "image", { note: "First frame" }), R("webp", "image", { options: IMG_OUT, note: "First frame", browserDependent: true }), R("bmp", "image", { options: IMG_OUT, note: "First frame" }), R("ico", "image", { options: [O.imgWidth], note: "First frame" }), R("pdf", "pdfmake", { options: [O.imgPdfMargin], note: "First frame" })],
  bmp: [R("jpg", "image", { options: IMG_FLAT }), R("png", "image"), R("webp", "image", { options: IMG_OUT, browserDependent: true }), R("gif", "image", { options: [O.imgWidth, O.imgHeight] }), R("ico", "image", { options: [O.imgWidth] }), R("pdf", "pdfmake", { options: [O.imgPdfMargin] })],
  ico: [R("jpg", "image", { options: IMG_FLAT }), R("png", "image"), R("webp", "image", { options: IMG_OUT, browserDependent: true }), R("bmp", "image", { options: IMG_OUT }), R("gif", "image"), R("pdf", "pdfmake", { options: [O.imgPdfMargin] })],
  svg: [R("png", "image", { options: [O.imgWidth, O.imgHeight], note: "Rasterized via browser vector pipeline" }), R("jpg", "image", { options: [...IMG_OUT, O.imgBg] }), R("webp", "image", { options: [O.imgWidth, O.imgHeight], browserDependent: true }), R("bmp", "image", { options: [O.imgWidth, O.imgHeight] }), R("ico", "image", { options: [O.imgWidth] }), R("pdf", "pdfmake", { options: [O.imgWidth, O.imgPdfMargin] })],
  tiff: [R("jpg", "image", { options: IMG_FLAT }), R("png", "image"), R("webp", "image", { options: IMG_OUT, browserDependent: true }), R("bmp", "image", { options: IMG_OUT }), R("gif", "image"), R("ico", "image"), R("pdf", "pdfmake", { options: [O.imgPdfMargin] })],
  avif: [R("jpg", "image", { options: IMG_FLAT, browserDependent: true, note: "Requires AVIF decode support in your browser" }), R("png", "image", { browserDependent: true }), R("webp", "image", { options: IMG_OUT, browserDependent: true }), R("bmp", "image", { browserDependent: true }), R("gif", "image", { browserDependent: true }), R("ico", "image", { browserDependent: true }), R("pdf", "pdfmake", { browserDependent: true })],
  heic: [R("jpg", "image", { engine: "heic", options: [O.imgQuality, O.imgWidth, O.imgHeight], note: "Decoded locally with WebAssembly (libheif)" }), R("png", "image", { engine: "heic", note: "Decoded locally with WebAssembly (libheif)" }), R("webp", "image", { engine: "heic", browserDependent: true }), R("bmp", "image", { engine: "heic" }), R("gif", "image", { engine: "heic" }), R("ico", "image", { engine: "heic" }), R("pdf", "pdfmake", { engine: "heic" })],

  /* ---------------- archives ---------------- */
  tar: [R("zip", "archive", { options: [O.archLevel], note: "Real USTAR parse + ZIP repack, 100% local" }), R("tar-gz", "archive", { note: "Repack + gzip stream" })],
  zip: [R("tar", "archive", { note: "Real ZIP parse + USTAR repack, 100% local" }), R("tar-gz", "archive", { note: "Repack + gzip stream" })],
  "tar-gz": [R("zip", "archive", { options: [O.archLevel] }), R("tar", "archive", { note: "Gunzip + untar" })],
  "tar-bz2": [R("zip", "archive", { options: [O.archLevel] }), R("tar", "archive")],
  gz: [R("zip", "archive", { note: "Single-file gzip stream repacked into ZIP" })],
  bz2: [R("zip", "archive", { note: "Single-file bzip2 stream repacked into ZIP" })],
  // Honest "coming soon" entries — surfaced in the Format Matrix only.
  "tar-xz": [R("zip", "archive", { comingSoon: true, note: "XZ decompressor not yet bundled" })],
  xz: [R("zip", "archive", { comingSoon: true, note: "XZ decompressor not yet bundled" })],
  "7z": [R("zip", "archive", { comingSoon: true, note: "7-Zip WASM extraction planned" })],
  rar: [R("zip", "archive", { comingSoon: true, note: "RAR extraction planned (unRAR license permitting)" })],
  zst: [R("zip", "archive", { comingSoon: true, note: "Zstandard WASM planned" })],

  /* ---------------- data ---------------- */
  csv: [R("json", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote, O.dataPretty] }), R("jsonl", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote] }), R("xlsx", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote] }), R("tsv", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote] })],
  tsv: [R("json", "data", { options: [O.csvHeader, O.dataPretty] }), R("jsonl", "data", { options: [O.csvHeader] }), R("csv", "data", { options: [O.csvHeader, O.csvQuote] }), R("xlsx", "data", { options: [O.csvHeader] })],
  json: [R("csv", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote] }), R("tsv", "data", { options: [O.csvHeader] }), R("xlsx", "data"), R("yaml", "data", { options: [O.dataPretty] }), R("toml", "data", { options: [O.dataPretty] }), R("xml", "data", { options: [O.dataPretty] }), R("jsonl", "data")],
  jsonl: [R("json", "data", { options: [O.dataPretty] }), R("csv", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote] }), R("tsv", "data"), R("xlsx", "data")],
  ndjson: [R("json", "data"), R("csv", "data"), R("xlsx", "data")],
  xlsx: [R("csv", "data", { options: [O.csvDelimiter, O.csvHeader, O.csvQuote] }), R("tsv", "data"), R("json", "data", { options: [O.dataPretty] }), R("jsonl", "data")],
  yaml: [R("json", "data", { options: [O.dataPretty] }), R("toml", "data", { note: "Plain object trees only" }), R("csv", "data", { note: "Requires an array of flat objects at root" })],
  toml: [R("json", "data", { options: [O.dataPretty] }), R("yaml", "data")],
  xml: [R("json", "data", { options: [O.dataPretty] }), R("yaml", "data")],
  ini: [R("json", "data", { options: [O.dataPretty] })],

  /* ---------------- documents ---------------- */
  txt: [R("pdf", "pdfmake", { options: [O.docPageSize], note: "Clean typographic layout, full Unicode basic-latin" }), R("md", "docs", { note: "Markdown wrapper — plain text is valid Markdown" })],
  md: [R("html", "docs", { note: "Sanitized HTML output" }), R("txt", "docs"), R("pdf", "pdfmake", { options: [O.docPageSize], note: "Headings, lists, code and blockquotes rendered" })],
  html: [R("txt", "docs", { note: "Tag-stripped readable text" }), R("md", "docs", { note: "Structural conversion — complex layouts simplified" })],
  docx: [R("html", "docs", { note: "Via mammoth — semantic HTML, no upload" }), R("txt", "docs"), R("md", "docs"), R("pdf", "pdfmake", { options: [O.docPageSize], note: "Basic text layout (not pixel-perfect Word rendering)" })],
  rtf: [R("txt", "docs", { note: "Control-word stripper" })],
  pdf: [R("txt", "pdf", { note: "Text layer extraction" }), R("html", "pdf"), R("jpg", "pdf", { options: [O.pdfDpi, O.pdfPages], note: "Each page rendered locally; multi-page → ZIP" }), R("png", "pdf", { options: [O.pdfDpi, O.pdfPages], note: "Each page rendered locally; multi-page → ZIP" }), R("webp", "pdf", { options: [O.pdfDpi, O.pdfPages], browserDependent: true })],

  /* ---------------- ebooks ---------------- */
  epub: [R("txt", "epub", { note: "Spine-ordered text extraction" }), R("html", "epub"), R("pdf", "pdfmake", { note: "Reflowed text, basic layout" })],
  fb2: [R("html", "epub"), R("txt", "epub")],
  cbz: [R("pdf", "pdfmake", { note: "Page images bound into one PDF" })],

  /* ---------------- audio ---------------- */
  mp3: [R("wav", "audio", { options: [O.audioSampleRate, O.audioChannels] }), R("mp3", "audio", { options: [O.mp3Bitrate, O.audioSampleRate, O.audioChannels], note: "Re-encode with new bitrate" })],
  wav: [R("mp3", "audio", { options: [O.mp3Bitrate, O.audioSampleRate, O.audioChannels] }), R("wav", "audio", { options: [O.audioSampleRate, O.audioChannels], note: "Resample / channel-mix" })],
  ogg: [R("wav", "audio", { options: [O.audioSampleRate, O.audioChannels], browserDependent: true, note: "Decoded by your browser's audio engine" }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  opus: [R("wav", "audio", { options: [O.audioSampleRate], browserDependent: true }), R("mp3", "audio", { browserDependent: true })],
  flac: [R("wav", "audio", { options: [O.audioSampleRate], browserDependent: true, note: "Lossless → PCM" }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  m4a: [R("wav", "audio", { options: [O.audioSampleRate], browserDependent: true }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  aac: [R("wav", "audio", { browserDependent: true }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  aiff: [R("wav", "audio", { browserDependent: true }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],

  /* ---------------- video (codec-dependent, honestly labeled) ---------------- */
  mp4: [R("gif", "video", { options: [O.gifFps, O.gifWidth, O.gifSeconds], note: "Frame-accurate local capture via canvas" }), R("webm", "video", { options: [O.webmQuality, O.webmSeconds], browserDependent: true, note: "Real-time re-encode via MediaRecorder (Chromium)" }), R("wav", "audio", { browserDependent: true, note: "Audio track extraction via browser decoder" }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  mov: [R("gif", "video", { options: [O.gifFps, O.gifWidth, O.gifSeconds], browserDependent: true }), R("wav", "audio", { browserDependent: true }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  webm: [R("gif", "video", { options: [O.gifFps, O.gifWidth, O.gifSeconds] }), R("wav", "audio", { browserDependent: true }), R("mp3", "audio", { options: [O.mp3Bitrate], browserDependent: true })],
  mkv: [R("gif", "video", { options: [O.gifFps, O.gifWidth, O.gifSeconds], browserDependent: true, note: "Only if your browser can decode the container" })],

  /* ---------------- 3D ---------------- */
  stl: [R("obj", "mesh", { note: "ASCII + binary STL supported" }), R("glb", "mesh", { note: "Embedded-buffer glTF 2.0" })],
  obj: [R("stl", "mesh", { note: "Binary STL output" }), R("glb", "mesh")],
  ply: [R("stl", "mesh", { note: "ASCII + little-endian binary PLY" }), R("obj", "mesh")],

  /* ---------------- fonts ---------------- */
  ttf: [R("woff", "font", { note: "zlib-wrapped WOFF container" })],
  otf: [R("ttf", "font", { note: "CFF → TrueType glyf outlines" }), R("woff", "font")],
  woff: [R("ttf", "font", { note: "Unwrap + decompile" })],

  /* ---------------- subtitles ---------------- */
  srt: [R("vtt", "docs", { note: "Cue timing preserved" })],
  vtt: [R("srt", "docs")],
};

/* ------------------------------------------------------------------ */
/* Reverse index + helpers                                             */
/* ------------------------------------------------------------------ */

const routesByInput = new Map<string, ConversionRoute[]>();
for (const [input, routes] of Object.entries(CONVERSIONS)) {
  routesByInput.set(input, routes);
}

export function getRoutes(inputFormatId: string): ConversionRoute[] {
  return routesByInput.get(inputFormatId) ?? [];
}

/** Routes offered in the output selector (real only, comingSoon hidden). */
export function getAvailableRoutes(inputFormatId: string): ConversionRoute[] {
  return getRoutes(inputFormatId).filter((r) => !r.comingSoon);
}

export function getComingSoonRoutes(inputFormatId: string): ConversionRoute[] {
  return getRoutes(inputFormatId).filter((r) => r.comingSoon);
}

export function getRoute(input: string, output: string): ConversionRoute | undefined {
  return getRoutes(input).find((r) => r.output === output);
}

export function hasRoute(input: string, output: string): boolean {
  return !!getRoute(input, output) && !getRoute(input, output)!.comingSoon;
}

/** All formats that can be converted INTO the given format. */
export function getInputsFor(outputFormatId: string): string[] {
  const inputs: string[] = [];
  for (const [input, routes] of routesByInput) {
    if (routes.some((r) => r.output === outputFormatId && !r.comingSoon)) inputs.push(input);
  }
  return inputs;
}

/** Formats with at least one real route. */
export function getSupportedFormatIds(): Set<string> {
  const s = new Set<string>();
  for (const [input, routes] of routesByInput) {
    if (routes.some((r) => !r.comingSoon)) s.add(input);
    for (const r of routes) if (!r.comingSoon) s.add(r.output);
  }
  return s;
}

export function formatsByCategory(category: CategoryId) {
  return FORMATS.filter((x) => x.category === category);
}

export function defaultTargetFor(inputFormatId: string): string | undefined {
  return getAvailableRoutes(inputFormatId)[0]?.output;
}

export function defaultOptions(route: ConversionRoute): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of route.options ?? []) out[f.key] = f.default;
  return out;
}

/* ------------------------------------------------------------------ */
/* Popular pairs (tools page, search quick picks)                      */
/* ------------------------------------------------------------------ */

export interface PopularPair {
  input: string;
  output: string;
  label?: string;
}

export const POPULAR_PAIRS: PopularPair[] = [
  { input: "tar", output: "zip" },
  { input: "zip", output: "tar" },
  { input: "heic", output: "jpg" },
  { input: "pdf", output: "jpg" },
  { input: "jpg", output: "pdf" },
  { input: "png", output: "webp" },
  { input: "webp", output: "jpg" },
  { input: "docx", output: "pdf" },
  { input: "csv", output: "json" },
  { input: "json", output: "csv" },
  { input: "xlsx", output: "csv" },
  { input: "md", output: "pdf" },
  { input: "epub", output: "pdf" },
  { input: "mp4", output: "gif" },
  { input: "mp3", output: "wav" },
  { input: "stl", output: "obj" },
  { input: "srt", output: "vtt" },
  { input: "svg", output: "png" },
];

/* ------------------------------------------------------------------ */
/* Tool catalog (Tools view)                                           */
/* ------------------------------------------------------------------ */

export interface ToolDef {
  id: string;
  title: string;
  description: string;
  category: "pdf" | "image" | "archive" | "media";
  /** pair-based tools prefill the converter; panel-based tools open a panel */
  pair?: PopularPair;
  panel?: "extract" | "merge-pdf" | "split-pdf" | "rotate-pdf" | "images-to-pdf" | "pdf-metadata";
  multi?: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "pdf-to-jpg", title: "PDF → JPG", description: "Render each PDF page to a JPEG image, fully local.", category: "pdf", pair: { input: "pdf", output: "jpg" } },
  { id: "pdf-to-png", title: "PDF → PNG", description: "Rasterize PDF pages to lossless PNG images.", category: "pdf", pair: { input: "pdf", output: "png" } },
  { id: "merge-pdf", title: "Merge PDF", description: "Combine multiple PDFs into one document.", category: "pdf", panel: "merge-pdf", multi: true },
  { id: "split-pdf", title: "Split PDF", description: "Extract page ranges into a new PDF.", category: "pdf", panel: "split-pdf" },
  { id: "rotate-pdf", title: "Rotate PDF", description: "Rotate all pages by 90°, 180° or 270°.", category: "pdf", panel: "rotate-pdf" },
  { id: "pdf-metadata", title: "PDF Metadata", description: "Inspect title, author and page count locally.", category: "pdf", panel: "pdf-metadata" },
  { id: "jpg-to-pdf", title: "JPG → PDF", description: "Bind images into a paginated PDF.", category: "pdf", panel: "images-to-pdf", multi: true },
  { id: "images-to-pdf", title: "Images → PDF", description: "PNG, WebP, HEIC, TIFF → one PDF document.", category: "pdf", panel: "images-to-pdf", multi: true },
  { id: "jpg-to-png", title: "JPG → PNG", description: "Lossless re-container with alpha support.", category: "image", pair: { input: "jpg", output: "png" } },
  { id: "heic-to-jpg", title: "HEIC → JPG", description: "Decode Apple HEIC photos via local WASM.", category: "image", pair: { input: "heic", output: "jpg" } },
  { id: "webp-to-jpg", title: "WebP → JPG", description: "Convert WebP images to universal JPEG.", category: "image", pair: { input: "webp", output: "jpg" } },
  { id: "png-to-webp", title: "PNG → WebP", description: "Compress screenshots for the web.", category: "image", pair: { input: "png", output: "webp" } },
  { id: "svg-to-png", title: "SVG → PNG", description: "Rasterize vectors at any resolution.", category: "image", pair: { input: "svg", output: "png" } },
  { id: "tar-to-zip", title: "TAR → ZIP", description: "Parse USTAR tarballs and repack as ZIP.", category: "archive", pair: { input: "tar", output: "zip" } },
  { id: "zip-to-tar", title: "ZIP → TAR", description: "Repack ZIP entries into a POSIX tarball.", category: "archive", pair: { input: "zip", output: "tar" } },
  { id: "targz-to-zip", title: "TAR.GZ → ZIP", description: "Decompress and repack, no server round-trip.", category: "archive", pair: { input: "tar-gz", output: "zip" } },
  { id: "bz2-to-zip", title: "BZ2 → ZIP", description: "Decompress bzip2 streams into a ZIP.", category: "archive", pair: { input: "bz2", output: "zip" } },
  { id: "extract", title: "Extract Archive", description: "Peek inside ZIP/TAR/GZ/BZ2 and pull files out.", category: "archive", panel: "extract" },
  { id: "mp4-to-mp3", title: "MP4 → MP3", description: "Extract the audio track locally.", category: "media", pair: { input: "mp4", output: "mp3" } },
  { id: "mp4-to-gif", title: "Video → GIF", description: "Capture frames into an animated GIF.", category: "media", pair: { input: "mp4", output: "gif" } },
  { id: "mp3-to-wav", title: "MP3 → WAV", description: "Decode to uncompressed PCM audio.", category: "media", pair: { input: "mp3", output: "wav" } },
  { id: "flac-to-mp3", title: "FLAC → MP3", description: "Lossless to portable lossy, in-browser.", category: "media", pair: { input: "flac", output: "mp3" } },
];
