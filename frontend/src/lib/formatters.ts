// ─── Shared formatters ────────────────────────────────────────────────────────

import type { ZoneLiveData, ZoneStatus } from "@/types";

export function fmtInr(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

export function zoneStatus(dai: number): ZoneStatus {
  if (dai < 0.4) return "disrupted";
  if (dai < 0.65) return "warning";
  return "safe";
}

export function zoneStatusColors(status: ZoneStatus): {
  bg: string;
  border: string;
  text: string;
  label: string;
} {
  switch (status) {
    case "disrupted":
      return { bg: "#FCEBEB", border: "#E24B4A", text: "#A32D2D", label: "Disrupted" };
    case "warning":
      return { bg: "#FAEEDA", border: "#EF9F27", text: "#854F0B", label: "Moderate" };
    case "safe":
      return { bg: "#EAF3DE", border: "#639922", text: "#27500A", label: "Normal" };
  }
}

/** Returns color for a probability 0–1 */
export function probColor(prob: number): string {
  if (prob >= 0.5) return "#E24B4A";
  if (prob >= 0.4) return "#EF9F27";
  return "#1D9E75";
}

/** DAI as a coloured string */
export function daiColor(dai: number): string {
  if (dai < 0.4) return "#E24B4A";
  if (dai < 0.65) return "#EF9F27";
  return "#1D9E75";
}

/** Find worst zone (lowest DAI) */
export function worstZone(zones: ZoneLiveData[]): ZoneLiveData | null {
  if (!zones.length) return null;
  return [...zones].sort((a, b) => a.dai - b.dai)[0];
}

/** Count disrupted zones */
export function countDisrupted(zones: ZoneLiveData[]): number {
  return zones.filter((z) => z.dai < 0.4).length;
}
