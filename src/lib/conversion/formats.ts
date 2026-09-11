import type { CategoryId, FormatDef } from "./types";

/* ---------- category metadata ---------- */

export const CATEGORIES: Record<CategoryId, { label: string; order: number }> = {
  document: { label: "Documents", order: 0 },
  image: { label: "Images", order: 1 },
  audio: { label: "Audio", order: 2 },
  video: { label: "Video", order: 3 },
  archive: { label: "Archives", order: 4 },
  ebook: { label: "eBooks", order: 5 },
  data: { label: "Data", order: 6 },
  threeD: { label: "3D", order: 7 },
  font: { label: "Fonts", order: 8 },
  subtitle: { label: "Subtitles", order: 9 },
  developer: { label: "Developer", order: 10 },
};

/* ---------- format catalog ---------- */

const f = (
  id: string,
  name: string,
  category: CategoryId,
  extensions: string[],
  mime: string,
  binary: boolean,
  blurb?: string
): FormatDef => ({ id, name, category, extensions, mime, binary, blurb });

export const FORMATS: FormatDef[] = [
  // ---- documents ----
  f("pdf", "PDF Document", "document", ["pdf"], "application/pdf", true, "Portable Document Format"),
  f("doc", "Word Document (Legacy)", "document", ["doc"], "application/msword", true),
  f("docx", "Word Document", "document", ["docx"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document", true, "Office Open XML text document"),
  f("xls", "Excel Spreadsheet (Legacy)", "document", ["xls"], "application/vnd.ms-excel", true),
  f("xlsx", "Excel Spreadsheet", "document", ["xlsx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", true),
  f("pptx", "PowerPoint Presentation", "document", ["pptx", "pptm", "ppt"], "application/vnd.openxmlformats-officedocument.presentationml.presentation", true),
  f("odt", "OpenDocument Text", "document", ["odt"], "application/vnd.oasis.opendocument.text", true),
  f("ods", "OpenDocument Spreadsheet", "document", ["ods"], "application/vnd.oasis.opendocument.spreadsheet", true),
  f("odp", "OpenDocument Presentation", "document", ["odp"], "application/vnd.oasis.opendocument.presentation", true),
  f("rtf", "Rich Text Format", "document", ["rtf"], "application/rtf", true),
  f("txt", "Plain Text", "document", ["txt"], "text/plain", false),
  f("md", "Markdown", "document", ["md", "markdown"], "text/markdown", false),
  f("html", "HTML Document", "document", ["html", "htm"], "text/html", false),
  f("tex", "LaTeX Source", "document", ["tex"], "application/x-tex", false),

  // ---- images ----
  f("jpg", "JPEG Image", "image", ["jpg", "jpeg"], "image/jpeg", true, "Lossy photographic image format"),
  f("png", "PNG Image", "image", ["png"], "image/png", true, "Lossless image with alpha channel"),
  f("gif", "GIF Image", "image", ["gif"], "image/gif", true, "Indexed-color image, animation support"),
  f("webp", "WebP Image", "image", ["webp"], "image/webp", true, "Modern image format by Google"),
  f("bmp", "BMP Image", "image", ["bmp"], "image/bmp", true, "Uncompressed Windows bitmap"),
  f("tiff", "TIFF Image", "image", ["tiff", "tif"], "image/tiff", true, "High-quality raster for print/scanning"),
  f("svg", "SVG Vector", "image", ["svg"], "image/svg+xml", false, "Scalable vector graphics"),
  f("ico", "ICO Icon", "image", ["ico"], "image/x-icon", true, "Windows icon container"),
  f("heic", "HEIC Image", "image", ["heic", "heif"], "image/heic", true, "Apple High Efficiency Image (WebAssembly decoded)"),
  f("avif", "AVIF Image", "image", ["avif"], "image/avif", true, "AV1-based modern image format"),
  f("psd", "Photoshop Document", "image", ["psd"], "image/vnd.adobe.photoshop", true),
  f("tga", "Truevision TGA", "image", ["tga"], "image/x-tga", true),
  f("dds", "DirectDraw Surface", "image", ["dds"], "image/vnd-ms.dds", true),
  f("jp2", "JPEG 2000", "image", ["jp2", "j2k"], "image/jp2", true),
  f("jxl", "JPEG XL", "image", ["jxl"], "image/jxl", true),
  f("cr2", "Canon RAW 2", "image", ["cr2"], "image/x-canon-cr2", true),
  f("cr3", "Canon RAW 3", "image", ["cr3"], "image/x-canon-cr3", true),
  f("nef", "Nikon Electronic Format", "image", ["nef"], "image/x-nikon-nef", true),
  f("arw", "Sony Alpha RAW", "image", ["arw"], "image/x-sony-arw", true),
  f("orf", "Olympus RAW", "image", ["orf"], "image/x-olympus-orf", true),
  f("rw2", "Panasonic RAW", "image", ["rw2"], "image/x-panasonic-rw2", true),
  f("raf", "Fujifilm RAW", "image", ["raf"], "image/x-fuji-raf", true),
  f("dng", "Digital Negative", "image", ["dng"], "image/x-adobe-dng", true),

  // ---- audio ----
  f("mp3", "MP3 Audio", "audio", ["mp3"], "audio/mpeg", true),
  f("wav", "WAV Audio", "audio", ["wav"], "audio/wav", true, "Uncompressed PCM audio"),
  f("aac", "AAC Audio", "audio", ["aac"], "audio/aac", true),
  f("m4a", "M4A Audio", "audio", ["m4a"], "audio/mp4", true),
  f("flac", "FLAC Audio", "audio", ["flac"], "audio/flac", true, "Lossless audio"),
  f("ogg", "OGG Audio", "audio", ["ogg"], "audio/ogg", true),
  f("opus", "Opus Audio", "audio", ["opus"], "audio/opus", true),
  f("wma", "Windows Media Audio", "audio", ["wma"], "audio/x-ms-wma", true),
  f("aiff", "AIFF Audio", "audio", ["aiff", "aif"], "audio/aiff", true),
  f("amr", "AMR Audio", "audio", ["amr"], "audio/amr", true),
  f("mid", "MIDI Sequence", "audio", ["mid", "midi"], "audio/midi", true),
  f("ac3", "Dolby Digital AC-3", "audio", ["ac3"], "audio/ac3", true),
  f("mka", "Matroska Audio", "audio", ["mka"], "audio/x-matroska", true),
  f("ape", "Monkey's Audio", "audio", ["ape"], "audio/ape", true),

  // ---- video ----
  f("mp4", "MP4 Video", "video", ["mp4", "m4v"], "video/mp4", true),
  f("mkv", "Matroska Video", "video", ["mkv"], "video/x-matroska", true),
  f("avi", "AVI Video", "video", ["avi"], "video/x-msvideo", true),
  f("mov", "QuickTime MOV", "video", ["mov"], "video/quicktime", true),
  f("webm", "WebM Video", "video", ["webm"], "video/webm", true),
  f("wmv", "Windows Media Video", "video", ["wmv"], "video/x-ms-wmv", true),
  f("flv", "Flash Video", "video", ["flv"], "video/x-flv", true),
  f("mpeg", "MPEG Video", "video", ["mpeg", "mpg"], "video/mpeg", true),
  f("ts", "MPEG Transport Stream", "video", ["ts", "mts", "m2ts"], "video/mp2t", true),
  f("ogv", "OGG Video", "video", ["ogv"], "video/ogg", true),
  f("3gp", "3GPP Video", "video", ["3gp", "3g2"], "video/3gpp", true),
  f("vob", "DVD Video Object", "video", ["vob"], "video/dv", true),
  f("mxf", "Material Exchange Format", "video", ["mxf"], "application/mxf", true),
  f("asf", "Advanced Streaming Format", "video", ["asf"], "video/x-ms-asf", true),

  // ---- archives ----
  f("zip", "ZIP Archive", "archive", ["zip"], "application/zip", true, "Universal archive container"),
  f("tar", "TAR Archive", "archive", ["tar"], "application/x-tar", true, "POSIX tape archive (USTAR)"),
  f("tar-gz", "TAR.GZ Archive", "archive", ["tar.gz", "tgz"], "application/gzip", true, "Gzipped tarball"),
  f("tar-bz2", "TAR.BZ2 Archive", "archive", ["tar.bz2", "tbz2"], "application/x-bzip2", true, "Bzip2 tarball"),
  f("tar-xz", "TAR.XZ Archive", "archive", ["tar.xz", "txz"], "application/x-xz", true),
  f("gz", "Gzip Compressed", "archive", ["gz"], "application/gzip", true, "Single-file gzip stream"),
  f("bz2", "Bzip2 Compressed", "archive", ["bz2"], "application/x-bzip2", true),
  f("xz", "XZ Compressed", "archive", ["xz"], "application/x-xz", true),
  f("7z", "7-Zip Archive", "archive", ["7z"], "application/x-7z-compressed", true, "High-compression archive"),
  f("rar", "RAR Archive", "archive", ["rar"], "application/vnd.rar", true, "Proprietary archive format"),
  f("zst", "Zstandard Compressed", "archive", ["zst"], "application/zstd", true),
  f("br", "Brotli Compressed", "archive", ["br"], "application/x-brotli", true),
  f("iso", "ISO Disk Image", "archive", ["iso"], "application/x-iso9660-image", true),
  f("cab", "Cabinet Archive", "archive", ["cab"], "application/vnd.ms-cab-compressed", true),

  // ---- ebooks ----
  f("epub", "EPUB eBook", "ebook", ["epub"], "application/epub+zip", true, "Reflowable digital book (ZIP of XHTML)"),
  f("mobi", "MOBI eBook", "ebook", ["mobi"], "application/x-mobipocket-ebook", true),
  f("azw3", "Kindle AZW3", "ebook", ["azw3", "azw"], "application/vnd.amazon.ebook", true),
  f("fb2", "FictionBook 2", "ebook", ["fb2"], "application/x-fictionbook+xml", false),
  f("cbz", "Comic Book ZIP", "ebook", ["cbz"], "application/vnd.comicbook+zip", true, "ZIP archive of page images"),

  // ---- data ----
  f("csv", "CSV Data", "data", ["csv"], "text/csv", false, "Comma-separated values"),
  f("tsv", "TSV Data", "data", ["tsv"], "text/tab-separated-values", false),
  f("json", "JSON Data", "data", ["json"], "application/json", false),
  f("jsonl", "JSONL / NDJSON", "data", ["jsonl", "ndjson"], "application/jsonl", false, "Newline-delimited JSON records"),
  f("yaml", "YAML Data", "data", ["yaml", "yml"], "application/yaml", false),
  f("toml", "TOML Data", "data", ["toml"], "application/toml", false),
  f("xml", "XML Data", "data", ["xml"], "application/xml", false),
  f("ini", "INI Config", "developer", ["ini", "cfg", "conf"], "text/plain", false),
  f("sql", "SQL Dump", "data", ["sql"], "application/sql", false),
  f("sqlite", "SQLite Database", "data", ["sqlite", "sqlite3", "db"], "application/vnd.sqlite3", true),
  f("parquet", "Apache Parquet", "data", ["parquet"], "application/x-parquet", true),
  f("avro", "Apache Avro", "data", ["avro"], "application/avro", true),

  // ---- 3d ----
  f("stl", "STL Mesh", "threeD", ["stl"], "model/stl", true, "Stereolithography triangle mesh"),
  f("obj", "OBJ Mesh", "threeD", ["obj"], "model/obj", false, "Wavefront geometry + materials"),
  f("glb", "GLB Binary glTF", "threeD", ["glb"], "model/gltf-binary", true, "Self-contained glTF 2.0"),
  f("gltf", "glTF Scene", "threeD", ["gltf"], "model/gltf+json", false),
  f("ply", "PLY Mesh", "threeD", ["ply"], "application/ply", true, "Polygon file format"),
  f("fbx", "Autodesk FBX", "threeD", ["fbx"], "application/octet-stream", true),
  f("dae", "Collada DAE", "threeD", ["dae"], "model/vnd.collada+xml", false),
  f("3mf", "3D Manufacturing Format", "threeD", ["3mf"], "model/3mf", true),

  // ---- fonts ----
  f("ttf", "TrueType Font", "font", ["ttf"], "font/ttf", true),
  f("otf", "OpenType Font", "font", ["otf"], "font/otf", true, "PostScript outlines (CFF)"),
  f("woff", "WOFF Font", "font", ["woff"], "font/woff", true, "Web Open Font Format (zlib)"),
  f("woff2", "WOFF2 Font", "font", ["woff2"], "font/woff2", true, "Web Open Font Format (brotli)"),
  f("eot", "Embedded OpenType", "font", ["eot"], "application/vnd.ms-fontobject", true),

  // ---- subtitles ----
  f("srt", "SubRip Subtitle", "subtitle", ["srt"], "application/x-subrip", false),
  f("vtt", "WebVTT Subtitle", "subtitle", ["vtt"], "text/vtt", false),
];

export const FORMAT_MAP = new Map<string, FormatDef>(FORMATS.map((x) => [x.id, x]));

export function getFormat(id: string | null | undefined): FormatDef | undefined {
  return id ? FORMAT_MAP.get(id) : undefined;
}

export function formatLabel(id: string | null | undefined): string {
  return getFormat(id)?.name ?? (id ? id.toUpperCase() : "Unknown");
}
