"use client";

import { useEffect, useMemo } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useUiStore } from "@/lib/store/ui-store";
import { CONVERSIONS, TOOLS } from "@/lib/conversion/registry";
import { formatLabel, getFormat } from "@/lib/conversion/formats";
import { ArrowRight, Wrench, Box } from "lucide-react";

export function SearchDialog() {
  const { searchOpen, setSearchOpen, setPendingPair, openFormat, openToolPanel } = useUiStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [searchOpen, setSearchOpen]);

  const pairs = useMemo(() => {
    const out: { input: string; output: string; comingSoon?: boolean }[] = [];
    for (const [input, routes] of Object.entries(CONVERSIONS)) {
      for (const r of routes) out.push({ input, output: r.output, comingSoon: r.comingSoon });
    }
    return out;
  }, []);

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput placeholder='Search: "tar to zip", "heic", "merge pdf"…' />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No conversions found — the compatibility matrix only lists real, working pipelines.</CommandEmpty>
        <CommandGroup heading="Popular conversions">
          {[
            { input: "tar", output: "zip" },
            { input: "zip", output: "tar" },
            { input: "heic", output: "jpg" },
            { input: "pdf", output: "jpg" },
            { input: "docx", output: "pdf" },
            { input: "png", output: "webp" },
          ].map((p) => (
            <CommandItem
              key={`${p.input}-${p.output}`}
              value={`${p.input} to ${p.output} ${formatLabel(p.input)} ${formatLabel(p.output)}`}
              onSelect={() => {
                setPendingPair(p);
                setSearchOpen(false);
              }}
            >
              <ArrowRight className="mr-2 h-4 w-4 text-primary" aria-hidden />
              <span className="font-mono text-sm">
                {p.input.toUpperCase()} → {p.output.toUpperCase()}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{formatLabel(p.input)} to {formatLabel(p.output)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="All conversions">
          {pairs.map((p) => (
            <CommandItem
              key={`${p.input}>${p.output}`}
              value={`${p.input} to ${p.output} ${formatLabel(p.input)} ${formatLabel(p.output)} ${p.comingSoon ? "coming soon" : ""}`}
              onSelect={() => {
                setPendingPair(p);
                setSearchOpen(false);
              }}
            >
              <ArrowRight className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="font-mono text-sm">
                {p.input.toUpperCase()} → {p.output.toUpperCase()}
              </span>
              {p.comingSoon && <span className="ml-2 text-[10px] font-mono uppercase text-muted-foreground border border-border rounded px-1">coming soon</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tools">
          {TOOLS.map((t) => (
            <CommandItem
              key={t.id}
              value={`${t.title} ${t.description} tool`}
              onSelect={() => {
                if (t.pair) setPendingPair(t.pair);
                else if (t.panel) openToolPanel(t.panel);
                setSearchOpen(false);
              }}
            >
              {t.pair ? <ArrowRight className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden /> : <Wrench className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />}
              {t.title}
              <span className="ml-2 text-xs text-muted-foreground">{t.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Format matrix">
          {["jpg", "png", "heic", "pdf", "tar", "zip", "epub", "stl", "ttf", "srt"].map((id) => (
            <CommandItem
              key={id}
              value={`${id} ${formatLabel(id)} format info`}
              onSelect={() => {
                openFormat(id);
                setSearchOpen(false);
              }}
            >
              <Box className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
              {getFormat(id)?.name ?? id.toUpperCase()}
              <span className="ml-2 text-xs text-muted-foreground">format details</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
