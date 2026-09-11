/* Docs engine — worker-safe text/document transforms.
 * Markdown ⇄ HTML/TXT, HTML → MD, SRT ⇄ VTT, DOCX → HTML/TXT/MD (mammoth), RTF → TXT. */
import type { ConvertContext, ConversionResultPayload } from "../types";

const enc = new TextEncoder();

/* ---------------- HTML sanitizer (worker-safe, regex based) ---------------- */

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text\/html/gi, "blocked:")
    // strip event-attr-style JSX leftovers and srcdoc
    .replace(/\ssrcdoc\s*=\s*(".*?"|'.*?')/gi, "");
}

/* ---------------- markdown ---------------- */

async function mdToHtml(md: string): Promise<string> {
  const { marked } = await import("marked");
  marked.setOptions({ async: false, gfm: true, breaks: false });
  const raw = await marked.parse(md);
  return sanitizeHtml(raw);
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|blockquote|pre)\s*>/gi, "\n")
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

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "##### $1\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "###### $1\n")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "_$2_")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<img [^>]*alt="([^"]*)"[^>]*>/gi, "![$1]")
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|table|pre|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* markdown → plain text (light structural strip) */
function mdToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\|(.+)\|\s*\n\|[-: |]+\|/g, "$1")
    .trim();
}

/* ---------------- RTF → text ---------------- */

function rtfToText(rtf: string): string {
  let text = rtf;
  // remove picture/destination groups
  text = text.replace(/\{\\pict[\s\S]*?\}/g, "").replace(/\{\\\*[\s\S]*?\}/g, "");
  text = text.replace(/\\par[d]?\b/g, "\n").replace(/\\line\b/g, "\n").replace(/\\tab\b/g, "\t");
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  text = text.replace(/\\u(-?\d+)\s?\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)));
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, "").replace(/[{}]/g, "");
  return text.trim();
}

/* ---------------- DOCX via mammoth ---------------- */

async function docxToHtml(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const mod = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth;
  const result = await mod.convertToHtml({ arrayBuffer: buffer });
  return sanitizeHtml(result.value);
}

/* ---------------- SRT / VTT ---------------- */

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^WEBVTT.*\n?/, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  // strip numeric cue identifiers
  const lines = body.split("\n\n").map((block) => block.split("\n").filter((l, i) => !(i === 0 && /^\d+$/.test(l.trim()))).join("\n"));
  return "WEBVTT\n\n" + lines.filter(Boolean).join("\n\n");
}

function vttToSrt(vtt: string): string {
  const blocks = vtt
    .replace(/\r+/g, "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^WEBVTT[^\n]*\n?/, "")
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean);
  let out: string[] = [];
  let n = 1;
  for (const block of blocks) {
    const lines = block.split("\n");
    let idx = 0;
    if (!/-->/.test(lines[0]) && lines.length > 1 && /-->/.test(lines[1])) idx = 1; // skip cue id
    const timing = lines[idx];
    if (!timing || !timing.includes("-->")) continue;
    const srtTiming = timing.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2").replace(/(\d{2}:\d{2})\.(\d{3})/g, "00:$1,$2").split(" --> ").map((t) => t.split(" ")[0]).join(" --> ");
    const text = lines.slice(idx + 1).join("\n").trim();
    if (!text) continue;
    out.push(`${n}\n${srtTiming}\n${text}`);
    n++;
  }
  return out.join("\n\n") + "\n";
}

/* ---------------- main ---------------- */

export async function convertDocs(ctx: ConvertContext, buffer: ArrayBuffer): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat } = ctx;
  const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");

  if (inputFormat === "docx") {
    const html = await docxToHtml(buffer);
    if (outputFormat === "html") {
      const page = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Document</title></head><body>\n${html}\n</body></html>`;
      return { bytes: enc.encode(page), mime: "text/html", ext: "html", textPreview: stripHtmlToText(html).slice(0, 2000) };
    }
    if (outputFormat === "txt") return { bytes: enc.encode(stripHtmlToText(html)), mime: "text/plain", ext: "txt", textPreview: stripHtmlToText(html).slice(0, 2000) };
    if (outputFormat === "md") return { bytes: enc.encode(htmlToMarkdown(html)), mime: "text/markdown", ext: "md" };
    throw new Error(`DOCX → ${outputFormat.toUpperCase()} not supported.`);
  }

  if (inputFormat === "rtf") {
    if (outputFormat !== "txt") throw new Error("RTF conversions limited to TXT.");
    return { bytes: enc.encode(rtfToText(text)), mime: "text/plain", ext: "txt" };
  }

  switch (`${inputFormat}->${outputFormat}`) {
    case "md->html": {
      const body = await mdToHtml(text);
      const page = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Markdown Document</title></head><body>\n${body}\n</body></html>`;
      return { bytes: enc.encode(page), mime: "text/html", ext: "html", textPreview: body.slice(0, 2000) };
    }
    case "md->txt":
      return { bytes: enc.encode(mdToText(text)), mime: "text/plain", ext: "txt" };
    case "txt->md":
      return { bytes: enc.encode(text), mime: "text/markdown", ext: "md" };
    case "html->txt":
      return { bytes: enc.encode(stripHtmlToText(text)), mime: "text/plain", ext: "txt", textPreview: stripHtmlToText(text).slice(0, 2000) };
    case "html->md":
      return { bytes: enc.encode(htmlToMarkdown(text)), mime: "text/markdown", ext: "md" };
    case "srt->vtt":
      return { bytes: enc.encode(srtToVtt(text)), mime: "text/vtt", ext: "vtt", textPreview: srtToVtt(text).slice(0, 1200) };
    case "vtt->srt":
      return { bytes: enc.encode(vttToSrt(text)), mime: "application/x-subrip", ext: "srt", textPreview: vttToSrt(text).slice(0, 1200) };
    default:
      throw new Error(`No text pipeline for ${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()}`);
  }
}
