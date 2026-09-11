/* Worker pool client — manages a pool of conversion workers with RPC, progress
 * streams and cancellation. Also exposes live pool stats for the telemetry UI. */
"use client";

import type { ArchiveListing, ArchiveEntryInfo, ConversionResultPayload, Stage } from "./types";

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (progress: number, stage: Stage, detail?: string) => void;
};

export interface PoolStats {
  total: number;
  active: number;
}

type WorkerRequest =
  | { id: string; kind: "convert"; inputFormat: string; outputFormat: string; fileName: string; mime: string; options: Record<string, unknown>; buffer: ArrayBuffer }
  | { id: string; kind: "list"; inputFormat: string; fileName: string; buffer: ArrayBuffer }
  | { id: string; kind: "extract"; inputFormat: string; selected: string[] | null; buffer: ArrayBuffer }
  | { id: string; kind: "pdf-tool"; tool: "merge" | "split" | "rotate" | "compress"; buffers: ArrayBuffer[]; arg?: string | number };

class ConversionWorker {
  worker: Worker;
  pending: Map<string, Pending> = new Map();
  currentId: string | null = null;

  constructor(onStats: () => void) {
    this.worker = new Worker(new URL("./workers/engine.worker.ts", import.meta.url), { name: "relay-engine" });
    this.worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as
        | { id: string; type: "progress"; progress: number; stage: Stage; detail?: string }
        | { id: string; type: "result"; result: ConversionResultPayload }
        | { id: string; type: "listing"; listing: ArchiveListing }
        | { id: string; type: "entries"; entries: { path: string; size: number; data: ArrayBuffer }[] }
        | { id: string; type: "pdf-tool-result"; result: { bytes: Uint8Array; pages?: number } }
        | { id: string; type: "error"; message: string; cancelled?: boolean };
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      if (msg.type === "progress") {
        pending.onProgress?.(msg.progress, msg.stage, msg.detail);
      } else if (msg.type === "result") {
        this.pending.delete(msg.id);
        pending.resolve(msg.result);
        onStats();
      } else if (msg.type === "listing") {
        this.pending.delete(msg.id);
        pending.resolve(msg.listing);
        onStats();
      } else if (msg.type === "entries") {
        this.pending.delete(msg.id);
        pending.resolve(msg.entries);
        onStats();
      } else if (msg.type === "pdf-tool-result") {
        this.pending.delete(msg.id);
        pending.resolve(msg.result);
        onStats();
      } else if (msg.type === "error") {
        this.pending.delete(msg.id);
        const err = new Error(msg.message);
        err.name = msg.cancelled ? "AbortError" : "ConversionError";
        pending.reject(err);
        onStats();
      }
    };
    this.worker.onerror = () => {
      // fail all pending jobs if the worker crashed
      for (const [id, p] of this.pending) {
        p.reject(new Error("The conversion engine crashed unexpectedly. Please retry."));
        this.pending.delete(id);
      }
      onStats();
    };
  }

  get busy() {
    return this.currentId !== null && this.pending.has(this.currentId);
  }

  post(msg: WorkerRequest, pending: Pending, transfer: Transferable[] = []) {
    this.pending.set(msg.id, pending);
    this.currentId = msg.id;
    this.worker.postMessage(msg, transfer);
  }

  cancel(id: string) {
    this.worker.postMessage({ type: "cancel", id });
  }

  terminate() {
    this.worker.terminate();
  }
}

let statsSink: ((s: PoolStats) => void) | null = null;
let pool: ConversionWorker[] = [];
let poolSize = 2;

function poolTarget(): number {
  if (typeof navigator === "undefined") return 2;
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(2, Math.min(4, Math.floor(cores / 2)));
}

function ensurePool() {
  const target = poolTarget();
  poolSize = target;
  while (pool.length < target) {
    pool.push(new ConversionWorker(notifyStats));
  }
}

function notifyStats() {
  statsSink?.({ total: poolSize, active: pool.filter((w) => w.busy).length });
}

function nextFree(): ConversionWorker {
  ensurePool();
  return pool.find((w) => !w.busy) ?? pool.reduce((min, w) => (w.pending.size < min.pending.size ? w : min), pool[0]);
}

let jobCounter = 0;

export function setPoolStatsSink(sink: ((s: PoolStats) => void) | null) {
  statsSink = sink;
  if (sink) notifyStats();
}

export function getPoolStats(): PoolStats {
  return { total: poolSize, active: pool.filter((w) => w.busy).length };
}

export interface ConvertOptions {
  inputFormat: string;
  outputFormat: string;
  fileName: string;
  mime: string;
  options: Record<string, unknown>;
  buffer: ArrayBuffer;
  onProgress?: (progress: number, stage: Stage, detail?: string) => void;
}

export function postConvert(opts: ConvertOptions): Promise<ConversionResultPayload> {
  const id = `job-${++jobCounter}-${Date.now()}`;
  const w = nextFree();
  return new Promise<ConversionResultPayload>((resolve, reject) => {
    w.post(
      { id, kind: "convert", inputFormat: opts.inputFormat, outputFormat: opts.outputFormat, fileName: opts.fileName, mime: opts.mime, options: opts.options, buffer: opts.buffer },
      { resolve: resolve as (v: unknown) => void, reject, onProgress: opts.onProgress },
      [opts.buffer]
    );
  });
}

export function postList(buffer: ArrayBuffer, inputFormat: string, fileName: string): Promise<ArchiveListing> {
  const id = `list-${++jobCounter}-${Date.now()}`;
  const w = nextFree();
  return new Promise<ArchiveListing>((resolve, reject) => {
    w.post({ id, kind: "list", inputFormat, fileName, buffer }, { resolve: resolve as (v: unknown) => void, reject }, [buffer]);
  });
}

export function postExtract(buffer: ArrayBuffer, inputFormat: string, selected: string[] | null): Promise<{ path: string; size: number; data: ArrayBuffer }[]> {
  const id = `extract-${++jobCounter}-${Date.now()}`;
  const w = nextFree();
  return new Promise((resolve, reject) => {
    w.post({ id, kind: "extract", inputFormat, selected, buffer }, { resolve: resolve as (v: unknown) => void, reject }, [buffer]);
  });
}

export function postPdfTool(tool: "merge" | "split" | "rotate" | "compress", buffers: ArrayBuffer[], arg?: string | number, onProgress?: (p: number) => void): Promise<{ bytes: Uint8Array; pages?: number }> {
  const id = `tool-${++jobCounter}-${Date.now()}`;
  const w = nextFree();
  return new Promise((resolve, reject) => {
    w.post(
      { id, kind: "pdf-tool", tool, buffers, arg },
      {
        resolve: resolve as (v: unknown) => void,
        reject,
        onProgress: (p) => onProgress?.(p),
      },
      buffers
    );
  });
}

/** Cancel a running job; falls back to terminating the worker after grace period. */
export function cancelJob(jobId: string) {
  const w = pool.find((x) => x.currentId === jobId);
  if (!w) return;
  w.cancel(jobId);
  setTimeout(() => {
    if (w.pending.has(jobId)) {
      const pending = w.pending.get(jobId);
      w.terminate();
      w.pending.delete(jobId);
      if (pending) {
        const err = new Error("Conversion cancelled. Temporary data was cleared.");
        err.name = "AbortError";
        pending.reject(err);
      }
      // respawn
      pool = pool.filter((x) => x !== w);
      ensurePool();
      notifyStats();
    }
  }, 1200);
}

export type { ArchiveEntryInfo };
