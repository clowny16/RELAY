import type { MetadataRoute } from "next";
import { POPULAR_PAIRS, TOOLS } from "@/lib/conversion/registry";
import { FORMATS } from "@/lib/conversion/formats";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://relay-converter.com";
  const now = new Date();

  // Core navigation pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/?view=tools`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/?view=formats`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/?view=privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // Specific high-intent conversion route URLs
  const pairPages: MetadataRoute.Sitemap = POPULAR_PAIRS.map((p) => ({
    url: `${baseUrl}/?from=${p.input}&to=${p.output}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  // Tool utilities
  const toolPages: MetadataRoute.Sitemap = TOOLS.map((t) => ({
    url: `${baseUrl}/?tool=${t.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Supported format specification pages
  const formatPages: MetadataRoute.Sitemap = FORMATS.map((f) => ({
    url: `${baseUrl}/?format=${f.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...pairPages, ...toolPages, ...formatPages];
}
