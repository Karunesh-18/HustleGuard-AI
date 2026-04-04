"use client";

import type { ZoneLiveData } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";

type Trigger = {
  icon: string;
  name: string;
  value: string;
  status: "fire" | "warn" | "ok";
};

function zoneToTriggers(zone: ZoneLiveData): Trigger[] {
  return [
    {
      icon: "🌧",
      name: "Rainfall",
      value: `${zone.rainfall_mm.toFixed(0)}mm · threshold >80mm`,
      status: zone.rainfall_mm > 80 ? "fire" : zone.rainfall_mm > 50 ? "warn" : "ok",
    },
    {
      icon: "📊",
      name: "DAI Index",
      value: `${zone.dai.toFixed(2)} · threshold <0.40`,
      status: zone.dai < 0.4 ? "fire" : zone.dai < 0.65 ? "warn" : "ok",
    },
    {
      icon: "💨",
      name: "AQI",
      value: `${zone.aqi} · threshold >300`,
      status: zone.aqi > 300 ? "fire" : zone.aqi > 200 ? "warn" : "ok",
    },
    {
      icon: "🚦",
      name: "Traffic",
      value: `${zone.traffic_index} · threshold <25`,
      status: zone.traffic_index < 25 ? "fire" : zone.traffic_index < 40 ? "warn" : "ok",
    },
  ];
}

export function TriggerList({ zone }: { zone: ZoneLiveData | null }) {
  const triggers = zone ? zoneToTriggers(zone) : null;

  return (
    <div className="trigger-list">
      {triggers
        ? triggers.map((t) => (
            <div key={t.name} className="trigger-row">
              <div className="trigger-icon">{t.icon}</div>
              <div className="trigger-info">
                <div className="trigger-name">{t.name}</div>
                <div className="trigger-val">{t.value}</div>
              </div>
              <StatusBadge
                label={t.status === "fire" ? "Active" : t.status === "warn" ? "Warning" : "Normal"}
                variant={t.status === "fire" ? "disrupted" : t.status === "warn" ? "warning" : "safe"}
              />
            </div>
          ))
        : [0, 1, 2, 3].map((i) => (
            <div key={i} className="trigger-row skeleton-shimmer" style={{ height: 44, borderRadius: 8 }} />
          ))}
    </div>
  );
}
