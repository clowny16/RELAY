/* Image engine — runs inside the Web Worker via OffscreenCanvas.
 * Decoders: browser-native (jpg/png/gif/webp/bmp/ico/avif/svg), UTIF (tiff).
 * Encoders: browser-native (png/jpeg/webp), custom BMP24, ICO(PNG-payload), GIF (gifenc). */
import type { ConvertContext, ConversionResultPayload } from "../types";

type RawPixels = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };
type DecodedSource = { kind: "bitmap"; bitmap: ImageBitmap } | { kind: "raw"; raw: RawPixels };

let utifMod: typeof import("utif") | null = null;
async function getUtif() {
  if (!utifMod) utifMod = await import("utif");
  return utifMod;
}

async function decodeToImageData(buffer: ArrayBuffer, inputFormat: string, mime: string): Promise<DecodedSource> {
  // TIFF via UTIF
  if (inputFormat === "tiff") {
    const UTIF = await getUtif();
    const ifds = UTIF.decode(buffer);
    if (!ifds.length) throw new Error("Corrupted TIFF file.");
    UTIF.decodeImage(buffer, ifds[0], ifds);
    const rgba = UTIF.toRGBA8(ifds[0]);
    return {
      kind: "raw",
      raw: { width: ifds[0].width, height: ifds[0].height, data: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength) },
    };
  }
  // Everything else via createImageBitmap
  const blob = new Blob([buffer], { type: mime });
  const bitmap = await createImageBitmap(blob).catch(() => {
    throw new Error("Your browser could not decode this image. The file may be corrupted or use an unsupported codec.");
  });
  if (!bitmap.width || !bitmap.height) throw new Error("Image has invalid dimensions.");
  return { kind: "bitmap", bitmap };
}

function drawToCanvas(source: DecodedSource, targetW: number, targetH: number, background?: string): OffscreenCanvas {
  const canvas = new OffscreenCanvas(Math.max(1, targetW), Math.max(1, targetH));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (background && background !== "transparent") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (source.kind === "bitmap") {
    ctx.drawImage(source.bitmap, 0, 0, canvas.width, canvas.height);
  } else {
    const imgData = new ImageData(source.raw.data, source.raw.width, source.raw.height);
    const tmp = new OffscreenCanvas(source.raw.width, source.raw.height);
    tmp.getContext("2d")!.putImageData(imgData, 0, 0);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/* ---------- custom encoders ---------- */

function encodeBMP(canvas: OffscreenCanvas): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const rowSize = Math.ceil((w * 3) / 4) * 4; // 24bpp rows padded to 4 bytes
  const pixelBytes = rowSize * h;
  const fileSize = 54 + pixelBytes;
  const out = new Uint8Array(fileSize);
  const dv = new DataView(out.buffer);

  out[0] = 0x42; out[1] = 0x4d; // BM
  dv.setUint32(2, fileSize, true);
  dv.setUint32(10, 54, true); // pixel offset
  dv.setUint32(14, 40, true); // BITMAPINFOHEADER
  dv.setInt32(18, w, true);
  dv.setInt32(22, -h, true); // top-down
  dv.setUint16(26, 1, true); // planes
  dv.setUint16(28, 24, true); // bpp
  dv.setUint32(34, pixelBytes, true);
  dv.setUint32(38, 2835, true);
  dv.setUint32(42, 2835, true);

  const px = imageData.data;
  for (let y = 0; y < h; y++) {
    let o = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3] / 255;
      // flatten alpha onto white
      out[o++] = Math.round(px[i + 2] * a + 255 * (1 - a));
      out[o++] = Math.round(px[i + 1] * a + 255 * (1 - a));
      out[o++] = Math.round(px[i] * a + 255 * (1 - a));
    }
  }
  return out;
}

async function encodeICO(canvas: OffscreenCanvas, maxSize = 256): Promise<Uint8Array> {
  const size = Math.min(maxSize, Math.max(16, canvas.width));
  const scaled = canvas.width === size ? canvas : drawToCanvas({ kind: "bitmap", bitmap: await createImageBitmap(canvas) }, size, size);
  const pngBlob = await scaled.convertToBlob({ type: "image/png" });
  const png = new Uint8Array(await pngBlob.arrayBuffer());

  const header = new Uint8Array(6 + 16);
  const dv = new DataView(header.buffer);
  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type icon
  dv.setUint16(4, 1, true); // count
  header[6] = size >= 256 ? 0 : size; // width
  header[7] = size >= 256 ? 0 : size; // height
  header[8] = 0; // palette
  header[9] = 0; // reserved
  dv.setUint16(10, 1, true); // color planes
  dv.setUint16(12, 32, true); // bpp
  dv.setUint32(14, png.length, true);
  dv.setUint32(18, 22, true); // offset

  const out = new Uint8Array(header.length + png.length);
  out.set(header, 0);
  out.set(png, header.length);
  return out;
}

