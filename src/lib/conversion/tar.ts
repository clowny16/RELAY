/* Minimal, dependency-free USTAR tar reader/writer (worker-safe).
 * Supports: regular files, directories, GNU long names ('L' type), pax headers ignored safely. */

export interface TarEntry {
  path: string;
  size: number;
  isDir: boolean;
  data: Uint8Array | null; // null for dirs
}

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

function parseOctal(bytes: Uint8Array, offset: number, length: number): number {
  let s = "";
  for (let i = offset; i < offset + length; i++) {
    const b = bytes[i];
    if (b === 0 || b === 0x20) {
      if (s.length > 0) break;
      continue;
    }
    s += String.fromCharCode(b);
  }
  if (!s) return 0;
  return parseInt(s.replace(/[^0-7]/g, ""), 8) || 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const limit = offset + length;
  while (end < limit && bytes[end] !== 0) end++;
  return DECODER.decode(bytes.slice(offset, end)).replace(/\/+$/, "");
}

export const TAR_MAX_ENTRIES = 100_000;
export const TAR_MAX_TOTAL = 2 * 1024 * 1024 * 1024; // 2 GB decompressed guard

export function readTar(data: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let total = 0;
  let pendingLongName: string | null = null;

  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const name = readString(header, 0, 100);
    const size = parseOctal(header, 124, 12);
    const type = String.fromCharCode(header[156]);
    const prefix = readString(header, 345, 155);

    offset += 512;
    const fileData = size > 0 ? data.subarray(offset, offset + size) : null;
    offset += Math.ceil(size / 512) * 512;

    if (type === "L") {
      // GNU long name entry
      pendingLongName = fileData ? DECODER.decode(fileData.slice(0, Math.max(0, fileData.length - 1))).replace(/\/+$/, "") : name;
      continue;
    }
    if (type === "x" || type === "g") {
      // pax extended header — skip
      continue;
    }

    let path = pendingLongName ?? (prefix ? `${prefix}/${name}` : name);
    pendingLongName = null;
    if (!path) continue;

    const isDir = type === "5" || path.endsWith("/");
    path = path.replace(/\/+$/, "");
    total += size;
    if (entries.length >= TAR_MAX_ENTRIES) throw new Error("Archive contains too many entries (safety limit reached).");
    if (total > TAR_MAX_TOTAL) throw new Error("Archive decompresses to more than 2 GB — blocked for safety.");
    entries.push({ path, size, isDir, data: isDir ? null : (fileData ?? null) });
  }
  if (entries.length === 0) throw new Error("No readable entries — this file may not be a valid tar archive.");
  return entries;
}

function writeStringField(block: Uint8Array, offset: number, length: number, value: string) {
  const bytes = ENCODER.encode(value);
  block.fill(0, offset, offset + length);
  block.set(bytes.subarray(0, length - 1), offset);
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number) {
  // length includes trailing NUL
  let s = value.toString(8).padStart(length - 1, "0");
  if (s.length > length - 1) s = "7".repeat(length - 1); // saturate
  block.fill(0, offset, offset + length);
  for (let i = 0; i < s.length; i++) block[offset + i] = s.charCodeAt(i);
}

function makeHeader(path: string, size: number, isDir: boolean): Uint8Array {
  const block = new Uint8Array(512);
  writeStringField(block, 0, 100, path);
  writeOctal(block, 100, 8, 0o644);
  writeOctal(block, 108, 8, 0); // uid
  writeOctal(block, 116, 8, 0); // gid
  writeOctal(block, 124, 12, isDir ? 0 : size);
  writeOctal(block, 136, 12, 0); // mtime
  writeOctal(block, 148, 8, 0); // checksum placeholder (spaces)
  block[156] = isDir ? 0x35 : 0x30; // '5' dir, '0' file
  writeStringField(block, 257, 6, "ustar");
  writeStringField(block, 263, 2, "00");

  // checksum: sum of all header bytes with checksum field as spaces
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i];
  writeOctal(block, 148, 7, sum);
  block[155] = 0x20;

  return block;
}

export function writeTar(entries: TarEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const e of entries) {
    const path = e.isDir ? `${e.path}/` : e.path;
    const header = makeHeader(path, e.isDir ? 0 : e.data?.length ?? 0, e.isDir);
    chunks.push(header);
    total += 512;
    if (!e.isDir && e.data && e.data.length > 0) {
      chunks.push(e.data);
      total += e.data.length;
      const pad = (512 - (e.data.length % 512)) % 512;
      if (pad > 0) {
        chunks.push(new Uint8Array(pad));
        total += pad;
      }
    }
  }
  // two zero blocks + padding to 10240 record
  const endPad = new Uint8Array(1024);
  chunks.push(endPad);
  total += 1024;
  const recordRemainder = (10240 - (total % 10240)) % 10240;
  if (recordRemainder > 0) {
    chunks.push(new Uint8Array(recordRemainder));
  }
  const out = new Uint8Array(total + recordRemainder);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
