"use client";

import { useCallback, useRef, useState } from "react";
import { TOOLS } from "@/lib/conversion/registry";
import { useUiStore } from "@/lib/store/ui-store";
import { postList, postExtract, postPdfTool } from "@/lib/conversion/worker-client";
import { detectFormat } from "@/lib/conversion/detection";
import { readPdfMetadata } from "@/lib/conversion/engines/media";
import { formatBytes } from "@/lib/store/queue-store";
import type { ArchiveListing } from "@/lib/conversion/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileArchive,
  FolderTree,
  Loader2,
  Download,
  FileDown,
  Merge,
  Scissors,
  RotateCw,
  Info,
  FilePlus2,
  ChevronRight,
  ChevronDown,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Tools grid                                                          */
/* ------------------------------------------------------------------ */

export function ToolsView() {
  const { setPendingPair, openToolPanel, toolPanel } = useUiStore();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tools &amp; Archive</h1>
        <p className="text-muted-foreground mt-1">Focused, single-purpose utilities. Every tool runs 100% in your browser.</p>
      </div>
      {toolPanel?.open && <ToolPanel id={toolPanel.panel} />}
      {(["pdf", "image", "archive", "media"] as const).map((cat) => (
        <section key={cat} className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">{cat === "pdf" ? "PDF Tools" : cat === "media" ? "Media Tools" : `${cat.charAt(0).toUpperCase()}${cat.slice(1)} Tools`}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOOLS.filter((t) => t.category === cat).map((tool) => (
              <button
                key={tool.id}
                onClick={() => (tool.pair ? setPendingPair(tool.pair) : openToolPanel(tool.panel!))}
                className={cn(
                  "text-left bg-surface border border-border rounded-xl p-4 shadow-sm hover:border-primary/50 hover:shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tool.panel && toolPanel?.panel === tool.panel && "border-primary ring-1 ring-primary/30"
                )}
              >
                <div className="font-semibold text-sm">{tool.title}</div>
                <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel router                                                        */
/* ------------------------------------------------------------------ */

function ToolPanel({ id }: { id: string }) {
  switch (id) {
    case "extract":
      return <ExtractPanel />;
    case "merge-pdf":
      return <MergePdfPanel />;
    case "split-pdf":
      return <SplitPanel />;
    case "rotate-pdf":
      return <RotatePanel />;
    case "images-to-pdf":
      return <ImagesToPdfPanel />;
    case "pdf-metadata":
      return <MetadataPanel />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Extract Archive                                                     */
/* ------------------------------------------------------------------ */

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children: Map<string, TreeNode>;
  selected: boolean;
}

function buildTree(entries: { path: string; size: number; isDir: boolean }[]): TreeNode {
  const root: TreeNode = { name: "/", path: "", isDir: true, size: 0, children: new Map(), selected: true };
  for (const e of entries) {
    const parts = e.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      if (!node.children.has(parts[i])) {
        node.children.set(parts[i], { name: parts[i], path, isDir: isLast ? e.isDir : true, size: isLast ? e.size : 0, children: new Map(), selected: true });
      }
      node = node.children.get(parts[i])!;
    }
  }
  return root;
}

function TreeRow({ node, depth, onToggle, expanded, toggleExpand }: { node: TreeNode; depth: number; onToggle: (path: string, checked: boolean) => void; expanded: Set<string>; toggleExpand: (p: string) => void }) {
  const isOpen = expanded.has(node.path) || depth === 0;
  const hasChildren = node.children.size > 0;
  return (
    <div>
      <div className="flex items-center gap-2 py-1 px-2 hover:bg-surface-high rounded" style={{ paddingLeft: depth * 16 + 8 }}>
        <input
          type="checkbox"
          className="accent-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
          checked={node.selected}
          onChange={(e) => onToggle(node.path, e.target.checked)}
          aria-label={`Select ${node.path}`}
        />
        {hasChildren ? (
          <button onClick={() => toggleExpand(node.path)} aria-label={isOpen ? "Collapse" : "Expand"} className="text-muted-foreground">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        {node.isDir ? <FolderTree className="w-3.5 h-3.5 text-primary" aria-hidden /> : <FileText className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />}
        <span className="font-mono text-xs truncate">{node.name}</span>
        {!node.isDir && <span className="font-mono text-[10px] text-muted-foreground ml-auto shrink-0">{formatBytes(node.size)}</span>}
      </div>
      {isOpen &&
        [...node.children.values()]
          .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
          .map((c) => <TreeRow key={c.path} node={c} depth={depth + 1} onToggle={onToggle} expanded={expanded} toggleExpand={toggleExpand} />)}
    </div>
  );
}

function collectPaths(node: TreeNode, into: { files: string[]; dirs: string[] }) {
  if (node.isDir) into.dirs.push(node.path);
  else into.files.push(node.path);
  for (const c of node.children.values()) collectPaths(c, into);
}

function ExtractPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const [listing, setListing] = useState<ArchiveListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(async (f: File) => {
    setFile(f);
    setListing(null);
    setBusy(true);
    try {
      const det = await detectFormat(f);
      const kind = det.formatId;
      if (!kind || !["zip", "tar", "tar-gz", "tar-bz2"].includes(kind)) {
        toast.error("Unsupported archive", { description: "Extraction supports ZIP, TAR, TAR.GZ and TAR.BZ2. Convert 7Z/RAR/XZ first once those engines ship." });
        setFile(null);
        return;
      }
      setDetected(kind);
      const buffer = await f.arrayBuffer();
      const result = await postList(buffer, kind, f.name);
      setListing(result);
      const all = new Set<string>();
      result.entries.forEach((e) => all.add(e.path));
      setSelectedPaths(all);
      setExpanded(new Set());
    } catch (e) {
      toast.error((e as Error).message);
      setFile(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const togglePath = (path: string, checked: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const apply = (p: string) => {
        if (checked) next.add(p);
        else next.delete(p);
      };
      // toggle the node and all its children
      const matches = listing!.entries.filter((e) => e.path === path || e.path.startsWith(path + "/"));
      matches.forEach((m) => apply(m.path));
      if (checked) {
        // also reveal parent dirs
        const parts = path.split("/");
        for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
      }
      return next;
    });
  };

  const extract = async (mode: "all" | "selected") => {
    if (!file || !detected) return;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const paths = mode === "all" ? listing!.entries.filter((e) => !e.isDir).map((e) => e.path) : [...selectedPaths].filter((p) => !p.includes("/") || listing!.entries.some((e) => e.path === p && !e.isDir));
      const sel = mode === "all" ? null : [...(paths.length ? paths : [...selectedPaths])];
      const entries = await postExtract(buffer, detected, sel);
      if (entries.length === 1) {
        const blob = new Blob([entries[0].data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = entries[0].path.split("/").pop() ?? "file.bin";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        const { zipSync, strToU8 } = await import("fflate");
        const files: Record<string, Uint8Array> = {};
        for (const e of entries) files[e.path] = new Uint8Array(e.data);
        // ensure folder entries exist implicitly
        void strToU8;
        const zipped = zipSync(files, { level: 1 });
        const blob = new Blob([zipped], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file.name.replace(/\.[^.]+$/, "")}-extracted.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      toast.success(`Extracted ${entries.length} file(s) locally`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tree = listing ? buildTree(listing.entries) : null;
  const dirCount = listing?.entries.filter((e) => e.isDir).length ?? 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4" data-testid="extract-panel">
      <div className="flex items-center gap-2">
        <FileArchive className="w-5 h-5 text-primary" aria-hidden />
        <h3 className="font-bold">Extract Archive</h3>
        <span className="font-mono text-[10px] uppercase text-primary border border-primary/30 bg-accent-light/40 dark:bg-accent-light/20 rounded px-1.5 py-0.5">ZIP · TAR · TAR.GZ · TAR.BZ2</span>
      </div>

      <label className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Choose an archive to extract"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void open(f);
            e.target.value = "";
          }}
        />
        {busy ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
        ) : (
          <FileArchive className="w-6 h-6 text-muted-foreground" aria-hidden />
        )}
        <span className="text-sm font-medium">{file ? file.name : "Drop or click to pick an archive"}</span>
        <span className="text-xs text-muted-foreground">Listing happens locally — the file is scanned in a Web Worker</span>
      </label>

      {listing && tree && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>
              {listing.entries.length - dirCount} files · {dirCount} folders · {formatBytes(listing.totalUncompressed)} uncompressed
            </span>
            <span className="text-primary font-semibold">{listing.archiveKind}</span>
          </div>
          <div className="border border-border rounded-lg p-2 max-h-80 overflow-y-auto relay-scroll bg-surface-low">
            <TreeRow node={tree} depth={0} onToggle={togglePath} expanded={expanded} toggleExpand={(p) => setExpanded((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void extract("all")}>
              <FileDown className="w-4 h-4 mr-1.5" aria-hidden /> Extract All
            </Button>
            <Button variant="outline" disabled={busy || selectedPaths.size === 0} onClick={() => void extract("selected")}>
              <Download className="w-4 h-4 mr-1.5" aria-hidden /> Download Selected ({selectedPaths.size})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Guards active: path traversal blocked, 100k entries / 2 GB decompression caps, bomb-ratio protection.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PDF tool panels                                                     */
/* ------------------------------------------------------------------ */

function MergePdfPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setBusy(true);
    try {
      const buffers = await Promise.all(files.map((f) => f.arrayBuffer()));
      const bytes = await postPdfTool("merge", buffers, undefined, setProgress);
      const blob = new Blob([bytes.bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Merged PDF saved locally");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Merge className="w-5 h-5 text-primary" aria-hidden />
        <h3 className="font-bold">Merge PDF</h3>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="merge-input">Select PDFs (order preserved)</Label>
        <Input
          id="merge-input"
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="cursor-pointer"
        />
      </div>
      {files.length > 0 && (
        <ul className="font-mono text-xs text-muted-foreground space-y-1">
          {files.map((f, i) => (
            <li key={i}>
              {i + 1}. {f.name} ({formatBytes(f.size)})
            </li>
          ))}
        </ul>
      )}
      <Button disabled={busy || files.length < 2} onClick={() => void run()}>
        {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden /> : <Merge className="w-4 h-4 mr-1.5" aria-hidden />}
        {busy ? `Merging… ${Math.round(progress * 100)}%` : `Merge ${files.length || ""} PDFs`}
      </Button>
    </div>
  );
}

function SplitPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("1-3");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await postPdfTool("split", [await file.arrayBuffer()], ranges);
      const blob = new Blob([bytes.bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + "-split.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Split PDF saved locally");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Scissors className="w-5 h-5 text-primary" aria-hidden />
        <h3 className="font-bold">Split PDF</h3>
      </div>
      <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Choose PDF to split" className="cursor-pointer" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ranges">Page ranges</Label>
        <Input id="ranges" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3,5,8-" className="font-mono" />
        <p className="text-xs text-muted-foreground">e.g. &quot;1-3,5,8-&quot; — empty means all pages</p>
      </div>
      <Button disabled={busy || !file} onClick={() => void run()}>
        {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden /> : <Scissors className="w-4 h-4 mr-1.5" aria-hidden />}
        Split PDF
      </Button>
    </div>
  );
}

function RotatePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState("90");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await postPdfTool("rotate", [await file.arrayBuffer()], Number(angle));
      const blob = new Blob([bytes.bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + "-rotated.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Rotated PDF saved locally");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <RotateCw className="w-5 h-5 text-primary" aria-hidden />
        <h3 className="font-bold">Rotate PDF</h3>
      </div>
      <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Choose PDF to rotate" className="cursor-pointer" />
      <div className="flex gap-2">
        {["90", "180", "270"].map((a) => (
          <button
            key={a}
            onClick={() => setAngle(a)}
            className={cn("flex-1 py-2 rounded-lg border font-mono text-sm transition-colors", angle === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50")}
          >
            {a}°
          </button>
        ))}
      </div>
      <Button disabled={busy || !file} onClick={() => void run()}>
        {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden /> : <RotateCw className="w-4 h-4 mr-1.5" aria-hidden />}
        Rotate All Pages
      </Button>
    </div>
  );
}

function ImagesToPdfPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setBusy(true);
    try {
      const { runConversion } = await import("@/lib/conversion/runner");
      // Convert images one by one to a shared PDF via the pdfmake engine
      const bytes = await (async () => {
        const buffers = await Promise.all(files.map((f) => f.arrayBuffer()));
        setProgress(0.2);
        // For multiple images we reuse the merge tool after generating single-page PDFs
        const singlePdfs: ArrayBuffer[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const det = await detectFormat(f);
          const input = det.formatId ?? "jpg";
          const handle = runConversion(
            { inputFormat: input, outputFormat: "pdf", fileName: f.name, mime: f.type || "application/octet-stream", options: {}, file: f },
            () => {}
          );
          const result = await handle.promise;
          singlePdfs.push(result.bytes.slice().buffer as ArrayBuffer);
          setProgress((i + 1) / files.length);
          void buffers;
        }
        if (singlePdfs.length === 1) return new Uint8Array(singlePdfs[0]);
        const merged = await postPdfTool("merge", singlePdfs, undefined, () => {});
        return merged.bytes;
      })();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "images.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("PDF bound locally");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FilePlus2 className="w-5 h-5 text-primary" aria-hidden />
        <h3 className="font-bold">Images → PDF</h3>
      </div>
      <Input type="file" multiple accept="image/*,.heic,.heif,.tiff,.avif,.webp" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} aria-label="Choose images" className="cursor-pointer" />
      <p className="text-xs text-muted-foreground">Each image becomes one page. HEIC/TIFF are decoded locally first.</p>
      <Button disabled={busy || files.length === 0} onClick={() => void run()}>
        {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden /> : <FilePlus2 className="w-4 h-4 mr-1.5" aria-hidden />}
        {busy ? `Binding… ${Math.round(progress * 100)}%` : `Bind ${files.length || ""} images into PDF`}
      </Button>
    </div>
  );
}

function MetadataPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof readPdfMetadata>> | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const info = await readPdfMetadata(await file.slice(0, file.size).arrayBuffer());
      setMeta(info);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Info className="w-5 h-5 text-primary" aria-hidden />
        <h3 className="font-bold">PDF Metadata Viewer</h3>
      </div>
      <Input type="file" accept=".pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMeta(null); }} aria-label="Choose PDF to inspect" className="cursor-pointer" />
      <Button variant="outline" disabled={busy || !file} onClick={() => void run()}>
        {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden /> : <Info className="w-4 h-4 mr-1.5" aria-hidden />}
        Inspect locally
      </Button>
      {meta && (
        <dl className="font-mono text-xs grid grid-cols-2 gap-2 bg-surface-low border border-border rounded-lg p-3">
          <dt className="text-muted-foreground">Pages</dt>
          <dd className="font-bold">{meta.pages}</dd>
          <dt className="text-muted-foreground">Title</dt>
          <dd className="truncate">{meta.title ?? "—"}</dd>
          <dt className="text-muted-foreground">Author</dt>
          <dd className="truncate">{meta.author ?? "—"}</dd>
          <dt className="text-muted-foreground">Producer</dt>
          <dd className="truncate">{meta.producer ?? "—"}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{meta.creationDate ?? "—"}</dd>
        </dl>
      )}
    </div>
  );
}
