export interface FaqItem {
  question: string;
  answer: string;
  iconName: "ShieldCheck" | "Infinity" | "Globe" | "Zap" | "Lock" | "Cpu" | "HelpCircle";
}

export const FAQS: FaqItem[] = [
  {
    question: "How does RELAY convert files without uploading them?",
    answer:
      "RELAY executes modern WebAssembly (WASM) and JavaScript conversion engines directly inside your browser via Web Workers. When you select a file, it is loaded into your device's local memory, converted on your local CPU cores, and made available as a downloadable blob. No network upload request is ever initiated.",
    iconName: "ShieldCheck",
  },
  {
    question: "Is RELAY completely free to use?",
    answer:
      "Yes, RELAY is 100% free with no limits, no subscription tiers, no hidden paywalls, and no account signup required. Batch sizes and concurrent conversion limits are determined solely by your hardware capability (CPU cores and RAM) rather than an artificial pricing tier.",
    iconName: "Infinity",
  },
  {
    question: "Does RELAY work offline?",
    answer:
      "Yes. RELAY is built as a progressive web application (PWA) with a dedicated Service Worker. Once you load the site, the core application shell and conversion engines are cached locally. You can disconnect your internet or work in airplane mode, and conversions will continue working seamlessly.",
    iconName: "Globe",
  },
  {
    question: "What file formats are supported?",
    answer:
      "RELAY supports over 60 file formats across 11 categories, including Documents (PDF, DOCX, TXT, Markdown, HTML, RTF), Images (JPEG, PNG, WebP, GIF, BMP, ICO, TIFF, SVG, AVIF, HEIC via WebAssembly), Archives (TAR, ZIP, TAR.GZ, TAR.BZ2, GZ, BZ2), Data (CSV, TSV, JSON, JSONL, YAML, TOML, XML, INI, XLSX), Audio (MP3, WAV, FLAC, OGG, M4A), Video (MP4, WebM, MOV to GIF), 3D Meshes (STL, OBJ, PLY, GLB), Fonts (TTF, OTF, WOFF), and Subtitles (SRT, VTT).",
    iconName: "Zap",
  },
  {
    question: "How can I verify that my files are not being uploaded?",
    answer:
      "You can verify this in real-time: open your browser's Developer Tools (press F12 or right-click > Inspect), navigate to the Network tab, and drop any file to convert. You will observe that zero payload bytes are sent over the network. Your files physically never leave your machine.",
    iconName: "Lock",
  },
  {
    question: "Can I convert multiple files in batch?",
    answer:
      "Yes! You can drag and drop dozens of files at once or select an entire folder. RELAY automatically detects each file's format, groups them for unified output format selection, and processes them concurrently using multi-threaded Web Workers without freezing your browser tab.",
    iconName: "Cpu",
  },
  {
    question: "Is there a file size limit?",
    answer:
      "There is no artificial server file size limit. The only constraint is your computer's available memory (RAM). For safety, RELAY includes built-in memory checks and decompression bomb protection (2 GB maximum decompressed safety guard).",
    iconName: "HelpCircle",
  },
];
