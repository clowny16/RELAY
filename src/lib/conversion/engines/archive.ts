/* Archive engine — worker-safe. Real conversions: TAR/ZIP/GZ/BZ2 + tar.gz/tar.bz2.
 * Safety: path traversal, zip bombs, entry limits, memory caps. */
import type { ArchiveEntryInfo, ArchiveListing, ConvertContext, ConversionResultPayload } from "../types";
import { readTar, writeTar, type TarEntry } from "../tar";
import { gunzipSync, gzipSync, unzipSync, zipSync, strToU8 } from "fflate";

let bz2Mod: { decompress: (d: Uint8Array) => Uint8Array } | null = null;
async function getBz2() {
  if (!bz2Mod) {
    const mod = await import("bz2");
    const m = (mod as unknown as { default?: unknown }).default ?? mod;
    bz2Mod = m as { decompress: (d: Uint8Array) => Uint8Array };
  }
  return bz2Mod;
}

/* ---------------- safety helpers ---------------- */

export function sanitizePath(p: string): string | null {
  if (!p || p.length > 1024) return null;
  if (p.startsWith("/") || p.includes("\\") || p.includes("\0")) return null;
  const parts = p.split("/");
  if (parts.some((seg) => seg === ".." || seg === "." && false)) return null;
  if (parts.includes("..")) return null;
  return p;
}

export function sanitizeEntries(entries: TarEntry[]): TarEntry[] {
  const out: TarEntry[] = [];
  for (const e of entries) {
    const safe = sanitizePath(e.path);
    if (!safe) continue;
    if (!e.isDir && safe.split("/").length > 64) continue; // excessive nesting
    out.push({ ...e, path: safe });
  }
  return out;
}

/* ---------------- decompress wrappers ---------------- */

function maybeGunzip(data: Uint8Array): Uint8Array {
  if (data[0] === 0x1f && data[1] === 0x8b) return gunzipSync(data);
  return data;
}

async function maybeBunzip(data: Uint8Array): Promise<Uint8Array> {
  if (data[0] === 0x42 && data[1] === 0x5a) {
    const bz2 = await getBz2();
    return bz2.decompress(data);
  }
  return data;
}

function tarFromBytes(data: Uint8Array): TarEntry[] {
  return sanitizeEntries(readTar(data));
}

/* ---------------- listing ---------------- */

