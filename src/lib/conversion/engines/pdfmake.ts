/* pdfmake engine — worker-safe PDF creation & manipulation via pdf-lib.
 * txt/md/html→PDF (basic typographic layout), images→PDF, cbz→PDF,
 * merge/split/rotate/compress tools. */
import type { ConvertContext, ConversionResultPayload } from "../types";
import { PDFDocument, StandardFonts, rgb, RotationTypes } from "pdf-lib";
import { unzipSync } from "fflate";
import { imageToPngBytes } from "./image";

/* ---------------- text layout ---------------- */

interface TextBlock {
  text: string;
  size: number;
  bold: boolean;
  mono: boolean;
  gap: number;
}

interface ParsedLine {
  block: TextBlock;
  line: string;
}

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

function wrapLine(line: string, maxWidth: number, size: number, bold: boolean, mono: boolean, widthOf: (s: string, size: number, bold: boolean, mono: boolean) => number): string[] {
  if (line === "") return [""];
  const words = line.split(/(\s+)/);
  const out: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current + w;
    if (widthOf(candidate, size, bold, mono) <= maxWidth || current === "") {
      current = candidate;
    } else {
      out.push(current.replace(/\s+$/, ""));
      current = w.trimStart();
    }
  }
  if (current) out.push(current);
  return out;
}

function sanitizeForWinAnsi(s: string): string {
  // Standard fonts are WinAnsi; replace common unicode chars, drop the rest
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\xFF]/g, "?");
}

async function renderBlocksToPdf(blocks: TextBlock[], pageSize: string, title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title.slice(0, 120) || "Document");
  const [pw, ph] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4;
  const margin = 56;
  const maxW = pw - margin * 2;

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold);

  const widthOf = (s: string, size: number, isBold: boolean, isMono: boolean) => {
    const font = isMono ? (isBold ? monoBold : mono) : isBold ? bold : regular;
    return font.widthOfTextAtSize(sanitizeForWinAnsi(s), size);
  };

  let page = pdf.addPage([pw, ph]);
  let y = ph - margin;

  for (const block of blocks) {
    const lines = wrapLine(block.text, maxW, block.size, block.bold, block.mono, widthOf);
    for (const line of lines) {
      const lineHeight = block.size * 1.45;
      if (y - lineHeight < margin) {
        page = pdf.addPage([pw, ph]);
        y = ph - margin;
      }
      const font = block.mono ? (block.bold ? monoBold : mono) : block.bold ? bold : regular;
      page.drawText(sanitizeForWinAnsi(line), {
        x: margin,
        y: y - block.size,
        size: block.size,
        font,
        color: rgb(0.08, 0.08, 0.08),
      });
      y -= lineHeight;
    }
    y -= block.gap;
  }
  return pdf.save({ useObjectStreams: true });
}

/* ---------------- markdown → blocks ---------------- */

function mdToBlocks(md: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let inCode = false;
  let listPending = false;

  const push = (text: string, size: number, bold: boolean, mono: boolean, gap: number) => {
    blocks.push({ text, size, bold, mono, gap });
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "    ");
    if (/^```/.test(line.trim())) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      push(line, 9, false, true, 1);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      push(heading[2].replace(/[*_`]/g, ""), [22, 18, 15, 13, 12, 11][level - 1], true, false, 8);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const text = line.replace(/^(\s*)[-*+]\s+/, "$1- ").replace(/^(\s*)(\d+)[.)]\s+/, "$1$2. ");
      push(text.replace(/[*_`]/g, ""), 11, false, false, 2);
      listPending = true;
      continue;
    }
    if (/^>\s?/.test(line)) {
      push(line.replace(/^>\s?/, ""), 11, false, false, 2);
      continue;
    }
    if (line.trim() === "") {
      if (blocks.length) blocks[blocks.length - 1].gap += 6;
      continue;
    }
    push(line.replace(/[*_`]/g, ""), 11, false, false, 4);
    listPending = false;
  }
  void listPending;
  return blocks;
}

