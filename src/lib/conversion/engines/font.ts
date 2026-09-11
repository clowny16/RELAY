/* Font engine — worker-safe. OTF/WOFF → TTF, TTF/OTF → WOFF via opentype.js + fflate zlib. */
import type { ConvertContext, ConversionResultPayload } from "../types";
import { zlibSync } from "fflate";

interface OpenTypeFont {
  names: { fontFamily?: { en?: string } };
  numGlyphs: number;
  unitsPerEm: number;
  toArrayBuffer(): ArrayBuffer;
}

let otMod: { parse: (b: ArrayBuffer) => OpenTypeFont } | null = null;
async function opentype() {
  if (!otMod) {
    const mod = await import("opentype.js");
    const m = (mod as unknown as { default?: typeof mod }).default ?? mod;
    otMod = m as { parse: (b: ArrayBuffer) => OpenTypeFont };
  }
  return otMod;
}

/** Wrap sfnt (TTF) bytes inside a WOFF container with per-table zlib compression. */
function sfntToWoff(ttf: Uint8Array): Uint8Array {
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const numTables = dv.getUint16(4);

  interface TableRec { tag: number; data: Uint8Array; origLen: number; origCheck: number }
  const tables: TableRec[] = [];
  let totalSfnt = 12 + 16 * numTables;
  for (let i = 0; i < numTables; i++) {
    const base = 16 + 16 * i;
    const tag = dv.getUint32(base, false);
    const offset = dv.getUint32(base + 8, false);
    const len = dv.getUint32(base + 12, false);
    const check = dv.getUint32(base + 4, false);
    if (offset + len > ttf.byteLength) throw new Error("Font table offsets out of range — corrupted font.");
    tables.push({ tag, data: ttf.subarray(offset, offset + len), origLen: len, origCheck: check });
    totalSfnt += (len + 3) & ~3;
  }

  let outSize = 44 + 20 * numTables;
  const compressedData: Uint8Array[] = [];
  for (const t of tables) {
    const c = zlibSync(t.data, { level: 6 });
    if (c.length < t.origLen) {
      compressedData.push(c);
      outSize += c.length;
    } else {
      compressedData.push(t.data);
      outSize += t.origLen;
    }
  }

  const out = new Uint8Array((outSize + 3) & ~3);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, 0x774f4646, false); // 'wOFF'
  ov.setUint32(4, dv.getUint32(0, false), false); // sfnt version
  ov.setUint32(8, out.byteLength, false);
  ov.setUint16(12, numTables, false);
  ov.setUint16(14, 0, false);
  ov.setUint32(16, totalSfnt, false);
  ov.setUint16(20, 1, false);
  ov.setUint16(22, 0, false);

  let dataOffset = 44 + 20 * numTables;
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    const c = compressedData[i];
    const dirBase = 44 + 20 * i;
    ov.setUint32(dirBase, t.tag, false); // tag
    ov.setUint32(dirBase + 4, dataOffset, false); // offset
    ov.setUint32(dirBase + 8, c.length < t.origLen ? c.length : t.origLen, false); // compLength (== origLength ⇒ uncompressed)
    ov.setUint32(dirBase + 12, t.origLen, false); // origLength
    ov.setUint32(dirBase + 16, t.origCheck, false); // origChecksum
    out.set(c, dataOffset);
    dataOffset += (c.length + 3) & ~3;
  }
  return out;
}

export async function convertFont(ctx: ConvertContext, buffer: ArrayBuffer): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat } = ctx;
  const ot = await opentype();

  if (outputFormat === "ttf" && (inputFormat === "otf" || inputFormat === "woff")) {
    let font: OpenTypeFont;
    try {
      font = ot.parse(buffer);
    } catch {
      throw new Error("Could not parse this font — the file may be corrupted or DRM-restricted.");
    }
    const family = font.names?.fontFamily?.en ?? "Unknown";
    const bytes = new Uint8Array(font.toArrayBuffer());
    return { bytes, mime: "font/ttf", ext: "ttf", meta: { family, glyphs: font.numGlyphs, unitsPerEm: font.unitsPerEm } };
  }

  if (outputFormat === "woff" && (inputFormat === "ttf" || inputFormat === "otf")) {
    let font: OpenTypeFont;
    try {
      font = ot.parse(buffer);
    } catch {
      throw new Error("Could not parse this font — the file may be corrupted.");
    }
    const ttfBytes = new Uint8Array(font.toArrayBuffer());
    const bytes = sfntToWoff(ttfBytes);
    return { bytes, mime: "font/woff", ext: "woff", meta: { family: font.names?.fontFamily?.en ?? "Unknown", glyphs: font.numGlyphs } };
  }

  throw new Error(`No font pipeline for ${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()}`);
}
