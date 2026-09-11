/* HEIC engine — main thread, WebAssembly libheif via heic2any. Decodes locally. */
import type { ConvertContext, ConversionResultPayload } from "../types";
import { postConvert } from "../worker-client";

export async function convertHeic(ctx: ConvertContext, file: Blob): Promise<ConversionResultPayload> {
  const { outputFormat, options, onProgress, fileName, signal } = ctx;
  onProgress({ progress: -1, stage: "loading-engine", detail: "Loading HEIC decoder (WASM, ~2 MB)…" });
  const heic2any = (await import("heic2any")).default ?? (await import("heic2any"));
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

  onProgress({ progress: -1, stage: "processing", detail: "Decoding HEIC locally…" });
  // heic2any always produces a browser-safe blob; PNG keeps quality for re-encode
  const decoded = await heic2any({
    blob: file,
    toType: "image/png",
    quality: Number(options.quality ?? 92) / 100,
  });
  const blob = Array.isArray(decoded) ? decoded[0] : decoded;
  if (!blob || blob.size === 0) throw new Error("This HEIC file could not be decoded — it may be corrupted, DRM-protected, or an unsupported HEIF variant.");

  // Route the decoded PNG through the standard image pipeline in the worker
  onProgress({ progress: 0.6, stage: "processing", detail: `Encoding ${outputFormat.toUpperCase()}…` });
  const buffer = await blob.arrayBuffer();
  return postConvert({
    inputFormat: "png",
    outputFormat,
    fileName: fileName.replace(/\.(heic|heif)$/i, ".png"),
    mime: "image/png",
    options,
    buffer,
    onProgress: (progress, stage, detail) => onProgress({ progress: 0.6 + progress * 0.4, stage, detail }),
  });
}
