"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { setPoolStatsSink } from "@/lib/conversion/worker-client";
import { useQueueStore } from "@/lib/store/queue-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const toggleFavorite = useQueueStore((s) => s.toggleFavorite);

  useEffect(() => {
    // hydrate favorites from localStorage
    try {
      const raw = localStorage.getItem("relay.favorites");
      if (raw) {
        (JSON.parse(raw) as { input: string; output: string }[]).forEach((f) => toggleFavorite(f.input, f.output));
      }
    } catch {}
  }, [toggleFavorite]);

  useEffect(() => {
    const unsub = useQueueStore.subscribe((state) => {
      try {
        localStorage.setItem("relay.favorites", JSON.stringify(state.favorites));
      } catch {}
    });
    return unsub;
  }, []);

  useEffect(() => {
    setPoolStatsSink(() => {
      // stats are polled by the ticker component; this keeps the pool warm
    });
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        // Dev mode: a previously installed service worker serves stale cached
        // HTML/JS chunks, which triggers React hydration mismatches. Make sure
        // none is left controlling the page and wipe old caches.
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => void r.unregister()))
          .catch(() => {});
        if ("caches" in window) {
          caches
            .keys()
            .then((keys) => keys.forEach((k) => void caches.delete(k)))
            .catch(() => {});
        }
      }
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
