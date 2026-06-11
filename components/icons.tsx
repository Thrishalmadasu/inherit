// Inline SVG icon set (Lucide-style strokes), ported from the prototype's `I`.
// Each icon forwards SVG props so size/color come from Tailwind classes
// (e.g. <Icon.search className="size-4 text-fg-2" />). Default stroke uses
// currentColor so `text-*` controls the color.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const Icon = {
  shield: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  building: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg {...base} strokeWidth={2.2} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  bookmark: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-5 7 5z" />
    </svg>
  ),
  bookmarkFilled: (p: IconProps) => (
    <svg {...base} fill="currentColor" {...p}>
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-5 7 5z" />
    </svg>
  ),
  chev: (p: IconProps) => (
    <svg {...base} strokeWidth={2.4} {...p}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  pin: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 21s7-7.3 7-12a7 7 0 0 0-14 0c0 4.7 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  calendar: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  code: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  ),
  layers: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="m12 2 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  ),
  users: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  bolt: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  ),
  gauge: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 14 19 7" />
      <path d="M22 12a10 10 0 1 0-17 7" />
    </svg>
  ),
  arrow: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  ),
  list: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  home: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  user: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  heart: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.07a5.5 5.5 0 0 0-7.78 7.78l1.07 1.06L12 21.23l7.77-7.79 1.07-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  eye: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  x: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  pencil: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  info: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  share: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
  doc: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  trending: (p: IconProps) => (
    <svg {...base} {...p}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  clock: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  ),
  book: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  target: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  ),
  upload: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  ),
  thumbUp: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  ),
} as const;

export type IconName = keyof typeof Icon;
