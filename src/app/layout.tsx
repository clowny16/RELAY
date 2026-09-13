import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/relay/providers";
import { JsonLd } from "@/components/relay/json-ld";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://relay-converter.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RELAY — Convert Any File Privately in Your Browser (Zero Uploads)",
    template: "%s | RELAY File Converter",
  },
  description:
    "Convert documents, images, audio, video, archives, eBooks, 3D models and data 100% privately in your browser. Powered by WebAssembly and Web Workers. Zero bytes uploaded to servers. Free forever.",
  applicationName: "RELAY",
  authors: [{ name: "RELAY Team", url: siteUrl }],
  generator: "Next.js",
  keywords: [
    // Core high-intent search terms
    "online file converter",
    "free file converter",
    "private file converter",
    "browser file converter",
    "client-side file conversion",
    "no upload converter",
    "zero upload file converter",
    "offline file converter",
    "safe file converter",
    "pwa file converter",
    // Image conversions
    "heic to jpg",
    "heic to png",
    "heic converter online",
    "webp to jpg",
    "png to webp",
    "svg to png",
    "tiff to jpg",
    "image to pdf",
    // Document conversions
    "pdf to jpg",
    "pdf to png",
    "pdf to text",
    "pdf to html",
    "docx to pdf",
    "docx to html",
    "markdown to html",
    "markdown to pdf",
    "html to markdown",
    // Archive tools
    "tar to zip",
    "zip to tar",
    "tar gz to zip",
    "tar bz2 to zip",
    "bz2 to zip",
    "extract zip online",
    "extract tar online",
    "online archive extractor",
    // Data conversions
    "csv to json",
    "json to csv",
    "json to xlsx",
    "xlsx to csv",
    "csv to xlsx",
    "yaml to json",
    "toml to json",
    "xml to json",
    // Audio & Video
    "mp4 to gif",
    "video to gif",
    "mp3 to wav",
    "wav to mp3",
    "audio converter",
    "extract audio from mp4",
    // 3D & Fonts
    "stl to obj",
    "obj to stl",
    "stl to glb",
    "3d model converter",
    "ttf to woff",
    "otf to ttf",
    "web font converter",
    // Subtitles
    "srt to vtt",
    "vtt to srt",
  ],
  creator: "RELAY",
  publisher: "RELAY",
  category: "UtilitiesApplication",
  classification: "File Converter Utility",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "RELAY — Convert Any File Privately in Your Browser",
    description:
      "Convert documents, images, audio, archives and data locally in your browser. 0 bytes uploaded to any server. Free forever.",
    url: siteUrl,
    siteName: "RELAY",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "RELAY — Private In-Browser File Converter (Zero Uploads)",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RELAY — Convert Any File Privately in Your Browser (Zero Uploads)",
    description:
      "Convert documents, images, audio, archives & data locally on your device with WebAssembly. Your files never leave your browser.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: "RELAY",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <JsonLd />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
