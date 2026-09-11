/* Queue store — conversion jobs, statuses, batch operations, session history. */
"use client";

import { create } from "zustand";
import type { Detection, OptionField, ProgressInfo, Stage } from "@/lib/conversion/types";
import { detectFormat } from "@/lib/conversion/detection";
import { getAvailableRoutes, defaultOptions, defaultTargetFor, getRoute } from "@/lib/conversion/registry";
import { runConversion, type RunHandle } from "@/lib/conversion/runner";

export type JobStatus = "waiting" | "preparing" | "converting" | "finalizing" | "complete" | "failed" | "cancelled" | "paused";

export interface JobResult {
  blob: Blob;
  url: string;
  size: number;
  mime: string;
  ext: string;
  meta?: Record<string, unknown>;
  textPreview?: string;
  sha256?: string;
}

export interface ConversionJob {
  id: string;
  file: File;
  fileName: string;
  size: number;
  detection: Detection;
  target: string;
  options: Record<string, unknown>;
  status: JobStatus;
  progress: number;
  stage: Stage;
  detail?: string;
  speedBps?: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  result?: JobResult;
  runHandle?: RunHandle;
}

export interface HistoryItem {
  id: string;
  from: string;
  to: string;
  inSize: number;
  outSize: number;
  at: number;
}

interface QueueState {
  jobs: ConversionJob[];
  history: HistoryItem[];
  paused: boolean;
  filter: "all" | "active" | "pending" | "complete" | "failed";
  favorites: { input: string; output: string }[];
  maxConcurrent: number;
  addFiles: (files: File[]) => Promise<{ added: number; rejected: { name: string; reason: string }[] }>;
  setTarget: (id: string, target: string) => void;
  setOption: (id: string, key: string, value: unknown) => void;
  startJob: (id: string) => void;
  startAll: () => void;
  cancelJob: (id: string) => void;
  retryJob: (id: string) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  setFilter: (f: QueueState["filter"]) => void;
  downloadJob: (id: string) => void;
  downloadAll: () => Promise<void>;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  toggleFavorite: (input: string, output: string) => void;
  _tick: () => void;
}

let jobCounter = 0;

