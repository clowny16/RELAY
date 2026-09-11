"use client";

import { useId } from "react";

/**
 * RELAY brand mark — orange gradient tile, white double chevron (the baton
 * passing forward), cyber-yellow dot as the baton tip. Same artwork as
 * /public/icon.svg so the header logo and the favicon always match.
 */
export function RelayMark({ className, title }: { className?: string; title?: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`relay-bg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF6A24" />
          <stop offset="1" stopColor="#FF4F00" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#relay-bg-${gid})`} />
      <path
        d="M15 20.5 L26.5 32 L15 43.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 20.5 L41.5 32 L30 43.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="49.5" cy="32" r="4.5" fill="#FFD400" />
    </svg>
  );
}
