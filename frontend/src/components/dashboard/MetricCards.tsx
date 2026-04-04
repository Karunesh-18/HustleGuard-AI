"use client";

import type { ZoneLiveData } from "@/types";
import { countDisrupted, fmtInr } from "@/lib/formatters";

export function MetricCards({
  zones,
  totalPayout,
  payoutCount,
  riderReliability,
}: {
  zones: ZoneLiveData[];
  totalPayout: number;
  payoutCount: number;
  riderReliability?: number;
}) {
  const disrupted = countDisrupted(zones);
  const avgDai = zones.length
    ? zones.reduce((s, z) => s + z.dai, 0) / zones.length
    : 0;

  const metrics = [
    {
      label: "Active Zones",
      value: String(zones.length || "—"),
      sub: `${disrupted} disrupted`,
      subColor: disrupted > 0 ? "#E24B4A" : "#1D9E75",
    },
    {
      label: "Avg Zone DAI",
      value: zones.length ? avgDai.toFixed(2) : "—",
      sub: avgDai < 0.4 ? "⚠ Below threshold" : "Normal",
      subColor: avgDai < 0.4 ? "#E24B4A" : "#1D9E75",
    },
    {
      label: "Total Payout",
      value: totalPayout > 0 ? fmtInr(totalPayout) : "—",
      sub: `${payoutCount} events`,
      subColor: "var(--color-text-tertiary)",
    },
    {
      label: "Reliability",
      value: riderReliability != null ? `${riderReliability}/100` : "—",
      sub: "Trust score",
      subColor: "var(--color-text-tertiary)",
    },
  ];

  return (
    <div className="metric-grid">
      {metrics.map((m) => (
        <div key={m.label} className="metric-card">
          <div className="metric-label">{m.label}</div>
          <div className="metric-value">{m.value}</div>
          <div className="metric-sub" style={{ color: m.subColor }}>
            {m.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
