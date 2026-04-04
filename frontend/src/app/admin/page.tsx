"use client";

import { useEffect, useState, useCallback } from "react";
import { getZoneLiveData, getRecentPayouts, getZoneStatus } from "@/lib/api";
import type { ZoneLiveData, PayoutEventRead } from "@/types";

type ZoneStatus = { zone_name: string; risk_label: string; disruption_probability: number; dai: number };

export default function AdminOverviewPage() {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [payouts, setPayouts] = useState<PayoutEventRead[]>([]);
  const [zoneStatus, setZoneStatus] = useState<ZoneStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const [z, p, s] = await Promise.allSettled([getZoneLiveData(), getRecentPayouts(), getZoneStatus()]);
    if (z.status === "fulfilled") setZones(z.value);
    if (p.status === "fulfilled") setPayouts(p.value);
    if (s.status === "fulfilled") setZoneStatus(s.value as ZoneStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => { void fetch(); const id = setInterval(fetch, 20_000); return () => clearInterval(id); }, [fetch]);

  const highRisk = zoneStatus.filter((z) => z.risk_label === "high").length;
  const totalPaid = payouts.reduce((s, p) => s + p.payout_amount_inr, 0);
  const totalRiders = payouts.reduce((s, p) => s + p.eligible_riders, 0);
  const riskColor = (l: string) => l === "high" ? "var(--danger)" : l === "moderate" ? "var(--warning)" : "var(--accent)";

  const displayRows = zoneStatus.length > 0 ? zoneStatus : zones.map((z) => ({
    zone_name: z.zone_name,
    risk_label: z.dai < 0.4 ? "high" : z.dai < 0.6 ? "moderate" : "normal",
    disruption_probability: 1 - z.dai,
    dai: z.dai,
  }));

  return (
    <div>
      <div className="admin-header">
        <div>
          <div className="display-md">Dashboard</div>
          <div className="body-md" style={{ color: "var(--text-secondary)", marginTop: 4 }}>Live overview — auto-refreshes every 20s</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        {[
          { label: "Active Zones", value: String(zones.length || "—"), sub: `${highRisk} high risk` },
          { label: "Total Paid Out", value: totalPaid ? `₹${totalPaid.toLocaleString()}` : "—", sub: "all-time", accent: true },
          { label: "Riders Protected", value: String(totalRiders || "—"), sub: "via payouts" },
          { label: "High Risk Zones", value: String(highRisk), sub: "currently", danger: highRisk > 0 },
        ].map(({ label, value, sub, accent, danger }) => (
          <div key={label} className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value" style={{ color: accent ? "var(--accent)" : danger ? "var(--danger)" : "var(--text-primary)" }}>
              {loading ? <span style={{ opacity: 0.4 }}>—</span> : value}
            </div>
            <div className="metric-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title"><span>🗺️</span> Zone ML Status</div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr><th>Zone</th><th>Risk Label</th><th>Disruption Prob</th><th>DAI</th></tr>
            </thead>
            <tbody>
              {displayRows.map((z) => (
                <tr key={z.zone_name}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{z.zone_name}</td>
                  <td>
                    <span className="badge" style={{
                      background: `rgba(${z.risk_label === "high" ? "239,68,68" : z.risk_label === "moderate" ? "245,158,11" : "6,214,160"},0.1)`,
                      color: riskColor(z.risk_label), border: `1px solid ${riskColor(z.risk_label)}44`,
                    }}>{z.risk_label}</span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="progress-track" style={{ width: 80 }}>
                        <div className={`progress-fill ${z.risk_label === "high" ? "danger" : z.risk_label === "moderate" ? "warning" : "accent"}`}
                          style={{ width: `${Math.round(z.disruption_probability * 100)}%` }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>{Math.round(z.disruption_probability * 100)}%</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{z.dai.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><span>💸</span> Recent Payouts</div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>Zone</th><th>Reason</th><th>Amount</th><th>Riders</th></tr></thead>
            <tbody>
              {payouts.slice(0, 8).map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.zone_name}</td>
                  <td>{p.trigger_reason}</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>₹{p.payout_amount_inr}</td>
                  <td>{p.eligible_riders}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 24 }}>No payouts recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
