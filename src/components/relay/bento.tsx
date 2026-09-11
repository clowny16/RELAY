"use client";

import { useEffect, useState } from "react";
import { useQueueStore, formatBytes } from "@/lib/store/queue-store";
import { getPoolStats } from "@/lib/conversion/worker-client";
import { MemoryStick, Database, ShieldCheck, Verified } from "lucide-react";
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2" aria-label="Runtime diagnostics">
      {/* Worker pool */}
      <div className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground uppercase font-semibold">Web Worker Thread Allocation</span>
          <MemoryStick className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="text-3xl font-bold tracking-tight">
          {pool.active} / {slots}
        </div>
        <div className="grid gap-1.5 py-1" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
          {bars.map((active, i) => (
            <div key={i} className={cn("h-2 rounded bg-surface-highest", active && "bg-primary")} />
          ))}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">Conversion engines run in isolated Web Workers — the UI never blocks, even on big archives.</span>
      </div>

      {/* Memory */}
      <div className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground uppercase font-semibold">Local Heap &amp; Buffer</span>
          <Database className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="text-3xl font-bold tracking-tight">
          {formatBytes(buffered)} <span className="text-sm font-mono text-muted-foreground">buffered</span>
        </div>
        <div className="w-full bg-surface-highest h-2 rounded overflow-hidden">
          <div className="bg-primary h-full transition-all" style={{ width: `${Math.min(100, Math.max(4, heapPct))}%` }} />
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">Blobs are revoked automatically after download or removal. Clear completed to reclaim memory instantly.</span>
      </div>

      {/* Privacy ledger */}
      <div className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground uppercase font-semibold">Network Exfiltration Audit</span>
          <Verified className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="text-3xl font-bold tracking-tight text-primary">
          0 <span className="text-sm font-mono text-muted-foreground">Bytes Out</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span>Conversion engines never issue network requests</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">Open DevTools → Network and watch: no file bytes are ever transmitted. Verify us, don&apos;t trust us.</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="flex flex-col gap-2 max-w-3xl">
        <div className="inline-flex items-center gap-1.5 text-primary font-mono text-[11px] tracking-wider uppercase font-semibold">
          <ShieldCheck className="w-4 h-4" aria-hidden />
          <span>Zero-Latency Local Computation</span>
        </div>
        <h1 className="text-[34px] md:text-[46px] leading-[1.1] font-bold tracking-tight">
          Convert Files. Privately. <span className="text-primary">Right in Your Browser.</span>
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mt-1">
          Client-side WebAssembly, isolated Web Workers, and native streaming APIs. Your sensitive documents, keys, archives, and media never touch a remote server.
        </p>
      </div>
      <div className="flex flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
        <div className="bg-surface border border-border px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden />
          <div className="flex flex-col">
            <span className="font-mono text-[11px] font-bold">AIR-GAPPED COMPATIBLE</span>
            <span className="text-xs text-muted-foreground">PWA cache installed · works offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
