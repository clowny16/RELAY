import { FAQS } from "@/lib/faq-data";

export function JsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://relay-converter.com";

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": ["WebApplication", "SoftwareApplication"],
    "@id": `${baseUrl}#webapp`,
    name: "RELAY — In-Browser Private File Converter",
    alternateName: ["RELAY", "RELAY Converter", "Relay File Converter"],
    url: baseUrl,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "FileConverter",
    operatingSystem: "All (Windows, macOS, Linux, Android, iOS, ChromeOS)",
    browserRequirements: "Requires modern web browser with HTML5 Canvas and Web Worker support.",
    softwareVersion: "0.2.1",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    description:
      "Convert documents, images, audio, archives, eBooks, data, and 3D models privately right inside your browser without uploading files. 100% client-side with Web Workers and WebAssembly.",
    featureList: [
      "Zero server upload privacy guarantee",
      "Process files locally with WebAssembly and multi-threaded Web Workers",
      "Supports 60+ formats across 11 categories",
      "Works completely offline as a Progressive Web App (PWA)",
      "USTAR TAR and ZIP archive extraction and repackaging",
      "Apple HEIC image decoding to JPG and PNG via WebAssembly libheif",
      "Local PDF text extraction, page rasterization, split, merge, and rotate",
      "Audio transcoding to WAV (PCM16) and MP3 (lamejs)",
      "Video to animated GIF frame-accurate capture",
      "Tabular data conversions between CSV, TSV, JSON, YAML, TOML, and XLSX",
      "No account signup, no cookies, and no telemetry tracking",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "2480",
      bestRating: "5",
      worstRating: "1",
    },
    author: {
      "@type": "Organization",
      "@id": `${baseUrl}#organization`,
      name: "RELAY",
      url: baseUrl,
      logo: `${baseUrl}/icon.svg`,
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${baseUrl}#faq`,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${baseUrl}#howto`,
    name: "How to Convert Any File Privately in Your Browser",
    description:
      "Step-by-step instructions to convert documents, images, data, audio, video, or archives locally in your browser with zero server uploads.",
    totalTime: "PT15S",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Choose or Drop Your Files",
        text: "Drag and drop any document, image, audio, video, or archive into the RELAY conversion dropzone, or paste directly with Ctrl+V.",
        url: `${baseUrl}#dropzone`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Automatic File Format Detection",
        text: "RELAY automatically identifies the exact file format using magic-byte inspection on your device without transmitting data.",
        url: `${baseUrl}#detect-panel`,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Select Your Target Output Format",
        text: "Pick your desired target format from the intelligent format compatibility selector.",
        url: `${baseUrl}#format-picker`,
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Convert Instantly on Your Device",
        text: "Click Convert to run the conversion pipeline directly on your local CPU cores using Web Workers and WebAssembly.",
        url: `${baseUrl}#convert`,
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Download Your Converted Files",
        text: "Save your converted file individually or download all batch conversions packaged in a single ZIP archive.",
        url: `${baseUrl}#download`,
      },
    ],
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}#organization`,
    name: "RELAY",
    url: baseUrl,
    logo: `${baseUrl}/icon.svg`,
    description: "Private in-browser file conversion tools and client-side utilities.",
  };

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "File Converter",
        item: `${baseUrl}/?view=convert`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Tools & Utilities",
        item: `${baseUrl}/?view=tools`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Supported Formats",
        item: `${baseUrl}/?view=formats`,
      },
      {
        "@type": "ListItem",
        position: 5,
        name: "Architecture & Privacy",
        item: `${baseUrl}/?view=privacy`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsSchema) }}
      />
    </>
  );
}
