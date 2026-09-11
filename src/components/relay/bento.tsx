"use client";

import { useEffect, useState } from "react";
import { useQueueStore, formatBytes } from "@/lib/store/queue-store";
import { getPoolStats } from "@/lib/conversion/worker-client";
import { Cpu, Database, ShieldCheck, Zap, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BentoGrid() {
  const jobs = useQueueStore((s) => s.jobs);
  const [pool, setPool] = useState({ total: 0, active: 0 });
  const [heapPct, setHeapPct] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPool(getPoolStats()), 600);
    setPool(getPoolStats());
    const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (perfMem) setHeapPct(Math.round((perfMem.usedJSHeapSize / perfMem.jsHeapSizeLimit) * 100));
    return () => clearInterval(t);
  }, []);

  const buffered = jobs.reduce((a, j) => a + j.size, 0);
  const slots = Math.max(pool.total, 2);
  const bars = Array.from({ length: slots }, (_, i) => i < pool.active);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2" aria-label="Why RELAY is different">
      {/* Parallel power */}
      <div className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Blazing fast, even for big files</span>
          <div className="w-8 h-8 rounded-lg bg-accent-light/50 dark:bg-accent-light/20 border border-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" aria-hidden />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight">
          {pool.active} <span className="text-muted-foreground">/</span> {slots} <span className="text-sm font-medium text-muted-foreground">working in parallel</span>
        </div>
        <div className="grid gap-1.5 py-1" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
          {bars.map((active, i) => (
            <div key={i} className={cn("h-2 rounded bg-surface-highest transition-colors", active && "bg-primary")} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground leading-relaxed">Conversions run in the background so the app stays smooth — no waiting on one file to finish the next.</span>
      </div>

      {/* Memory */}
      <div className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Memory used right now</span>
          <div className="w-8 h-8 rounded-lg bg-accent-light/50 dark:bg-accent-light/20 border border-primary/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-primary" aria-hidden />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight">
          {formatBytes(buffered)} <span className="text-sm font-medium text-muted-foreground">held in memory</span>
        </div>
        <div className="w-full bg-surface-highest h-2 rounded overflow-hidden">
          <div className="bg-primary h-full transition-all" style={{ width: `${Math.min(100, Math.max(4, heapPct))}%` }} />
        </div>
        <span className="text-xs text-muted-foreground leading-relaxed">Memory is freed automatically as you download or remove files. Nothing is stored after you leave.</span>
      </div>

      {/* Privacy */}
      <div className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Uploaded to a server</span>
          <div className="w-8 h-8 rounded-lg bg-accent-light/50 dark:bg-accent-light/20 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight text-primary">
          0 <span className="text-sm font-medium text-muted-foreground">bytes — ever</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>Your files physically cannot reach us</span>
        </div>
        <span className="text-xs text-muted-foreground leading-relaxed">Don&apos;t take our word for it: open your browser&apos;s network monitor while converting — no file data is sent anywhere.</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="flex flex-col gap-3 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-primary bg-accent-light/50 dark:bg-accent-light/20 border border-primary/25 rounded-full px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
            100% Private
          </span>
          <span className="inline-flex items-center gap-1.5 text-primary bg-accent-light/50 dark:bg-accent-light/20 border border-primary/25 rounded-full px-3 py-1 text-xs font-semibold">
            <InfinityIcon className="w-3.5 h-3.5" aria-hidden />
            Free Forever
          </span>
          <span className="inline-flex items-center gap-1.5 text-primary bg-accent-light/50 dark:bg-accent-light/20 border border-primary/25 rounded-full px-3 py-1 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" aria-hidden />
            No Sign-up Needed
          </span>
        </div>
        <h1 className="text-[32px] md:text-[44px] leading-[1.1] font-bold tracking-tight">
          Convert any file. <span className="text-primary">Instantly, privately,</span> right in your browser.
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
          Drop your files, pick a format, done. Everything happens on your own device — your documents, photos, and videos are never uploaded anywhere.
        </p>
      </div>
    </div>
  );
}