function htmlToBlocks(html: string): TextBlock[] {
  const text = html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n@@H1@@$1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n@@H2@@$1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n@@H3@@$1\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|table|pre|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  const blocks: TextBlock[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("@@H1@@")) blocks.push({ text: line.slice(6), size: 22, bold: true, mono: false, gap: 8 });
    else if (line.startsWith("@@H2@@")) blocks.push({ text: line.slice(6), size: 18, bold: true, mono: false, gap: 8 });
    else if (line.startsWith("@@H3@@")) blocks.push({ text: line.slice(6), size: 15, bold: true, mono: false, gap: 6 });
    else blocks.push({ text: line, size: 11, bold: false, mono: false, gap: 4 });
  }
  return blocks;
}

/* ---------------- images → PDF ---------------- */

async function imagesToPdf(images: { bytes: Uint8Array; mime: string; width: number; height: number }[], margin: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const img of images) {
    const [pw, ph] = PAGE_SIZES.a4;
    const usableW = pw - margin * 2;
    const usableH = ph - margin * 2;
    const scale = Math.min(usableW / img.width, usableH / img.height, 4);
    const w = img.width * scale;
    const h = img.height * scale;
    const page = pdf.addPage([pw, ph]);
    if (img.mime === "image/jpeg") {
      const embedded = await pdf.embedJpg(img.bytes);
      page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    } else {
      const embedded = await pdf.embedPng(img.bytes);
      page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }
  return pdf.save({ useObjectStreams: true });
}

/* ---------------- main ---------------- */

export async function runPdfMake(ctx: ConvertContext, buffer: ArrayBuffer): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat, options, onProgress, fileName } = ctx;
  const pageSize = String(options.pageSize ?? "a4");
  const margin = Number(options.margin ?? 0);
  const baseName = fileName.replace(/\.[^./]+$/, "");

  /* single image → pdf (also heic pre-converted to png bytes) */
  if (outputFormat === "pdf" && ["jpg", "png", "webp", "bmp", "gif", "ico", "svg", "tiff", "avif", "heic"].includes(inputFormat)) {
    onProgress({ progress: 0.4, stage: "processing", detail: "Rasterizing image…" });
    const png = await imageToPngBytes(buffer, `image/${inputFormat}`);
    onProgress({ progress: 0.7, stage: "finalizing", detail: "Binding into PDF…" });
    const bytes = await imagesToPdf([{ ...png, mime: "image/png" }], margin);
    return { bytes, mime: "application/pdf", ext: "pdf", meta: { pages: 1 } };
  }

  /* text-like → pdf */
  if (outputFormat === "pdf" && ["txt", "md", "html", "docx", "epub", "srt", "vtt", "csv", "json"].includes(inputFormat)) {
    onProgress({ progress: 0.3, stage: "processing", detail: "Laying out text…" });
    let blocks: TextBlock[];
    if (inputFormat === "md") {
      blocks = mdToBlocks(new TextDecoder().decode(buffer));
    } else if (inputFormat === "html") {
      blocks = htmlToBlocks(new TextDecoder().decode(buffer));
    } else if (inputFormat === "docx") {
      const mammoth = await import("mammoth");
      const mod = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth;
      const result = await mod.convertToHtml({ arrayBuffer: buffer });
      blocks = htmlToBlocks(result.value);
    } else if (inputFormat === "epub") {
      const { unzipSync: unzip, strFromU8 } = await import("fflate");
      const files = unzip(new Uint8Array(buffer));
      const container = files["META-INF/container.xml"];
      if (!container) throw new Error("Not a valid EPUB. DRM-protected books cannot be processed.");
      const opfPath = strFromU8(container).match(/full-path="([^"]+)"/)?.[1];
      const opf = opfPath && files[opfPath] ? strFromU8(files[opfPath]) : "";
      const opfDir = opfPath && opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
      const manifest = new Map<string, string>();
      for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
        const id = m[0].match(/id="([^"]+)"/)?.[1];
        const href = m[0].match(/href="([^"]+)"/)?.[1];
        if (id && href) manifest.set(id, opfDir + href);
      }
      const docs: string[] = [];
      for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/gi)) {
        const href = manifest.get(m[1]);
        const normalized = href?.replace(/^\.\//, "");
        const f = normalized && (files[normalized] ?? files[decodeURIComponent(normalized)]);
        if (f) docs.push(strFromU8(f));
      }
      blocks = docs.flatMap((d) => htmlToBlocks(d));
    } else {
      const text = new TextDecoder().decode(buffer);
      blocks = text.split(/\r?\n/).map((line) => ({ text: line, size: 10, bold: false, mono: inputFormat === "json" || inputFormat === "csv", gap: 2 }));
    }
    const bytes = await renderBlocksToPdf(blocks, pageSize, baseName);
    return { bytes, mime: "application/pdf", ext: "pdf", meta: { engine: "pdf-lib" } };
  }

  /* cbz → pdf */
  if (inputFormat === "cbz" && outputFormat === "pdf") {
    onProgress({ progress: 0.2, stage: "reading", detail: "Unpacking comic archive…" });
    const files = unzipSync(new Uint8Array(buffer));
    const names = Object.keys(files).filter((n) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!names.length) throw new Error("No page images found inside the CBZ archive.");
    const images: { bytes: Uint8Array; mime: string; width: number; height: number }[] = [];
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      const data = files[n];
      const mime = /\.(jpe?g)$/i.test(n) ? "image/jpeg" : "image/png";
      if (mime === "image/jpeg") {
        const bmp = await createImageBitmap(new Blob([data], { type: mime })).catch(() => null);
        if (!bmp) continue;
        images.push({ bytes: data, mime, width: bmp.width, height: bmp.height });
        bmp.close();
      } else {
        const png = await imageToPngBytes(data.slice().buffer as ArrayBuffer, mime);
        images.push({ ...png, mime: "image/png" });
      }
      onProgress({ progress: 0.2 + 0.5 * ((i + 1) / names.length), stage: "processing", detail: `Decoding page ${i + 1}/${names.length}` });
    }
    if (!images.length) throw new Error("No decodable page images inside the archive.");
    const bytes = await imagesToPdf(images, margin);
    return { bytes, mime: "application/pdf", ext: "pdf", meta: { pages: images.length } };
  }

  throw new Error(`No pdfmake pipeline for ${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()}`);
}

