import type { Detection } from "./types";
import { FORMATS, getFormat } from "./formats";

/* ------------------------------------------------------------------ */
/* Magic-byte / content based format detection (never uploads a byte)  */
/* ------------------------------------------------------------------ */

const extMap = new Map<string, string>();
for (const def of FORMATS) {
  for (const ext of def.extensions) extMap.set(ext.toLowerCase(), def.id);
}

export function extOf(fileName: string): string {
  const base = fileName.toLowerCase().replace(/\/+$/, "");
  // prefer longest compound extension (.tar.gz)
  const m2 = base.match(/\.([a-z0-9]+\.[a-z0-9]+)$/);
  if (m2 && extMap.has(m2[1])) return m2[1];
  const m1 = base.match(/\.([a-z0-9]+)$/);
  return m1 ? m1[1] : "";
}

function formatIdFromExt(fileName: string): string | null {
  const e = extOf(fileName);
  return e ? extMap.get(e) ?? null : null;
}

function ascii(head: Uint8Array, start: number, len: number): string {
  let s = "";
  const end = Math.min(head.length, start + len);
  for (let i = start; i < end; i++) s += String.fromCharCode(head[i]);
  return s;
}

function hex(head: Uint8Array, n: number): string {
  return Array.from(head.slice(0, n))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

function hasSubstr(head: Uint8Array, needle: string, from = 0): boolean {
  // cheap byte-substring search on ASCII needle
  const n = needle.length;
  const limit = Math.min(head.length, from + 65536);
  outer: for (let i = from; i <= limit - n; i++) {
    for (let j = 0; j < n; j++) {
      if (head[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
}

function looksLikeText(head: Uint8Array): boolean {
  const n = Math.min(head.length, 512);
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    const b = head[i];
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) suspicious++;
  }
  return suspicious / Math.max(1, n) < 0.05;
}

function textFormatOf(head: Uint8Array): string | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head.slice(0, 2048)).replace(/^\uFEFF/, "");
  const t = text.trimStart();
  if (/^WEBVTT/i.test(t)) return "vtt";
  if (/^<!DOCTYPE\s+html|^<html[\s>]/i.test(t)) return "html";
  if (/^<\?xml/i.test(t)) {
    if (/<(fictionbook|FB2)/i.test(t)) return "fb2";
    return "xml";
  }
  if (/^\{[\s]*"/.test(t) || /^\[[\s]*\{/.test(t) || t === "{}" || t === "[]") return "json";
  if (/^\d{2,3}\r?\n[0-2]\d:[0-5]\d:[0-5]\d[,.]/.test(t)) return "srt";
  if (/^%\!TeX|^\\documentclass/i.test(t)) return "tex";
  if (/^solid\s/i.test(t)) return "stl";
  return null;
}

/** Read a slice of the file and detect via signature + content heuristics. */
export async function detectFormat(file: File): Promise<Detection> {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const extId = formatIdFromExt(file.name);

  let sigId: string | null = null;
  let sigHex: string | undefined;
  let label: string | undefined;

  const u32 = (o: number) => (head[o] | (head[o + 1] << 8) | (head[o + 2] << 16) | (head[o + 3] << 24)) >>> 0;

  if (head.length >= 8) {
    const b = head;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      sigId = "jpg"; sigHex = "FF D8 FF";
    } else if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      sigId = "png"; sigHex = "89 50 4E 47";
    } else if (ascii(b, 0, 3) === "GIF") {
      sigId = "gif"; sigHex = "47 49 46 38";
    } else if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
      sigId = "webp"; sigHex = "RIFF·WEBP";
    } else if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") {
      sigId = "wav"; sigHex = "RIFF·WAVE";
    } else if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "AVI ") {
      sigId = "avi"; sigHex = "RIFF·AVI ";
    } else if (b[0] === 0x42 && b[1] === 0x4d) {
      sigId = "bmp"; sigHex = "42 4D";
    } else if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) {
      sigId = "ico"; sigHex = "00 00 01 00";
    } else if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0)) {
      sigId = "tiff"; sigHex = "49 49 2A 00 / MM";
    } else if (ascii(b, 0, 5) === "%PDF-") {
      sigId = "pdf"; sigHex = "25 50 44 46";
    } else if (b[0] === 0x1f && b[1] === 0x8b) {
      sigId = extId === "tar-gz" ? "tar-gz" : "gz"; sigHex = "1F 8B";
    } else if (ascii(b, 0, 3) === "BZh") {
      sigId = extId === "tar-bz2" ? "tar-bz2" : "bz2"; sigHex = "42 5A 68";
    } else if (b[0] === 0xfd && ascii(b, 1, 5) === "7zXZ") {
      sigId = extId === "tar-xz" ? "tar-xz" : "xz"; sigHex = "FD 37 7A 58 5A";
    } else if (ascii(b, 0, 6) === "7z\xBC\xAF\x27\x1C") {
      sigId = "7z"; sigHex = "37 7A BC AF 27 1C";
    } else if (ascii(b, 0, 4) === "Rar!") {
      sigId = "rar"; sigHex = "52 61 72 21";
    } else if (b[0] === 0x53 && b[1] === 0x5a && b[2] === 0x44 && b[3] === 0x48) {
      sigId = "zst"; sigHex = "53 5A 44 48";
    } else if (ascii(b, 0, 4) === "fLaC") {
      sigId = "flac"; sigHex = "66 4C 61 43";
    } else if (ascii(b, 0, 4) === "OggS") {
      sigId = ascii(b, 28, 4) === "Opus" ? "opus" : "ogg"; sigHex = "4F 67 67 53";
    } else if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
      sigId = "mp3"; sigHex = "49 44 33";
    } else if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (!extId || extId === "mp3" || extId === "aac")) {
      sigId = extId === "aac" ? "aac" : "mp3"; sigHex = "FF Ex (MPEG sync)";
    } else if (ascii(b, 4, 4) === "ftyp") {
      const brand = ascii(b, 8, 4).toLowerCase();
      if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("hevc") || brand.startsWith("mif1")) {
        sigId = "heic";
      } else if (brand.startsWith("avi")) {
        sigId = "avif";
      } else if (brand.startsWith("qt")) {
        sigId = "mov";
      } else {
        sigId = "mp4";
      }
      sigHex = "ftyp:" + brand.toUpperCase();
    } else if (u32(0) === 0x1a45dfa3) {
      sigId = extId === "mka" || extId === "webm" ? extId : "mkv"; sigHex = "1A 45 DF A3 (EBML)";
    } else if (ascii(b, 0, 4) === "wOFF") {
      sigId = "woff"; sigHex = "77 4F 46 46";
    } else if (ascii(b, 0, 4) === "wOF2") {
      sigId = "woff2"; sigHex = "77 4F 46 32";
    } else if (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0 && head.length > 12) {
      sigId = "ttf"; sigHex = "00 01 00 00";
    } else if (ascii(b, 0, 4) === "OTTO") {
      sigId = "otf"; sigHex = "4F 54 54 4F";
    } else if (ascii(b, 0, 15) === "SQLite format 3") {
      sigId = "sqlite"; sigHex = "53 51 4C 69";
    } else if (b[0] === 0x37 && b[1] === 0x7a) {
      // ambiguous, fall through
    }
  }

  // TAR: "ustar" at offset 257
  if (!sigId && head.length >= 262 && ascii(head, 257, 5) === "ustar") {
    sigId = "tar";
    sigHex = "ustar @257";
  }

  // ZIP-family: detect specific OOXML / EPUB / CBZ inside ZIP container
  if (!sigId && head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b) {
    sigHex = "50 4B (ZIP)";
    if (hasSubstr(head, "mimetypeapplication/epub+zip", 0)) sigId = "epub";
    else if (hasSubstr(head, "word/")) sigId = "docx";
    else if (hasSubstr(head, "xl/")) sigId = "xlsx";
    else if (hasSubstr(head, "ppt/")) sigId = "pptx";
    else if (hasSubstr(head, "mimetypeapplication/vnd.oasis.opendocument.text")) sigId = "odt";
    else if (hasSubstr(head, "mimetypeapplication/vnd.oasis.opendocument.spreadsheet")) sigId = "ods";
    else if (hasSubstr(head, "mimetypeapplication/vnd.oasis.opendocument.presentation")) sigId = "odp";
    else if (extId === "epub" || extId === "docx" || extId === "xlsx" || extId === "pptx" || extId === "cbz" || extId === "ods" || extId === "odt" || extId === "odp") sigId = extId;
    else sigId = "zip";
  }

  // text content heuristics
  if (!sigId && looksLikeText(head)) {
    const contentId = textFormatOf(head);
    if (contentId) {
      sigId = contentId;
      sigHex = undefined;
    } else if (!extId) {
      sigId = "txt";
    }
  }

  // DMG (apple) check before generic
  if (!sigId && head.length >= 512 && u32(512 - 4) === 0x454e4543 /* koly 'CNE ' */) {
    sigId = null; // not convertible, will fall back to extension
  }

  if (sigId) {
    const sigFmt = getFormat(sigId);
    const mismatch = !!extId && extId !== sigId && !(sigFmt?.extensions.includes(extId));
    if (mismatch) {
      // extension belongs to another known format → flag it
      const extFmt = getFormat(extId!);
      return {
        formatId: sigId,
        via: "signature",
        signatureHex: sigHex,
        label: sigFmt?.name ?? sigId,
        mismatch: !!extFmt,
      };
    }
    return {
      formatId: sigId,
      via: "signature",
      signatureHex: sigHex,
      label: sigFmt?.name ?? sigId,
    };
  }

  // fall back to extension
  if (extId) {
    return {
      formatId: extId,
      via: "extension",
      label: getFormat(extId)?.name,
    };
  }
  return { formatId: null, via: "unknown" };
}

export { extMap };
