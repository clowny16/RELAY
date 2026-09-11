"use client";

import { useEffect } from "react";
import { Header, Ticker } from "./header";
import { Dropzone } from "./dropzone";
import { QueueSection } from "./queue-section";
import { Hero, BentoGrid } from "./bento";
import { HistoryTray, Footer } from "./footer";
import { PreviewDialog } from "./preview-dialog";
import { AuthDialog } from "./auth-dialog";
import { SearchDialog } from "./search-dialog";
import { ToolsView } from "./tools-view";
import { FormatsView, PricingView, PrivacyView } from "./info-views";
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
      toast(`Converter set to ${pendingPair.input.toUpperCase()} → ${pendingPair.output.toUpperCase()}`, {
        description: "Drop your files below and they'll target this output.",
        duration: 5000,
      });
    }
  }, [pendingPair]);
  if (!pendingPair) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-accent-light/40 dark:bg-accent-light/20 border border-primary/30 text-primary rounded-lg px-4 py-2.5">
      <span className="flex items-center gap-2 font-mono text-xs font-semibold">
        <ArrowRight className="w-4 h-4" aria-hidden />
        TARGET LOCKED: {formatLabel(pendingPair.input).toUpperCase()} → {formatLabel(pendingPair.output).toUpperCase()}
      </span>
      <button onClick={() => setPendingPair(null)} aria-label="Clear target" className="hover:opacity-70">
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
          {view === "pricing" && <PricingView />}
          {view === "privacy" && <PrivacyView />}
        </div>
      </main>
      <Footer />
      <PreviewDialog />
      <AuthDialog />
      <SearchDialog />
    </div>
  );
}
