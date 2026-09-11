/* eBook engine — worker-safe. EPUB → HTML/TXT (fflate + XML spine walk), FB2 → HTML/TXT. */
import type { ConvertContext, ConversionResultPayload } from "../types";
import { unzipSync, strFromU8 } from "fflate";

const enc = new TextEncoder();

function stripHtmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeInline(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "blocked:");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------------- EPUB ---------------- */

function epubSpine(files: Record<string, Uint8Array>): { docs: string[]; title: string } {
  const containerXml = files["META-INF/container.xml"];
  if (!containerXml) throw new Error("Not a valid EPUB (missing container.xml). DRM-protected books will also fail here.");
  const container = strFromU8(containerXml);
  const opfMatch = container.match(/full-path="([^"]+)"/);
  if (!opfMatch) throw new Error("Cannot locate EPUB package document.");
  const opfPath = opfMatch[1];
  const opfFile = files[opfPath];
  if (!opfFile) throw new Error("EPUB package document missing from archive.");
  const opf = strFromU8(opfFile);
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const title = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? "";
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = m[0].match(/id="([^"]+)"/)?.[1];
    const href = m[0].match(/href="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, opfDir + href);
  }
  const docs: string[] = [];
  for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"[^>]*\/?>/gi)) {
    const href = manifest.get(m[1]);
    if (!href) continue;
    const normalized = href.replace(/^\.\//, "");
    const file = files[normalized] ?? files[decodeURIComponent(normalized)];
    if (file) docs.push(strFromU8(file));
  }
  if (docs.length === 0) {
    // fallback: every xhtml/html file
    for (const [path, data] of Object.entries(files)) {
      if (/\.x?html?$/i.test(path)) docs.push(strFromU8(data));
    }
  }
  if (docs.length === 0) throw new Error("EPUB contains no readable XHTML documents.");
  return { docs, title };
}

/* ---------------- FB2 ---------------- */

function fb2ToHtml(xml: string): string {
  const title = xml.match(/<book-title>([\s\S]*?)<\/book-title>/)?.[1] ?? "FictionBook";
  const body = xml.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? xml;
  const html = body
    .replace(/<title>([\s\S]*?)<\/title>/g, "<h2>$1</h2>")
    .replace(/<subtitle>([\s\S]*?)<\/subtitle>/g, "<h3>$1</h3>")
    .replace(/<poem>([\s\S]*?)<\/poem>/g, "<blockquote>$1</blockquote>")
    .replace(/<epigraph>([\s\S]*?)<\/epigraph>/g, "<blockquote>$1</blockquote>")
    .replace(/<(strong|em|code)\b/g, "<$1")
    .replace(/<\/(strong|em|code)>/g, "</$1>")
    .replace(/<(?!\/?)(?!h2|h3|p\b|blockquote|strong|em|code|br)[a-zA-Z][^>]*>/g, "")
    .replace(/<\/(?!h2|h3|p\b|blockquote|strong|em|code|br)[a-zA-Z][^>]*>/g, "");
  return `<h1>${escapeHtml(title)}</h1>\n${html}`;
}

/* ---------------- main ---------------- */

export async function convertEbook(ctx: ConvertContext, buffer: ArrayBuffer): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat, onProgress } = ctx;
  onProgress({ progress: 0.2, stage: "processing", detail: "Unpacking container…" });

  if (inputFormat === "fb2") {
    const xml = new TextDecoder("utf-8").decode(buffer);
    if (outputFormat === "html") {
      const html = fb2ToHtml(xml);
      const page = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>FictionBook</title></head><body>\n${html}\n</body></html>`;
      return { bytes: enc.encode(page), mime: "text/html", ext: "html", textPreview: stripHtmlToText(html).slice(0, 2000) };
    }
    if (outputFormat === "txt") {
      const text = stripHtmlToText(fb2ToHtml(xml));
      return { bytes: enc.encode(text), mime: "text/plain", ext: "txt", textPreview: text.slice(0, 2000) };
    }
    throw new Error(`FB2 → ${outputFormat.toUpperCase()} not supported.`);
  }

  if (inputFormat !== "epub") throw new Error(`${inputFormat.toUpperCase()} conversion not supported.`);

  const files = unzipSync(new Uint8Array(buffer));
  const { docs, title } = epubSpine(files);
  onProgress({ progress: 0.5, stage: "processing", detail: `Walking ${docs.length} spine documents…` });

  const parts = docs.map((d) => {
    const bodyMatch = d.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : d;
  });

  if (outputFormat === "html") {
    const joined = parts.map((p) => `<section>\n${sanitizeInline(p)}\n</section>`).join("\n");
    const page = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${escapeHtml(title || "eBook")}</title></head><body>\n${joined}\n</body></html>`;
    return {
      bytes: enc.encode(page),
      mime: "text/html",
      ext: "html",
      meta: { title, sections: parts.length },
      textPreview: stripHtmlToText(joined).slice(0, 2000),
    };
  }
  if (outputFormat === "txt") {
    const text = parts.map((p) => stripHtmlToText(p)).join("\n\n");
    return { bytes: enc.encode(text), mime: "text/plain", ext: "txt", meta: { title, sections: parts.length }, textPreview: text.slice(0, 2000) };
  }
  throw new Error(`EPUB → ${outputFormat.toUpperCase()} not supported.`);
}
