# RELAY — In-Browser Private File Converter

> **Convert files privately, right inside your browser. Zero uploads. Free forever.**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Overview

**RELAY** is a modern, privacy-first file conversion web application where files are processed **100% locally inside the user's browser**. 

* **Zero Server Uploads**: File contents physically never reach any backend server. Everything runs via Web Workers, WebAssembly, and client-side JavaScript libraries.
* **No Account Required**: Completely free, no registration, no paywalls, and no subscription tiers.
* **Multi-Worker Parallelism**: Utilizes a pool of Web Workers scaled according to your device CPU cores (`navigator.hardwareConcurrency / 2`) so large files do not block the UI thread.
* **Works Offline**: Includes a Service Worker and PWA manifest to support offline file conversions.

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: v18+ or v20+
* **npm**: v9+ or v10+

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/clowny16/RELAY.git
   cd RELAY
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   *Alternatively, specify port 3000 directly:*
   ```bash
   npx next dev -p 3000
   ```

4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Supported Formats & Engines

RELAY supports over 60 formats across 11 categories:

| Category | Formats Supported | Key Conversions |
| :--- | :--- | :--- |
| **Documents** | `pdf`, `docx`, `txt`, `md`, `html`, `rtf` | DOCX → HTML/MD/TXT/PDF, Markdown → HTML/PDF, PDF → Images/Text |
| **Images** | `jpg`, `png`, `webp`, `gif`, `bmp`, `ico`, `svg`, `tiff`, `avif`, `heic` | HEIC → JPG/PNG (WASM), WebP ⇄ PNG/JPG, TIFF → JPG/PNG, SVG → PNG |
| **Archives** | `tar`, `zip`, `tar.gz`, `tar.bz2`, `gz`, `bz2` | TAR ⇄ ZIP, TAR.GZ ⇄ ZIP, BZ2 ⇄ ZIP, In-browser Archive Extractor |
| **Data** | `csv`, `tsv`, `json`, `jsonl`, `yaml`, `toml`, `xml`, `ini`, `xlsx` | Bidirectional conversion between tables and tree structures |
| **Media / Audio** | `mp3`, `wav`, `ogg`, `opus`, `flac`, `m4a`, `aac`, `aiff` | Audio decode + LAME MP3 re-encode, PCM16 WAV export |
| **Video** | `mp4`, `mov`, `webm`, `mkv` | Video → Animated GIF frame capture, WebM transcoder |
| **3D Meshes** | `stl`, `obj`, `ply`, `glb` | STL (Binary/ASCII) ⇄ OBJ, PLY ⇄ OBJ/STL, Export to Binary glTF (`.glb`) |
| **eBooks** | `epub`, `fb2`, `cbz` | EPUB spine walk → HTML/TXT/PDF, CBZ → Paginated PDF |
| **Fonts** | `ttf`, `otf`, `woff` | OTF → TTF, TTF ⇄ WOFF (custom zlib SFNT packer) |
| **Subtitles** | `srt`, `vtt` | SRT ⇄ WebVTT with cue timing preservation |

---

## 🏗️ Architecture

```
User File (Drag/Drop/Paste)
       │
       ▼
[Magic-Byte & Sniffing Detection] (detection.ts)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Web Worker Pool]              [Main Thread Web APIs]
• image.ts (OffscreenCanvas)    • media.ts (pdfjs-dist, Web Audio, Video)
• archive.ts (fflate, tar.ts)   • heic.ts (heic2any WASM libheif)
• data.ts (PapaParse, js-yaml)
• docs.ts (marked, mammoth)
• mesh.ts (STL, OBJ, GLB)
• font.ts (opentype.js, WOFF)
• pdfmake.ts (pdf-lib)
       │                                 │
       └────────────────┬────────────────┘
                        ▼
           [Local Blob / Download URL]
```

---

## 🔒 Privacy Guarantee

You can audit the privacy guarantee directly in your browser:
1. Open Developer Tools (`F12` or `Ctrl+Shift+I`).
2. Go to the **Network** tab.
3. Drop and convert any file.
4. Verify that **zero bytes** of your file are transmitted over the network.

---

## 📄 License

MIT License. Free to use, modify, and distribute.
