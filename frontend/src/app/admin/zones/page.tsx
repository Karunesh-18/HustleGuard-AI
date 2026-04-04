"use client";

import { useState, useCallback, useEffect } from "react";
import { getZoneLiveData, adminRefreshZones, adminSimulateDisruption, getZoneStatus } from "@/lib/api";
import type { ZoneLiveData } from "@/types";

type ZoneStatus = { zone_name: string; risk_label: string; disruption_probability: number; dai: number; rainfall_mm?: number; aqi?: number };

export default function AdminZonesPage() {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [zoneStatus, setZoneStatus] = useState<ZoneStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetch = useCallback(async () => {
    const [z, s] = await Promise.allSettled([getZoneLiveData(), getZoneStatus()]);
    if (z.status === "fulfilled") setZones(z.value);
    if (s.status === "fulfilled") setZoneStatus(s.value as ZoneStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await adminRefreshZones(); await fetch(); showToast("✅ All zones refreshed"); }
    catch { showToast("❌ Refresh failed"); }
    finally { setRefreshing(false); }
  };

  const handleSimulate = async (zone: string) => {
    setSimulating(zone);
    try { await adminSimulateDisruption(zone); await fetch(); showToast(`🌩️ Disruption simulated in ${zone}`); }
    catch { showToast("❌ Simulation failed — check backend"); }
    finally { setSimulating(null); }
  };

  const riskColor = (l: string) => l === "high" ? "var(--danger)" : l === "moderate" ? "var(--warning)" : "var(--accent)";

  const displayZones = zones.map((z) => {
    const status = zoneStatus.find((s) => s.zone_name === z.zone_name);
    return {
      ...z,
      risk_label: status?.risk_label ?? (z.dai < 0.4 ? "high" : z.dai < 0.6 ? "moderate" : "normal"),
      disruption_probability: status?.disruption_probability ?? (1 - z.dai),
    };
  });

  return (
    <div>
      {toast && <div className="toast" style={{ bottom: 24 }}>{toast}</div>}
      <div className="admin-header">
        <div>
          <div className="display-md">Zones</div>
          <div className="body-md" style={{ color: "var(--text-secondary)", marginTop: 4 }}>Live zone conditions + ML risk labels</div>
        </div>
        <button className="btn btn-ghost" onClick={handleRefresh} disabled={refreshing} type="button" style={{ width: "auto" }}>
          {refreshing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Refreshing…</> : "🔄 Refresh All"}
        </button>
      </div>

      {loading ? (
        <div className="stack">
          {[1,2,3].map((i) => <div key={i} className="skeleton-shimmer" style={{ height: 140 }} />)}
        </div>
      ) : (
        <div className="stack">
          {displayZones.map((z) => (
            <div key={z.zone_name} className="card">
              <div className="row justify-between" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{z.zone_name}</div>
                  <span className="badge" style={{
                    background: `rgba(${z.risk_label === "high" ? "239,68,68" : z.risk_label === "moderate" ? "245,158,11" : "6,214,160"},0.12)`,
                    color: riskColor(z.risk_label),
                    border: `1px solid ${riskColor(z.risk_label)}40`,
                    marginTop: 4,
                  }}>{z.risk_label} risk</span>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => handleSimulate(z.zone_name)}
                  disabled={!!simulating}
                  type="button"
                  style={{ width: "auto", padding: "8px 14px", fontSize: "0.8125rem" }}
                >
                  {simulating === z.zone_name ? <><span className="spinner" style={{ width: 12, height: 12, borderTopColor: "var(--danger)" }} /> Simulating…</> : "🌩️ Simulate"}
                </button>
              </div>

              <div className="grid-4" style={{ gap: 8, marginBottom: 12 }}>
                {[
                  { l: "DAI", v: `${Math.round(z.dai * 100)}%`, danger: z.dai < 0.4 },
                  { l: "Rainfall", v: `${z.rainfall_mm}mm`, danger: z.rainfall_mm > 80 },
                  { l: "AQI", v: z.aqi, danger: z.aqi > 300 },
                  { l: "Traffic", v: z.traffic_index, danger: z.traffic_index > 80 },
                ].map(({ l, v, danger }) => (
                  <div key={l} className="metric-card" style={{ padding: "8px 10px" }}>
                    <div className="metric-label" style={{ fontSize: "0.5625rem" }}>{l}</div>
                    <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.9375rem", color: danger ? "var(--danger)" : "var(--text-primary)" }}>{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="row justify-between" style={{ marginBottom: 4, fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Disruption probability</span>
                  <span style={{ color: riskColor(z.risk_label), fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {Math.round(z.disruption_probability * 100)}%
                  </span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${z.risk_label === "high" ? "danger" : z.risk_label === "moderate" ? "warning" : "accent"}`}
                    style={{ width: `${Math.round(z.disruption_probability * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