async function sha256Hex(blob: Blob): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await blob.slice(0, 1024 * 1024).arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Free forever — no accounts, no tiers. Limits are based on the device, not a plan. */
function deviceLimits() {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return {
    maxBatch: 200,
    maxConcurrent: Math.max(2, Math.min(4, Math.floor(cores / 2))),
  };
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function outputName(fileName: string, ext: string): string {
  const base = fileName.replace(/\.[^./]+$/, "");
  return `${base}.${ext}`;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  history: [],
  paused: false,
  filter: "all",
  favorites: [],
  maxConcurrent: 2,

  addFiles: async (files) => {
    const limits = deviceLimits();
    const current = get().jobs;
    const room = Math.max(0, limits.maxBatch - current.filter((j) => j.status === "waiting" || j.status === "paused").length);
    const accepted = files.slice(0, room);
    const overflow = files.length - accepted.length;
    const rejected: { name: string; reason: string }[] = [];
    if (overflow > 0) rejected.push({ name: `${overflow} file(s)`, reason: `Batch limit reached (${limits.maxBatch} files at once — clear finished files to add more).` });

    const newJobs: ConversionJob[] = [];
    for (const file of accepted) {
      const detection = await detectFormat(file);
      if (!detection.formatId) {
        rejected.push({ name: file.name, reason: "Unsupported format — we couldn't identify this file type." });
        continue;
      }
      const routes = getAvailableRoutes(detection.formatId);
      if (routes.length === 0) {
        rejected.push({ name: file.name, reason: `No in-browser conversion available for ${detection.label ?? detection.formatId.toUpperCase()} yet.` });
        continue;
      }
      const target = defaultTargetFor(detection.formatId)!;
      const route = getRoute(detection.formatId, target)!;
      newJobs.push({
        id: `j${++jobCounter}-${Date.now()}`,
        file,
        fileName: file.name,
        size: file.size,
        detection,
        target,
        options: defaultOptions(route),
        status: "waiting",
        progress: 0,
        stage: "queued",
      });
    }
    set({ jobs: [...get().jobs, ...newJobs], maxConcurrent: limits.maxConcurrent });
    if (newJobs.length) get().startAll();
    return { added: newJobs.length, rejected };
  },

  setTarget: (id, target) => {
    set({
      jobs: get().jobs.map((j) => {
        if (j.id !== id) return j;
        const route = getRoute(j.detection.formatId!, target);
        return { ...j, target, options: route ? defaultOptions(route) : j.options, result: undefined, status: "waiting", progress: 0, stage: "queued", error: undefined };
      }),
    });
  },

  setOption: (id, key, value) => {
    set({
      jobs: get().jobs.map((j) => (j.id === id ? { ...j, options: { ...j.options, [key]: value } } : j)),
    });
  },

  startJob: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.runHandle) return;
    const route = getRoute(job.detection.formatId!, job.target);
    if (!route) {
      set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, status: "failed", error: "No conversion route available." } : j)) });
      return;
    }
    const startedAt = performance.now();
    let lastBytes = 0;
    let lastTime = startedAt;

    const handle = runConversion(
      {
        inputFormat: job.detection.formatId!,
        outputFormat: job.target,
        fileName: job.fileName,
        mime: job.file.type || "application/octet-stream",
        options: job.options,
        file: job.file,
      },
      (p: ProgressInfo) => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        if (p.processedBytes && dt > 0.5) {
          lastTime = now;
          set((state) => ({
            jobs: state.jobs.map((j) =>
              j.id === id
                ? { ...j, speedBps: (p.processedBytes! - lastBytes) / dt }
                : j
            ),
          }));
          lastBytes = p.processedBytes;
        }
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  progress: p.progress,
                  stage: p.stage,
                  detail: p.detail,
                  status: p.stage === "finalizing" ? "finalizing" : "converting",
                }
              : j
          ),
        }));
      }
    );

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, runHandle: handle, status: "preparing", stage: "preparing", progress: 0, detail: "Preparing…" } : j)),
    }));

    handle.promise
      .then(async (result) => {
        const blob = new Blob([result.bytes as unknown as BlobPart], { type: result.mime });
        const url = URL.createObjectURL(blob);
        const sha = await sha256Hex(blob);
        const finishedAt = performance.now();
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: "complete",
                  stage: "complete",
                  progress: 1,
                  detail: undefined,
                  finishedAt,
                  result: { blob, url, size: blob.size, mime: result.mime, ext: result.ext, meta: result.meta, textPreview: result.textPreview, sha256: sha },
                  speedBps: undefined,
                }
              : j
          ),
          history: [
            { id: `${id}-${Date.now()}`, from: job.fileName, to: outputName(job.fileName, result.ext), inSize: job.size, outSize: blob.size, at: Date.now() },
            ...get().history,
          ].slice(0, 50),
        }));
        void finishedAt;
      })
      .catch((err) => {
        const aborted = (err as Error)?.name === "AbortError";
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? { ...j, status: aborted ? "cancelled" : "failed", error: aborted ? undefined : (err as Error).message, stage: "queued", runHandle: undefined, speedBps: undefined }
              : j
          ),
        }));
      })
      .finally(() => {
        set((state) => ({ jobs: state.jobs.map((j) => (j.id === id ? { ...j, runHandle: undefined } : j)) }));
        setTimeout(() => get().startAll(), 30);
      });
  },

  startAll: () => {
    const { jobs, paused } = get();
    if (paused) return;
    const running = jobs.filter((j) => j.runHandle).length;
    const { maxConcurrent } = deviceLimits();
    const candidates = jobs.filter((j) => j.status === "waiting" && !j.runHandle).slice(0, Math.max(0, maxConcurrent - running));
    candidates.forEach((j) => get().startJob(j.id));
  },

  cancelJob: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    job.runHandle?.cancel();
    set({
      jobs: get().jobs.map((j) =>
        j.id === id ? { ...j, status: "cancelled", stage: "queued", progress: 0, detail: undefined, error: undefined, speedBps: undefined } : j
      ),
    });
  },

  retryJob: (id) => {
    set({
      jobs: get().jobs.map((j) =>
        j.id === id ? { ...j, status: "waiting", stage: "queued", progress: 0, error: undefined, detail: undefined } : j
      ),
    });
    setTimeout(() => get().startAll(), 10);
  },

  removeJob: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    job?.runHandle?.cancel();
    if (job?.result?.url) URL.revokeObjectURL(job.result.url);
    set({ jobs: get().jobs.filter((j) => j.id !== id) });
  },

  clearCompleted: () => {
    const completed = get().jobs.filter((j) => j.status === "complete" || j.status === "cancelled" || j.status === "failed");
    completed.forEach((j) => {
      if (j.result?.url) URL.revokeObjectURL(j.result.url);
    });
    set({ jobs: get().jobs.filter((j) => j.status !== "complete" && j.status !== "cancelled" && j.status !== "failed") });
  },

  pauseAll: () => set({ paused: true }),

  resumeAll: () => {
    set({ paused: false });
    setTimeout(() => get().startAll(), 10);
  },

  setFilter: (filter) => set({ filter }),

  downloadJob: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job?.result) return;
    download(job.result.url, outputName(job.fileName, job.result.ext));
  },

  downloadAll: async () => {
    const completed = get().jobs.filter((j) => j.status === "complete" && j.result);
    if (completed.length === 0) return;
    const { zipSync } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    for (const job of completed) {
      const name = outputName(job.fileName, job.result!.ext);
      files[name] = new Uint8Array(await job.result!.blob.arrayBuffer());
    }
    const zipped = zipSync(files, { level: 1 });
    const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    download(url, "relay-conversions.zip");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  removeHistory: (id) => set({ history: get().history.filter((h) => h.id !== id) }),
  clearHistory: () => set({ history: [] }),

  toggleFavorite: (input, output) => {
    const favs = get().favorites;
    const exists = favs.some((f) => f.input === input && f.output === output);
    set({ favorites: exists ? favs.filter((f) => !(f.input === input && f.output === output)) : [...favs, { input, output }] });
  },

  _tick: () => set({}),
}));

export function jobOptionsSchema(job: ConversionJob): OptionField[] {
  const route = getRoute(job.detection.formatId!, job.target);
  return route?.options ?? [];
}
