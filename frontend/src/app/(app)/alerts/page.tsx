"use client";

import { useEffect, useState, useCallback } from "react";
import { getZoneLiveData } from "@/lib/api";
import type { ZoneLiveData } from "@/types";

function AlertCard({ zone }: { zone: ZoneLiveData }) {
  const level = zone.dai < 0.4 ? "high" : zone.dai < 0.6 ? "moderate" : "normal";
  const icon = level === "high" ? "🚨" : level === "moderate" ? "⚠️" : "✅";
  const message =
    level === "high"
      ? "Severe disruption — auto-payout check running"
      : level === "moderate"
      ? "Moderate disruption — monitor closely"
      : "Conditions normal — no action needed";

  return (
    <div
      className="card"
      style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
    >
      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="row justify-between" style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 700 }}>{zone.zone_name}</div>
          <div className={`pill pill-${level}`} style={{ fontSize: "0.6rem" }}>
            {level.toUpperCase()}
          </div>
        </div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
          {message}
        </div>
        <div className="grid-3" style={{ gap: 6 }}>
          {[
            { l: "DAI", v: `${Math.round(zone.dai * 100)}%` },
            { l: "Rain", v: `${zone.rainfall_mm}mm` },
            { l: "AQI", v: zone.aqi },
          ].map(({ l, v }) => (
            <div key={l} style={{ fontSize: "0.75rem" }}>
              <span style={{ color: "var(--text-tertiary)" }}>{l}: </span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const data = await getZoneLiveData();
      setZones(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    const id = setInterval(fetch, 15_000);
    return () => clearInterval(id);
  }, [fetch]);

  // Sort: disrupted first
  const sorted = [...zones].sort((a, b) => a.dai - b.dai);
  const disrupted = sorted.filter((z) => z.dai < 0.4);
  const watch = sorted.filter((z) => z.dai >= 0.4 && z.dai < 0.6);
  const clear = sorted.filter((z) => z.dai >= 0.6);

  return (
    <div className="p-md stack">
      <div style={{ paddingTop: 4 }}>
        <div className="display-sm">Zone Alerts</div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Live disruption feed — updates every 15s
        </div>
      </div>

      {loading ? (
        <div className="stack">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer" style={{ height: 100 }} />)}
        </div>
      ) : zones.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <div className="empty-title">No zone data</div>
          <div className="empty-body">Backend may be offline</div>
        </div>
      ) : (
        <>
          {disrupted.length > 0 && (
            <div className="section">
              <div className="section-title"><span>🚨</span> Active Disruptions ({disrupted.length})</div>
              <div className="stack">
                {disrupted.map((z) => <AlertCard key={z.zone_name} zone={z} />)}
              </div>
            </div>
          )}
          {watch.length > 0 && (
            <div className="section">
              <div className="section-title"><span>⚠️</span> Watch ({watch.length})</div>
              <div className="stack">
                {watch.map((z) => <AlertCard key={z.zone_name} zone={z} />)}
              </div>
            </div>
          )}
          {clear.length > 0 && (
            <div className="section">
              <div className="section-title"><span>✅</span> Clear ({clear.length})</div>
              <div className="stack">
                {clear.map((z) => <AlertCard key={z.zone_name} zone={z} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