async function encodeGIF(canvas: OffscreenCanvas): Promise<Uint8Array> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const palette = quantize(imageData.data, 256);
  const index = applyPalette(imageData.data, palette);
  const gif = GIFEncoder();
  gif.writeFrame(index, canvas.width, canvas.height, { palette });
  gif.finish();
  return new Uint8Array(gif.bytes());
}

/* ---------- main run ---------- */

export async function convertImage(ctx: ConvertContext, buffer: ArrayBuffer, mime: string): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat, options, onProgress } = ctx;
  onProgress({ progress: 0.1, stage: "processing", detail: "Decoding image…" });
  const decoded = await decodeToImageData(buffer, inputFormat, mime);
  const srcW = decoded.kind === "bitmap" ? decoded.bitmap.width : decoded.raw.width;
  const srcH = decoded.kind === "bitmap" ? decoded.bitmap.height : decoded.raw.height;

  const reqW = Number(options.width ?? 0) || 0;
  const reqH = Number(options.height ?? 0) || 0;
  let targetW = reqW || srcW;
  let targetH = reqH || (reqW ? Math.round(srcH * (reqW / srcW)) : srcH);
  if (reqH && !reqW) targetW = Math.round(srcW * (reqH / srcH));
  // safety cap
  const cap = 16384;
  if (targetW > cap || targetH > cap) {
    const s = Math.min(cap / targetW, cap / targetH);
    targetW = Math.round(targetW * s);
    targetH = Math.round(targetH * s);
  }

  onProgress({ progress: 0.35, stage: "processing", detail: "Rendering pixels…" });
  const flatten = outputFormat === "jpg" || outputFormat === "bmp";
  const canvas = drawToCanvas(decoded, targetW, targetH, flatten ? String(options.background ?? "#ffffff") : options.background === "transparent" ? undefined : undefined);
  if (decoded.kind === "bitmap") decoded.bitmap.close();

  onProgress({ progress: 0.55, stage: "processing", detail: `Encoding ${outputFormat.toUpperCase()}…` });
  let bytes: Uint8Array;
  let outMime: string;
  let outExt: string;

  switch (outputFormat) {
    case "jpg":
      outMime = "image/jpeg"; outExt = "jpg";
      bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg", quality: Number(options.quality ?? 92) / 100 })).arrayBuffer());
      break;
    case "png":
      outMime = "image/png"; outExt = "png";
      bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
      break;
    case "webp":
      try {
        const blob = await canvas.convertToBlob({ type: "image/webp", quality: Number(options.quality ?? 92) / 100 });
        bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length === 0) throw new Error("empty");
      } catch {
        throw new Error("Your browser cannot encode WebP images. Try PNG or JPEG instead.");
      }
      outMime = "image/webp"; outExt = "webp";
      break;
    case "bmp":
      outMime = "image/bmp"; outExt = "bmp";
      bytes = encodeBMP(canvas);
      break;
    case "gif":
      outMime = "image/gif"; outExt = "gif";
      bytes = await encodeGIF(canvas);
      break;
    case "ico":
      outMime = "image/x-icon"; outExt = "ico";
      bytes = await encodeICO(canvas, Number(options.width ?? 0) || 256);
      break;
    default:
      throw new Error(`Unsupported image output: ${outputFormat}`);
  }

  return {
    bytes,
    mime: outMime,
    ext: outExt,
    meta: { width: targetW, height: targetH, srcWidth: srcW, srcHeight: srcH },
  };
}

/** Decode any browser-supported image to PNG bytes (used by pdfmake for embedding). */
export async function imageToPngBytes(buffer: ArrayBuffer, mime: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const decoded = await decodeToImageData(buffer, "any", mime);
  const canvas = drawToCanvas(decoded, decoded.kind === "bitmap" ? decoded.bitmap.width : decoded.raw.width, decoded.kind === "bitmap" ? decoded.bitmap.height : decoded.raw.height);
  if (decoded.kind === "bitmap") decoded.bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}
