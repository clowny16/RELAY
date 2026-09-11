/* UI store — view switching, dialogs, selected formats. */
"use client";

import { create } from "zustand";

export type ViewId = "convert" | "tools" | "formats" | "privacy";

export interface ToolPanelState {
  panel: string;
  open: boolean;
}

interface UiState {
  view: ViewId;
  formatDetail: string | null;
  toolPanel: ToolPanelState | null;
  searchOpen: boolean;
  previewJobId: string | null;
  extractorFileId: string | null;
  pendingPair: { input: string; output: string } | null;
  setView: (v: ViewId) => void;
  openFormat: (id: string | null) => void;
  openToolPanel: (panel: string | null) => void;
  setSearchOpen: (open: boolean) => void;
  setPreviewJob: (id: string | null) => void;
  setExtractorFile: (id: string | null) => void;
  setPendingPair: (pair: { input: string; output: string } | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "convert",
  formatDetail: null,
  toolPanel: null,
  searchOpen: false,
  previewJobId: null,
  extractorFileId: null,
  pendingPair: null,
  setView: (view) => set({ view, formatDetail: view === "formats" ? null : null }),
  openFormat: (formatDetail) => set({ view: "formats", formatDetail }),
  openToolPanel: (panel) => set({ view: "tools", toolPanel: panel ? { panel, open: true } : null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setPreviewJob: (previewJobId) => set({ previewJobId }),
  setExtractorFile: (extractorFileId) => set({ extractorFileId }),
  setPendingPair: (pendingPair) => set({ pendingPair, view: "convert" }),
}));
