"use client";

import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/conversion/formats";
import { FORMATS, getFormat, formatLabel } from "@/lib/conversion/formats";
import { getRoutes, getAvailableRoutes, getInputsFor, getSupportedFormatIds, CONVERSIONS, TOOLS } from "@/lib/conversion/registry";
import { useUiStore } from "@/lib/store/ui-store";
import { useQueueStore } from "@/lib/store/queue-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Lock, Star, ShieldCheck, Search, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryId } from "@/lib/conversion/types";

/* ------------------------------------------------------------------ */
/* Format Matrix                                                       */
/* ------------------------------------------------------------------ */

const supported = getSupportedFormatIds();

export function FormatsView() {
  const { formatDetail, openFormat, setPendingPair } = useUiStore();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [query, setQuery] = useState("");

  const formats = useMemo(() => {
    let list = FORMATS;
    if (category !== "all") list = list.filter((f) => f.category === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.extensions.some((e) => e.includes(q)));
    }
    return [...list].sort((a, b) => Number(supported.has(b.id)) - Number(supported.has(a.id)) || a.name.localeCompare(b.name));
  }, [category, query]);

  if (formatDetail) return <FormatDetail id={formatDetail} />;

  const cats: (CategoryId | "all")[] = ["all", ...(Object.keys(CATEGORIES) as CategoryId[])];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Format Matrix</h1>
        <p className="text-muted-foreground mt-1">
          Convert hundreds of file formats — <span className="text-foreground font-medium">only real, working conversions are listed</span>. No fake buttons, ever.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search formats…"
            aria-label="Search formats"
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto relay-scroll pb-1" role="tablist" aria-label="Format categories">
          {cats.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-lg font-mono text-[11px] whitespace-nowrap transition-colors border",
                category === c ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-surface border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              {c === "all" ? "ALL" : CATEGORIES[c].label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {formats.map((f) => {
          const routeCount = getAvailableRoutes(f.id).length;
          const hasSupport = supported.has(f.id);
          return (
            <button
              key={f.id}
              onClick={() => openFormat(f.id)}
              className="text-left bg-surface border border-border rounded-xl p-4 shadow-sm hover:border-primary/50 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold">{f.name}</span>
                {hasSupport ? (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-label="Supported in-browser" />
                ) : (
                  <CircleSlash className="w-4 h-4 text-muted-foreground/50 shrink-0" aria-label="No in-browser route yet" />
                )}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground mt-1">.{f.extensions.join(" · .")}</div>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
                  {routeCount > 0 ? `${routeCount} output${routeCount > 1 ? "s" : ""}` : "coming soon"}
                </Badge>
                {routeCount > 0 && <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">no upload</Badge>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormatDetail({ id }: { id: string }) {
  const openFormat = useUiStore((s) => s.openFormat);
  const setPendingPair = useUiStore((s) => s.setPendingPair);
  const { favorites, toggleFavorite } = useQueueStore();
  const fmt = getFormat(id);
  const routes = getRoutes(id);
  const inputs = getInputsFor(id);
  if (!fmt) return null;

  const real = routes.filter((r) => !r.comingSoon);
  const soon = routes.filter((r) => r.comingSoon);
  const isFav = favorites.some((f) => f.input === id);

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => openFormat(null)} className="self-start text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Format Matrix
      </button>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{fmt.name}</h1>
          <button
            onClick={() => toggleFavorite(id, real[0]?.output ?? "")}
            aria-label={isFav ? "Unfavorite format" : "Favorite format"}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <Star className={cn("w-5 h-5", isFav && "fill-primary text-primary")} />
          </button>
        </div>
        <div className="font-mono text-sm text-muted-foreground">
          Extension: <span className="text-foreground">.{fmt.extensions.join(" / .")}</span> · Category: <span className="text-foreground">{CATEGORIES[fmt.category].label}</span> · MIME: <span className="text-foreground">{fmt.mime}</span>
        </div>
        {fmt.blurb && <p className="text-sm text-muted-foreground">{fmt.blurb}</p>}
      </div>

      {real.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">Can convert to — real, local pipelines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {real.map((r) => {
              const favPair = favorites.some((f) => f.input === id && f.output === r.output);
              return (
                <div key={r.output} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-2">
                  <button onClick={() => setPendingPair({ input: id, output: r.output })} className="flex items-center gap-2 font-mono text-sm hover:text-primary transition-colors min-w-0">
                    <ArrowRight className="w-4 h-4 text-primary shrink-0" aria-hidden />
                    <span className="truncate">
                      {id.toUpperCase()} → {r.output.toUpperCase()}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleFavorite(id, r.output)} aria-label="Favorite this conversion" className="text-muted-foreground hover:text-primary">
                      <Star className={cn("w-3.5 h-3.5", favPair && "fill-primary text-primary")} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 flex-wrap mt-1">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-light/50 dark:bg-accent-light/20 text-primary border border-primary/20">✓ Runs in browser</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-light/50 dark:bg-accent-light/20 text-primary border border-primary/20">✓ Private</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-light/50 dark:bg-accent-light/20 text-primary border border-primary/20">✓ Batch</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-light/50 dark:bg-accent-light/20 text-primary border border-primary/20">✓ No upload</span>
          </div>
        </section>
      )}

      {soon.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">Planned — honest roadmap, not fake buttons</h2>
          <div className="flex flex-wrap gap-2">
            {soon.map((r) => (
              <span key={r.output} className="font-mono text-xs px-2.5 py-1.5 rounded bg-surface-high border border-border text-muted-foreground" title={r.note}>
                {id.toUpperCase()} → {r.output.toUpperCase()} · coming soon
              </span>
            ))}
          </div>
        </section>
      )}

      {inputs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">Can be produced from</h2>
          <div className="flex flex-wrap gap-2">
            {inputs.map((i) => (
              <button key={i} onClick={() => setPendingPair({ input: i, output: id })} className="font-mono text-xs px-2.5 py-1.5 rounded bg-surface border border-border hover:border-primary/50 transition-colors">
                {formatLabel(i)} → {id.toUpperCase()}
              </button>
            ))}
          </div>
        </section>
      )}

      {real.length === 0 && soon.length === 0 && (
        <div className="bg-surface-high border border-border rounded-xl p-6 text-sm text-muted-foreground">
          No in-browser conversion pipeline for {fmt.name} yet. We only list conversions that actually run locally — nothing here is a fake button.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy                                                             */
/* ------------------------------------------------------------------ */

export function PrivacyView() {
  const clearHistory = useQueueStore((s) => s.clearHistory);
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Architecture &amp; Privacy</h1>
        <p className="text-muted-foreground mt-2">How RELAY works — and the honest limits of browser-based processing.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" aria-hidden />
          <h2 className="font-bold text-lg">Files are processed locally</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          When you drop a file, it is read with the browser File API, handed to a Web Worker or a WebAssembly engine inside your own browser tab, and the converted result is
          written back to a local Blob. There is <span className="text-foreground font-medium">no upload endpoint that receives your files — the code for it does not exist</span>.
          We don&apos;t even have accounts, so there is nothing to sign up for and no personal data to store.
        </p>
        <pre className="bg-surface-low border border-border rounded-lg p-4 font-mono text-[11px] overflow-x-auto relay-scroll">{`Your file
     ↓
Your browser (never leaves your device)
     ↓
Local conversion engine
     ↓
Downloaded result`}</pre>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden />
          <h2 className="font-bold text-lg">What we never send anywhere</h2>
        </div>
        <ul className="text-sm text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-2">
          {["File contents", "File previews", "Extracted text", "File hashes (unless you preview)", "Filenames to analytics", "Personal document contents"].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden /> {x}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Verify us: open DevTools → Network while converting. No file bytes leave the tab.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-3 shadow-sm">
        <h2 className="font-bold text-lg">Honest limitations</h2>
        <ul className="text-sm text-muted-foreground flex flex-col gap-2">
          <li>• Temporary browser data (Blob URLs, worker memory) exists while converting and is cleaned after download, removal, or tab close.</li>
          <li>• The session log stores metadata (file names, sizes) in RAM only — it clears when the tab closes and can be cleared manually.</li>
          <li>• Some engines are browser-dependent: WebP encoding, AVIF decoding, MP4 audio decoding and MediaRecorder video output depend on your browser&apos;s codecs. We detect and label these instead of pretending.</li>
          <li>• 7Z/RAR/XZ/Zstd archives are shown as &quot;coming soon&quot; — we will not fake them with a server round-trip.</li>
          <li>• Office rendering (DOCX → PDF) is a text-accurate basic layout, not pixel-perfect Word rendering. We say so up front.</li>
          <li>• We cannot make absolute security or privacy guarantees; we make the strongest guarantees that client-side processing allows, and we show our work.</li>
        </ul>
        <Button variant="outline" className="self-start" onClick={() => { clearHistory(); toast.success("Local session data cleared"); }}>
          Clear local session data
        </Button>
      </div>
    </div>
  );
}

/* Pending pair toast helper used by converter view */
export function usePendingPairToast() {
  const pendingPair = useUiStore((s) => s.pendingPair);
  const setPendingPair = useUiStore((s) => s.setPendingPair);
  return { pendingPair, setPendingPair, CONVERSIONS, TOOLS };
}