/* ---------------- PDF manipulation tools ---------------- */

export async function mergePdfs(buffers: ArrayBuffer[], onProgress: (p: number) => void): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (let i = 0; i < buffers.length; i++) {
    const src = await PDFDocument.load(buffers[i], { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress((i + 1) / buffers.length);
  }
  out.setTitle("Merged document");
  return out.save({ useObjectStreams: true });
}

export async function splitPdf(buffer: ArrayBuffer, ranges: string): Promise<Uint8Array> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = src.getPageCount();
  const pages = parseRanges(ranges, total);
  if (!pages.length) throw new Error("No pages selected — check the page range syntax.");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages);
  copied.forEach((p) => out.addPage(p));
  return out.save({ useObjectStreams: true });
}

export async function rotatePdf(buffer: ArrayBuffer, degrees: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  for (const page of pdf.getPages()) {
    const current = page.getRotation().angle;
    page.setRotation({ type: RotationTypes.Degrees, angle: (current + degrees) % 360 });
  }
  return pdf.save({ useObjectStreams: true });
}

export async function compressPdf(buffer: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}

export function parseRanges(spec: string, total: number): number[] {
  const out: number[] = [];
  const s = spec.trim() || `1-${total}`;
  for (const part of s.split(",")) {
    const m = part.trim().match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m) continue;
    if (m[1] && !m[2]) out.push(Number(m[1]) - 1);
    else {
      const from = m[1] ? Number(m[1]) : 1;
      const to = m[3] ? Number(m[3]) : total;
      for (let i = from; i <= Math.min(to, total); i++) out.push(i - 1);
    }
  }
  return [...new Set(out)].filter((i) => i >= 0 && i < total).sort((a, b) => a - b);
}
