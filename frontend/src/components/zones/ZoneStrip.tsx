"use client";

import type { ZoneLiveData } from "@/types";
import { daiColor, zoneStatus, zoneStatusColors } from "@/lib/formatters";

export function ZoneStrip({
  zones,
  selected,
  onSelect,
}: {
  zones: ZoneLiveData[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const displayZones =
    zones.length > 0
      ? [...zones].sort((a, b) => a.dai - b.dai) // worst first
      : FALLBACK_ZONES;

  return (
    <div className="zone-strip">
      {displayZones.map((z) => {
        const st = zoneStatus(z.dai);
        const { bg, border, text, label } = zoneStatusColors(st);
        const isSelected = selected === z.zone_name;
        return (
          <button
            key={z.zone_name}
            className="zone-pill"
            onClick={() => onSelect(z.zone_name)}
            type="button"
            style={{
              background: bg,
              borderColor: isSelected ? border : "transparent",
              boxShadow: isSelected ? `0 0 0 1px ${border}` : undefined,
            }}
            title={`${z.zone_name} — DAI ${z.dai.toFixed(2)} · AQI ${z.aqi} · Rain ${z.rainfall_mm.toFixed(0)}mm`}
          >
            <div className="zone-pill-name" style={{ color: text }}>{z.zone_name}</div>
            <div className="zone-pill-dai" style={{ color: daiColor(z.dai) }}>
              {z.dai.toFixed(2)}
            </div>
            <div className="zone-pill-label" style={{ color: text, opacity: 0.7 }}>{label}</div>
          </button>
        );
      })}
    </div>
  );
}

const FALLBACK_ZONES: ZoneLiveData[] = [
  { zone_name: "Koramangala", dai: 0.28, workability_score: 31, rainfall_mm: 92, aqi: 143, traffic_index: 38, updated_at: new Date().toISOString() },
  { zone_name: "HSR Layout", dai: 0.51, workability_score: 57, rainfall_mm: 45, aqi: 118, traffic_index: 54, updated_at: new Date().toISOString() },
  { zone_name: "Indiranagar", dai: 0.83, workability_score: 82, rainfall_mm: 12, aqi: 86, traffic_index: 72, updated_at: new Date().toISOString() },
  { zone_name: "Whitefield", dai: 0.79, workability_score: 79, rainfall_mm: 8, aqi: 79, traffic_index: 68, updated_at: new Date().toISOString() },
  { zone_name: "Electronic City", dai: 0.44, workability_score: 52, rainfall_mm: 37, aqi: 109, traffic_index: 48, updated_at: new Date().toISOString() },
];
