import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/relay/providers";

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

export const metadata: Metadata = {
  title: {
    default: "RELAY — Convert Files. Privately. Right in Your Browser.",
    template: "%s | RELAY",
  },
  description:
    "Convert documents, images, audio, archives, eBooks, data and more without uploading your files. 100% client-side conversion engine with Web Workers and WebAssembly. Your files never leave your device.",
  keywords: [
    "online file converter",
    "free file converter",
    "browser file converter",
    "private file conversion",
    "TAR to ZIP",
    "ZIP to TAR",
    "PDF to JPG",
    "HEIC to JPG",
    "CSV to JSON",
    "DOCX to PDF",
    "client-side conversion",
    "no upload converter",
  ],
  authors: [{ name: "RELAY" }],
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "RELAY — Convert Files. Privately. Right in Your Browser.",
    description:
      "Convert hundreds of file formats with intelligent compatibility matching. Processed locally in your browser — zero uploads.",
    siteName: "RELAY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RELAY — Private In-Browser File Conversion",
    description:
      "Convert documents, images, audio, archives and data without uploading your files.",
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
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
