"use client";

import { useEffect } from "react";
import { Header, Ticker } from "./header";
import { Dropzone } from "./dropzone";
import { QueueSection } from "./queue-section";
import { Hero, BentoGrid } from "./bento";
import { HistoryTray, Footer } from "./footer";
import { PreviewDialog } from "./preview-dialog";
import { SearchDialog } from "./search-dialog";
import { ToolsView } from "./tools-view";
import { FormatsView, PrivacyView } from "./info-views";
import { useUiStore } from "@/lib/store/ui-store";
import { toast } from "sonner";
import { ArrowRight, X } from "lucide-react";
import { formatLabel } from "@/lib/conversion/formats";

function ConvertView() {
  return (
    <div className="flex flex-col gap-8">
      <Hero />
      <Dropzone />
      <QueueSection />
      <BentoGrid />
      <HistoryTray />
    </div>
  );
}

function PendingPairBanner() {
  const { pendingPair, setPendingPair } = useUiStore();
  useEffect(() => {
    if (pendingPair) {
      toast(`Output preset to ${formatLabel(pendingPair.output).toUpperCase()}`, {
        description: `Drop your ${formatLabel(pendingPair.input).toUpperCase()} files and this format will be preselected — you can still change it.`,
        duration: 5000,
      });
    }
  }, [pendingPair]);
  if (!pendingPair) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-accent-light/40 dark:bg-accent-light/20 border border-primary/30 text-primary rounded-xl px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <ArrowRight className="w-4 h-4" aria-hidden />
        Converting to {formatLabel(pendingPair.output).toUpperCase()} — drop your files below
      </span>
      <button onClick={() => setPendingPair(null)} aria-label="Clear target" className="hover:opacity-70 min-h-[44px] min-w-[44px] flex items-center justify-center">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function AppShell() {
  const { view } = useUiStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="w-full pt-16 flex-1" id="main">
        <Ticker />
        <div className="w-full max-w-7xl mx-auto px-4 lg:px-6 py-8 flex flex-col gap-8">
          {view === "convert" && (
            <>
              <PendingPairBanner />
              <ConvertView />
            </>
          )}
          {view === "tools" && <ToolsView />}
          {view === "formats" && <FormatsView />}
          {view === "privacy" && <PrivacyView />}
        </div>
      </main>
      <Footer />
      <PreviewDialog />
      <SearchDialog />
    </div>
  );
}
