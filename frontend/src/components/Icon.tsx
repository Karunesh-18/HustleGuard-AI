import React from "react";

/**
 * Lightweight inline SVG icon set — no emoji, no dependency.
 * All icons are 20×20 by default. Pass size/color props to override.
 */

type IconProps = { size?: number; color?: string; className?: string };

const base = (d: string | React.ReactNode, vb = "0 0 24 24", props?: IconProps) => (
  <svg
    width={props?.size ?? 20}
    height={props?.size ?? 20}
    viewBox={vb}
    fill="none"
    stroke={props?.color ?? "currentColor"}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props?.className}
    aria-hidden
  >
    {d}
  </svg>
);

export const HomeIcon     = (p?: IconProps) => base(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>, "0 0 24 24", p);
export const BellIcon     = (p?: IconProps) => base(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>, "0 0 24 24", p);
export const HandIcon     = (p?: IconProps) => base(<><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 9V5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v3"/><path d="M10 10.5V9a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4.5c0 2.5 2 4.5 6 4.5h0a6 6 0 0 0 6-6V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/></>, "0 0 24 24", p);
export const UserIcon     = (p?: IconProps) => base(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>, "0 0 24 24", p);
export const ShieldIcon   = (p?: IconProps) => base(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, "0 0 24 24", p);
export const ZapIcon      = (p?: IconProps) => base(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>, "0 0 24 24", p);
export const MapPinIcon   = (p?: IconProps) => base(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>, "0 0 24 24", p);
export const AlertIcon    = (p?: IconProps) => base(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, "0 0 24 24", p);
export const CheckIcon    = (p?: IconProps) => base(<><polyline points="20 6 9 17 4 12"/></>, "0 0 24 24", p);
export const CloudRainIcon= (p?: IconProps) => base(<><line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></>, "0 0 24 24", p);
export const CarIcon      = (p?: IconProps) => base(<><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>, "0 0 24 24", p);
export const LockIcon     = (p?: IconProps) => base(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, "0 0 24 24", p);
export const HelpCircleIcon=(p?: IconProps) => base(<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, "0 0 24 24", p);
export const SosIcon      = (p?: IconProps) => base(<><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>, "0 0 24 24", p);
export const CreditCardIcon=(p?: IconProps) => base(<><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>, "0 0 24 24", p);
export const ActivityIcon = (p?: IconProps) => base(<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>, "0 0 24 24", p);
export const ChevronRightIcon=(p?: IconProps)=> base(<><polyline points="9 18 15 12 9 6"/></>, "0 0 24 24", p);
export const LogOutIcon   = (p?: IconProps) => base(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>, "0 0 24 24", p);
export const BarChartIcon = (p?: IconProps) => base(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>, "0 0 24 24", p);
export const LayersIcon   = (p?: IconProps) => base(<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>, "0 0 24 24", p);
export const RefreshIcon  = (p?: IconProps) => base(<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>, "0 0 24 24", p);
export const SmartphoneIcon=(p?: IconProps)=> base(<><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>, "0 0 24 24", p);
export const BanknoteIcon = (p?: IconProps) => base(<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></>, "0 0 24 24", p);
export const ClockIcon    = (p?: IconProps) => base(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, "0 0 24 24", p);
export const InfoIcon     = (p?: IconProps) => base(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>, "0 0 24 24", p);
