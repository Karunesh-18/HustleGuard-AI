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
  const displayZones = [...zones].sort((a, b) => a.dai - b.dai); // worst first

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

