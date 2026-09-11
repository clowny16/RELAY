/* Main-thread engines — need DOM/web platform APIs or ship their own workers.
 * pdf (pdfjs-dist), audio (decodeAudioData + lame), video (MediaRecorder/frames), heic (heic2any). */
import type { ConvertContext, ConversionResultPayload } from "../types";

export function friendlyError(e: Error | string): string {
  const raw = typeof e === "string" ? e : e?.message ?? "Unknown error";
  const m = raw.toLowerCase();
  if (m.includes("abort") || m.includes("cancel")) return "Conversion cancelled.";
  if (m.includes("decode") || m.includes("codec")) return "This file could not be decoded. The codec may be unsupported in your browser or the file may be corrupted.";
  if (m.includes("memory")) return "Ran out of memory. Try a smaller file, or close other tabs and retry.";
  if (m.includes("password") || m.includes("encrypt")) return "This file is password-protected and cannot be processed locally.";
  if (m.includes("drm")) return "This file is DRM-protected and cannot be converted.";
  return raw.length > 240 ? "This file could not be converted. The format may be unsupported or the file may be corrupted." : raw;
}

/* ------------------------------------------------------------------ */
/* PDF engine (pdfjs-dist) — main thread, parsing happens in pdfjs worker */
/* ------------------------------------------------------------------ */

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function loadPdf(buffer: ArrayBuffer) {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true }).promise;
}