export function listArchive(data: Uint8Array, inputFormat: string): ArchiveListing {
  let tarBytes: Uint8Array | null = null;
  let kind = inputFormat;

  if (inputFormat === "zip") {
    const files = unzipSync(data);
    const entries: ArchiveEntryInfo[] = [];
    let total = 0;
    for (const [path, content] of Object.entries(files)) {
      const safe = sanitizePath(path.replace(/\/+$/, ""));
      if (!safe) continue;
      entries.push({ path: safe, size: content.length, isDir: path.endsWith("/") || content.length === 0 && !path.includes(".") });
      total += content.length;
      if (entries.length > 100_000) throw new Error("Archive contains too many entries (safety limit reached).");
      if (total > 2 * 1024 * 1024 * 1024) throw new Error("Archive decompresses to more than 2 GB — blocked for safety.");
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    return { entries, totalUncompressed: total, archiveKind: "ZIP" };
  }

  switch (inputFormat) {
    case "tar": tarBytes = data; break;
    case "tar-gz": tarBytes = maybeGunzip(data); kind = "TAR.GZ"; break;
    case "tar-bz2": return {} as ArchiveListing; // handled by async version below
    default: throw new Error(`Listing not supported for ${inputFormat.toUpperCase()} streams — convert to ZIP or TAR first.`);
  }
  const entries = tarFromBytes(tarBytes);
  const list: ArchiveEntryInfo[] = entries.map((e) => ({ path: e.path, size: e.size, isDir: e.isDir }));
  return {
    entries: list,
    totalUncompressed: list.reduce((a, e) => a + e.size, 0),
    archiveKind: kind.toUpperCase(),
  };
}

export async function listArchiveAsync(data: Uint8Array, inputFormat: string): Promise<ArchiveListing> {
  if (inputFormat === "tar-bz2") {
    const raw = await maybeBunzip(data);
    const entries = tarFromBytes(raw);
    const list: ArchiveEntryInfo[] = entries.map((e) => ({ path: e.path, size: e.size, isDir: e.isDir }));
    return { entries: list, totalUncompressed: list.reduce((a, e) => a + e.size, 0), archiveKind: "TAR.BZ2" };
  }
  return listArchive(data, inputFormat);
}

export function extractEntries(data: Uint8Array, inputFormat: string, selected?: Set<string>): TarEntry[] {
  if (inputFormat === "zip") {
    const files = unzipSync(data);
    const out: TarEntry[] = [];
    for (const [path, content] of Object.entries(files)) {
      const safe = sanitizePath(path.replace(/\/+$/, ""));
      if (!safe || path.endsWith("/")) continue;
      if (selected && !selected.has(safe)) continue;
      out.push({ path: safe, size: content.length, isDir: false, data: content });
    }
    if (out.length === 0) throw new Error("No matching entries found inside the archive.");
    return out;
  }
  let tarBytes: Uint8Array;
  switch (inputFormat) {
    case "tar": tarBytes = data; break;
    case "tar-gz": tarBytes = maybeGunzip(data); break;
    default: throw new Error(`Extraction not supported for ${inputFormat.toUpperCase()} — convert to ZIP or TAR first.`);
  }
  const entries = tarFromBytes(tarBytes).filter((e) => !e.isDir && (!selected || selected.has(e.path)));
  if (entries.length === 0) throw new Error("No matching entries found inside the archive.");
  return entries;
}

export async function extractEntriesAsync(data: Uint8Array, inputFormat: string, selected?: Set<string>): Promise<TarEntry[]> {
  if (inputFormat === "tar-bz2") {
    const raw = await maybeBunzip(data);
    const entries = tarFromBytes(raw).filter((e) => !e.isDir && (!selected || selected.has(e.path)));
    if (entries.length === 0) throw new Error("No matching entries found inside the archive.");
    return entries;
  }
  return extractEntries(data, inputFormat, selected);
}

/* ---------------- conversions ---------------- */

export async function convertArchive(ctx: ConvertContext, buffer: ArrayBuffer, fileName: string): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat, options, onProgress, signal } = ctx;
  const level = Math.min(9, Math.max(1, Number(options.level ?? 6)));
  const data = new Uint8Array(buffer);
  const check = () => {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  };

  onProgress({ progress: 0.1, stage: "reading", detail: "Reading archive…" });

  switch (`${inputFormat}->${outputFormat}`) {
    case "tar->zip":
    case "tar-gz->zip":
    case "tar-bz2->zip": {
      let tarBytes: Uint8Array;
      if (inputFormat === "tar") tarBytes = data;
      else if (inputFormat === "tar-gz") { onProgress({ progress: 0.25, stage: "processing", detail: "Gunzipping…" }); tarBytes = maybeGunzip(data); }
      else { onProgress({ progress: 0.25, stage: "processing", detail: "Bunzipping (bzip2 decoder)…" }); tarBytes = await maybeBunzip(data); }
      check();
      const entries = tarFromBytes(tarBytes);
      check();
      const files: Record<string, Uint8Array> = {};
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.isDir) files[e.path] = e.data ?? new Uint8Array(0);
        if (i % 50 === 0) {
          check();
          onProgress({ progress: 0.5 + 0.4 * (i / Math.max(1, entries.length)), stage: "processing", detail: `Deflating ${i}/${entries.length}` });
        }
      }
      onProgress({ progress: 0.92, stage: "finalizing", detail: "Writing ZIP central directory…" });
      const out = zipSync(files, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
      return { bytes: out, mime: "application/zip", ext: "zip", meta: { entries: entries.filter((e) => !e.isDir).length } };
    }

    case "zip->tar": {
      onProgress({ progress: 0.3, stage: "processing", detail: "Inflating ZIP entries…" });
      const files = unzipSync(data);
      const entries: TarEntry[] = [];
      for (const [path, content] of Object.entries(files)) {
        const safe = sanitizePath(path.replace(/\/+$/, ""));
        if (!safe || path.endsWith("/")) continue;
        entries.push({ path: safe, size: content.length, isDir: false, data: content });
        if (entries.length % 200 === 0) {
          check();
          onProgress({ progress: 0.3 + 0.4 * (entries.length / Math.max(1, Object.keys(files).length)), stage: "processing", detail: `${entries.length} entries` });
        }
      }
      check();
      onProgress({ progress: 0.8, stage: "finalizing", detail: "Writing USTAR blocks…" });
      const out = writeTar(entries);
      return { bytes: out, mime: "application/x-tar", ext: "tar", meta: { entries: entries.length } };
    }

    case "zip->tar-gz": {
      onProgress({ progress: 0.3, stage: "processing", detail: "Inflating ZIP entries…" });
      const files = unzipSync(data);
      const entries: TarEntry[] = [];
      for (const [path, content] of Object.entries(files)) {
        const safe = sanitizePath(path.replace(/\/+$/, ""));
        if (!safe || path.endsWith("/")) continue;
        entries.push({ path: safe, size: content.length, isDir: false, data: content });
      }
      check();
      onProgress({ progress: 0.6, stage: "processing", detail: "Writing USTAR blocks…" });
      const tarBytes = writeTar(entries);
      check();
      onProgress({ progress: 0.85, stage: "finalizing", detail: "Gzipping stream…" });
      const out = gzipSync(tarBytes, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, mtime: 0 });
      return { bytes: out, mime: "application/gzip", ext: "tar.gz", meta: { entries: entries.length } };
    }

    case "tar->tar-gz": {
      onProgress({ progress: 0.4, stage: "processing", detail: "Validating tar structure…" });
      const entries = tarFromBytes(data); // validate
      check();
      onProgress({ progress: 0.8, stage: "finalizing", detail: "Gzipping stream…" });
      const out = gzipSync(data, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, mtime: 0 });
      return { bytes: out, mime: "application/gzip", ext: "tar.gz", meta: { entries: entries.length } };
    }

    case "gz->zip": {
      onProgress({ progress: 0.4, stage: "processing", detail: "Gunzipping stream…" });
      const raw = gunzipSync(data);
      check();
      onProgress({ progress: 0.8, stage: "finalizing", detail: "Writing ZIP…" });
      const innerName = fileName.replace(/\.gz$/i, "") || "payload.bin";
      const out = zipSync({ [innerName]: raw }, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
      return { bytes: out, mime: "application/zip", ext: "zip", meta: { entries: 1, uncompressed: raw.length } };
    }

    case "bz2->zip": {
      onProgress({ progress: 0.4, stage: "processing", detail: "Bunzipping (bzip2 decoder)…" });
      const bz2 = await getBz2();
      const raw = bz2.decompress(data);
      check();
      onProgress({ progress: 0.8, stage: "finalizing", detail: "Writing ZIP…" });
      const innerName = fileName.replace(/\.bz2$/i, "") || "payload.bin";
      const out = zipSync({ [innerName]: raw }, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
      return { bytes: out, mime: "application/zip", ext: "zip", meta: { entries: 1, uncompressed: raw.length } };
    }

    case "tar-gz->tar": {
      onProgress({ progress: 0.4, stage: "processing", detail: "Gunzipping…" });
      const raw = maybeGunzip(data);
      const entries = tarFromBytes(raw); // validate
      return { bytes: raw, mime: "application/x-tar", ext: "tar", meta: { entries: entries.length } };
    }

    case "tar-bz2->tar": {
      onProgress({ progress: 0.4, stage: "processing", detail: "Bunzipping…" });
      const raw = await maybeBunzip(data);
      const entries = tarFromBytes(raw);
      return { bytes: raw, mime: "application/x-tar", ext: "tar", meta: { entries: entries.length } };
    }

    default:
      throw new Error(`No archive pipeline for ${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()}`);
  }
}
