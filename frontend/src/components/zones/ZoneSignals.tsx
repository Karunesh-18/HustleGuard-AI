"use client";

import type { ZoneLiveData } from "@/types";
import { ProgressBar } from "@/components/shared/ProgressBar";

export function ZoneSignals({ zone }: { zone: ZoneLiveData }) {
  const signals = [
    {
      name: "Workability",
      value: zone.workability_score,
      max: 100,
      color:
        zone.workability_score < 50
          ? "#E24B4A"
          : zone.workability_score < 80
          ? "#EF9F27"
          : "#1D9E75",
      fmt: (v: number) => `${Math.round(v)}/100`,
    },
    {
      name: "Rainfall",
      value: Math.min(zone.rainfall_mm, 120),
      max: 120,
      color: zone.rainfall_mm > 80 ? "#E24B4A" : zone.rainfall_mm > 50 ? "#EF9F27" : "#1D9E75",
      fmt: (v: number) => `${Math.round(v)}mm`,
    },
    {
      name: "AQI",
      value: Math.min(zone.aqi, 500),
      max: 500,
      color:
        zone.aqi > 300 ? "#E24B4A" : zone.aqi > 150 ? "#EF9F27" : "#1D9E75",
      fmt: (v: number) => `${Math.round(v)}`,
    },
    {
      name: "Traffic idx",
      value: zone.traffic_index,
      max: 100,
      color: zone.traffic_index < 25 ? "#E24B4A" : "#1D9E75",
      fmt: (v: number) => `${Math.round(v)}`,
    },
  ];

  return (
    <div className="zone-signals">
      {signals.map((s) => (
        <div key={s.name} className="signal-row">
          <span className="signal-name">{s.name}</span>
          <ProgressBar value={s.value} max={s.max} color={s.color} animated />
          <span className="signal-val" style={{ color: s.color }}>
            {s.fmt(s.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