function parsePageRanges(spec: string, total: number): number[] {
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

export async function convertPdf(ctx: ConvertContext, buffer: ArrayBuffer): Promise<ConversionResultPayload> {
  const { outputFormat, options, onProgress, signal } = ctx;
  onProgress({ progress: 0.15, stage: "loading-engine", detail: "Booting PDF engine…" });
  const doc = await loadPdf(buffer);
  const pageCount = doc.numPages;

  const check = () => {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  };

  if (outputFormat === "txt" || outputFormat === "html") {
    const pages: string[] = [];
    const selected = parsePageRanges(String(options.pages ?? ""), pageCount);
    for (let i = 0; i < selected.length; i++) {
      check();
      const page = await doc.getPage(selected[i] + 1);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/[ \t]{2,}/g, "  ")
        .trim();
      pages.push(text);
      page.cleanup();
      onProgress({ progress: 0.2 + 0.6 * ((i + 1) / selected.length), stage: "processing", detail: `Page ${i + 1}/${selected.length}` });
    }
    if (outputFormat === "txt") {
      const out = pages.join("\n\n----- page break -----\n\n");
      return { bytes: new TextEncoder().encode(out), mime: "text/plain", ext: "txt", meta: { pages: selected.length, totalPages: pageCount }, textPreview: out.slice(0, 2000) };
    }
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = pages
      .map((t, i) => `<section class="page"><h3>Page ${selected[i] + 1}</h3>\n${esc(t).split(/\n+/).map((p) => `<p>${p}</p>`).join("\n")}</section>`)
      .join("\n");
    const html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>PDF text</title><style>body{font:14px/1.6 Georgia,serif;max-width:760px;margin:2rem auto;padding:0 1rem}.page{border-bottom:1px solid #ddd;padding:1rem 0}</style></head><body>\n${body}\n</body></html>`;
    return { bytes: new TextEncoder().encode(html), mime: "text/html", ext: "html", meta: { pages: selected.length, totalPages: pageCount } };
  }

  if (outputFormat === "jpg" || outputFormat === "png" || outputFormat === "webp") {
    const selected = parsePageRanges(String(options.pages ?? ""), pageCount);
    const dpi = Number(options.dpi ?? 144);
    const scale = Math.min(4, dpi / 72);
    const mime = outputFormat === "jpg" ? "image/jpeg" : outputFormat === "png" ? "image/png" : "image/webp";
    const ext = outputFormat;
    const results: { name: string; data: Uint8Array }[] = [];
    const { zipSync } = await import("fflate");

    for (let i = 0; i < selected.length; i++) {
      check();
      onProgress({ progress: (i / Math.max(1, selected.length)) * 0.85, stage: "processing", detail: `Rendering page ${i + 1}/${selected.length}` });
      const page = await doc.getPage(selected[i] + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx2d = canvas.getContext("2d")!;
      if (outputFormat === "jpg") {
        ctx2d.fillStyle = "#ffffff";
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvasContext: ctx2d, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, outputFormat === "png" ? undefined : 0.92));
      if (!blob) throw new Error(`Your browser cannot encode ${outputFormat.toUpperCase()}.`);
      canvas.width = 0; canvas.height = 0;
      page.cleanup();
      results.push({ name: `page-${String(selected[i] + 1).padStart(3, "0")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }

    if (results.length === 1) {
      return { bytes: results[0].data, mime, ext, meta: { pages: 1, totalPages: pageCount } };
    }
    const files: Record<string, Uint8Array> = {};
    results.forEach((r) => (files[r.name] = r.data));
    const zipped = zipSync(files, { level: 1 });
    return { bytes: zipped, mime: "application/zip", ext: "zip", meta: { pages: results.length, totalPages: pageCount, zipped: true } };
  }

  throw new Error(`PDF → ${outputFormat.toUpperCase()} is not supported.`);
}

/** Render page 1 of a PDF to a data URL for previews. */
export async function renderPdfFirstPage(buffer: ArrayBuffer, maxWidth = 620): Promise<string> {
  const doc = await loadPdf(buffer);
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxWidth / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.85);
  page.cleanup();
  doc.destroy();
  return url;
}

export async function readPdfMetadata(buffer: ArrayBuffer): Promise<{ pages: number; title?: string; author?: string; producer?: string; creationDate?: string }> {
  const doc = await loadPdf(buffer);
  const meta = await doc.getMetadata().catch(() => ({ info: {} as Record<string, unknown> }));
  const info = (meta.info ?? {}) as Record<string, unknown>;
  const out = {
    pages: doc.numPages,
    title: (info.Title as string) || undefined,
    author: (info.Author as string) || undefined,
    producer: (info.Producer as string) || undefined,
    creationDate: info.CreationDate ? new Date(info.CreationDate as string).toISOString().slice(0, 10) : undefined,
  };
  doc.destroy();
  return out;
}

/* ------------------------------------------------------------------ */
/* Audio engine — decodeAudioData → WAV (PCM16) / MP3 (lamejs)         */
/* ------------------------------------------------------------------ */

async function decodeAudio(file: Blob): Promise<AudioBuffer> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("Your browser does not expose the Web Audio API.");
  const ctx = new AC();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    return buffer;
  } catch {
    throw new Error("This audio file could not be decoded — the codec may be unsupported in your browser.");
  } finally {
    void ctx.close();
  }
}

async function resample(buffer: AudioBuffer, sampleRate: number, channels: string | number): Promise<AudioBuffer> {
  const frames = Math.ceil(buffer.duration * sampleRate);
  const targetChannels = channels === "keep" ? buffer.numberOfChannels : Number(channels);
  const OAC = window.OfflineAudioContext;
  if (!OAC) return buffer;
  const offline = new OAC(Math.min(2, Math.max(1, targetChannels)), frames, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  return offline.startRendering();
}

function encodeWav(buffer: AudioBuffer): Uint8Array {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(out);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  dv.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, channels, true);
  dv.setUint32(24, buffer.sampleRate, true);
  dv.setUint32(28, buffer.sampleRate * blockAlign, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, 16, true);
  writeStr(36, "data");
  dv.setUint32(40, dataSize, true);

  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let s = chans[c][i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(out);
}

async function encodeMp3(buffer: AudioBuffer, bitrate: number, onProgress: (p: number) => void): Promise<Uint8Array> {
  const lame = await import("@breezystack/lamejs");
  const Lame = ((lame as unknown as { default?: typeof lame }).default ?? lame) as typeof lame;
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Lame.Mp3Encoder(channels as 1 | 2, buffer.sampleRate, bitrate);
  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : null;
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  const to16 = (f: Float32Array, start: number, end: number) => {
    const out = new Int16Array(end - start);
    for (let i = start; i < end; i++) {
      let s = f[i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      out[i - start] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };
  for (let i = 0; i < left.length; i += blockSize) {
    const l = to16(left, i, Math.min(i + blockSize, left.length));
    const r = right ? to16(right, i, Math.min(i + blockSize, right.length)) : undefined;
    const encoded = channels > 1 && r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));
    if (i % (blockSize * 100) === 0) onProgress(Math.min(0.95, i / left.length));
  }
  const flush = encoder.flush();
  if (flush.length > 0) chunks.push(new Uint8Array(flush));
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function convertAudio(ctx: ConvertContext, file: Blob): Promise<ConversionResultPayload> {
  const { outputFormat, options, onProgress } = ctx;
  onProgress({ progress: -1, stage: "processing", detail: "Decoding audio locally…" });
  let buffer = await decodeAudio(file);

  const sampleRateOpt = String(options.sampleRate ?? "keep");
  const targetRate = sampleRateOpt === "keep" ? buffer.sampleRate : Number(sampleRateOpt);
  if (targetRate !== buffer.sampleRate || (options.channels !== undefined && String(options.channels) !== "keep")) {
    onProgress({ progress: -1, stage: "processing", detail: `Resampling to ${Math.round(targetRate / 100) / 10} kHz…` });
    buffer = await resample(buffer, targetRate, String(options.channels ?? "keep"));
  }

  const meta = { duration: Number(buffer.duration.toFixed(2)), sampleRate: buffer.sampleRate, channels: Math.min(2, buffer.numberOfChannels) };

  if (outputFormat === "wav") {
    onProgress({ progress: 0.8, stage: "finalizing", detail: "Writing PCM stream…" });
    await new Promise((r) => setTimeout(r, 0));
    const bytes = encodeWav(buffer);
    return { bytes, mime: "audio/wav", ext: "wav", meta };
  }
  if (outputFormat === "mp3") {
    const bitrate = Number(options.bitrate ?? 192);
    onProgress({ progress: 0.1, stage: "finalizing", detail: `Encoding ${bitrate} kbps MP3…` });
    const bytes = await encodeMp3(buffer, bitrate, (p) => onProgress({ progress: 0.1 + p * 0.85, stage: "finalizing", detail: `Encoding ${bitrate} kbps MP3…` }));
    return { bytes, mime: "audio/mpeg", ext: "mp3", meta: { ...meta, bitrate } };
  }
  throw new Error(`Audio → ${outputFormat.toUpperCase()} is not supported in-browser.`);
}

/* ------------------------------------------------------------------ */
/* Video engine — GIF via frame capture, WebM via MediaRecorder        */
/* ------------------------------------------------------------------ */

async function makeVideoElement(file: Blob): Promise<HTMLVideoElement> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Your browser cannot decode this video container/codec."));
  });
  return video;
}

export async function convertVideoToGif(ctx: ConvertContext, file: Blob): Promise<ConversionResultPayload> {
  const { options, onProgress, signal } = ctx;
  const fps = Number(options.fps ?? 10);
  const targetWidth = Number(options.width ?? 360);
  const maxSeconds = Number(options.seconds ?? 10);

  onProgress({ progress: -1, stage: "loading-engine", detail: "Loading video decoder…" });
  const video = await makeVideoElement(file);
  const duration = Math.min(video.duration || maxSeconds, maxSeconds);
  if (!video.videoWidth) throw new Error("No video track found.");
  const scale = Math.min(1, targetWidth / video.videoWidth);
  const w = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
  const h = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d", { willReadFrequently: true })!;

  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const totalFrames = Math.max(1, Math.floor(duration * fps));

  for (let f = 0; f < totalFrames; f++) {
    if (signal.aborted) {
      URL.revokeObjectURL(video.src);
      throw new DOMException("Cancelled", "AbortError");
    }
    const t = f / fps;
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = Math.min(t, (video.duration || maxSeconds) - 0.001);
      setTimeout(() => reject(new Error("Seek timed out — video may be corrupted.")), 8000);
    });
    c.drawImage(video, 0, 0, w, h);
    const { data } = c.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay: Math.round(1000 / fps) });
    onProgress({ progress: (f + 1) / totalFrames, stage: "processing", detail: `Capturing frame ${f + 1}/${totalFrames}` });
  }
  gif.finish();
  URL.revokeObjectURL(video.src);
  const bytes = new Uint8Array(gif.bytes());
  return { bytes, mime: "image/gif", ext: "gif", meta: { frames: totalFrames, width: w, height: h, duration: Number(duration.toFixed(1)) } };
}

export async function convertVideoToWebm(ctx: ConvertContext, file: Blob): Promise<ConversionResultPayload> {
  const { options, onProgress, signal } = ctx;
  if (typeof MediaRecorder === "undefined") throw new Error("Your browser does not support MediaRecorder — try Chrome or Edge for video re-encoding.");
  const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mimeType) throw new Error("Your browser cannot encode WebM video. Try Chrome or Edge.");

  const maxSeconds = Number(options.seconds ?? 60);
  const quality = String(options.crf ?? "balanced");
  const bitrate = quality === "high" ? 8_000_000 : quality === "small" ? 1_200_000 : 4_000_000;

  onProgress({ progress: -1, stage: "loading-engine", detail: "Loading video decoder…" });
  const video = await makeVideoElement(file);
  const duration = Math.min(video.duration || maxSeconds, maxSeconds);
  const scale = Math.min(1, 1280 / Math.max(1, video.videoWidth));
  const w = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
  const h = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(250);
  video.currentTime = 0;
  await video.play();

  const rafLoop = () => {
    if (signal.aborted || video.ended || video.currentTime >= duration) return;
    c.drawImage(video, 0, 0, w, h);
    onProgress({ progress: Math.min(0.98, video.currentTime / duration), stage: "processing", detail: `Re-encoding ${video.currentTime.toFixed(1)}s / ${duration.toFixed(1)}s` });
    requestAnimationFrame(rafLoop);
  };
  requestAnimationFrame(rafLoop);

  await new Promise<void>((resolve, reject) => {
    const check = () => {
      if (signal.aborted) {
        video.pause();
        recorder.stop();
        reject(new DOMException("Cancelled", "AbortError"));
        return;
      }
      if (video.ended || video.currentTime >= duration) {
        video.pause();
        recorder.stop();
        resolve();
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
  await done;
  URL.revokeObjectURL(video.src);
  const blob = new Blob(chunks, { type: "video/webm" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, mime: "video/webm", ext: "webm", meta: { duration: Number(duration.toFixed(1)), width: w, height: h } };
}

export { decodeAudio };
