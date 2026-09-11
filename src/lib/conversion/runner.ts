/* Runner — orchestrates a conversion job across the worker pool and
 * main-thread engines, normalizing progress, cancellation and errors. */
import type { ConversionResultPayload, ProgressInfo, Stage } from "./types";
import { postConvert, cancelJob as poolCancel, type ConvertOptions } from "./worker-client";
import { convertPdf } from "./engines/media";
import { convertAudio, convertVideoToGif, convertVideoToWebm } from "./engines/media";
import { convertHeic } from "./engines/heic";
import { friendlyError } from "./engines/media";

export interface RunHandle {
  promise: Promise<ConversionResultPayload>;
  cancel: () => void;
}

export function runConversion(opts: Omit<ConvertOptions, "buffer"> & { file: Blob }, onProgress: (p: ProgressInfo) => void): RunHandle {
  const controller = new AbortController();
  const bufferPromise = opts.file.arrayBuffer();

  const promise = (async (): Promise<ConversionResultPayload> => {
    const buffer = await bufferPromise;
    const wrappedOnProgress = (progress: number, stage: Stage, detail?: string) => {
      onProgress({ progress, stage, detail });
    };

    switch (opts.inputFormat) {
      case "heic":
        return convertHeic(
          {
            fileName: opts.fileName,
            inputFormat: opts.inputFormat,
            outputFormat: opts.outputFormat,
            options: opts.options,
            signal: controller.signal,
            onProgress: (p) => onProgress(p),
          },
          opts.file
        );
      case "pdf":
        return convertPdf(
          {
            fileName: opts.fileName,
            inputFormat: opts.inputFormat,
            outputFormat: opts.outputFormat,
            options: opts.options,
            signal: controller.signal,
            onProgress: (p) => onProgress(p),
          },
          buffer
        );
      case "mp3":
      case "wav":
      case "ogg":
      case "opus":
      case "flac":
      case "m4a":
      case "aac":
      case "aiff":
      case "mp4":
      case "mov":
      case "webm": {
        const videoCtx = { fileName: opts.fileName, inputFormat: opts.inputFormat, outputFormat: opts.outputFormat, options: opts.options, signal: controller.signal, onProgress: (p: ProgressInfo) => onProgress(p) };
        if (opts.outputFormat === "gif") return convertVideoToGif(videoCtx, opts.file);
        if (opts.outputFormat === "webm") return convertVideoToWebm(videoCtx, opts.file);
        return convertAudio(videoCtx, opts.file);
      }
      case "mkv": {
        if (opts.outputFormat === "gif")
          return convertVideoToGif(
            { fileName: opts.fileName, inputFormat: opts.inputFormat, outputFormat: opts.outputFormat, options: opts.options, signal: controller.signal, onProgress: (p: ProgressInfo) => onProgress(p) },
            opts.file
          );
        throw new Error("MKV handling is limited to GIF output in this browser.");
      }
      default:
        return postConvert({ ...opts, buffer, onProgress: wrappedOnProgress });
    }
  })().catch((err) => {
    if (controller.signal.aborted || (err as Error)?.name === "AbortError") {
      const e = new Error("Conversion cancelled. Temporary data was cleared.");
      e.name = "AbortError";
      throw e;
    }
    throw new Error(friendlyError(err as Error));
  });

  return {
    promise,
    cancel: () => controller.abort(),
  };
}

export { poolCancel };
