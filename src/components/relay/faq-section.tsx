"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown, ShieldCheck, Zap, Lock, Cpu, Globe, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAQS } from "@/lib/faq-data";

function getFaqIcon(iconName: string) {
  switch (iconName) {
    case "ShieldCheck":
      return ShieldCheck;
    case "Infinity":
      return InfinityIcon;
    case "Globe":
      return Globe;
    case "Zap":
      return Zap;
    case "Lock":
      return Lock;
    case "Cpu":
      return Cpu;
    default:
      return HelpCircle;
  }
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section
      className="bg-surface border border-border rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6"
      aria-label="Frequently Asked Questions about in-browser file conversion"
      id="faq"
    >
      <div className="flex flex-col gap-2 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-accent-light/50 dark:bg-accent-light/20 border border-primary/20 flex items-center justify-center text-primary">
            <HelpCircle className="w-4 h-4" aria-hidden />
          </span>
          <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">Frequently Asked Questions</span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Everything You Need to Know About In-Browser Conversion</h2>
        <p className="text-sm text-muted-foreground">
          Learn how RELAY protects your privacy, operates without remote servers, and delivers fast local file processing.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border/60">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          const Icon = getFaqIcon(faq.iconName);
          return (
            <div key={i} className="py-4 first:pt-0 last:pb-0">
              <button
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${i}`}
                className="w-full flex items-center justify-between text-left gap-4 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-surface-high border border-border flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                    <Icon className="w-3.5 h-3.5" aria-hidden />
                  </span>
                  <span className="text-sm md:text-base font-semibold group-hover:text-primary transition-colors">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180 text-primary"
                  )}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <div
                  id={`faq-answer-${i}`}
                  className="mt-3 text-sm text-muted-foreground leading-relaxed pl-9 pr-4"
                >
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
