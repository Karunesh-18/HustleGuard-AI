"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useLiveData } from "@/hooks/useLiveData";
import { useHealth } from "@/hooks/useHealth";
import { evaluateTrigger } from "@/lib/api";
import { fmtInr } from "@/lib/formatters";
import { MetricCards } from "@/components/dashboard/MetricCards";
import {
  MLForecastBars,
  ClaimsAdminTable,
  FraudQueue,
  ZoneAdminTable,
} from "@/components/admin/AdminComponents";

import type { TriggerResponse } from "@/types";

type Tab = "Overview" | "Claims" | "Fraud" | "ML Models" | "Zones";
const TABS: Tab[] = ["Overview", "Claims", "Fraud", "ML Models", "Zones"];

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [mlForecasts, setMlForecasts] = useState<TriggerResponse[]>([]);
  const [liveTime, setLiveTime] = useState("--:--:--");

  const { zones, payouts, loading, totalPayout } = useLiveData();
  const { status: apiStatus } = useHealth();

  // ML forecasts for all zones
  const fetchForecasts = useCallback(async () => {
    if (zones.length === 0) return;
    const results = await Promise.allSettled(
      zones.slice(0, 5).map((z, i) => evaluateTrigger(i + 1, z))
    );
    const resolved = results
      .filter((r): r is PromiseFulfilledResult<TriggerResponse> => r.status === "fulfilled")
      .map((r) => r.value);
    setMlForecasts(resolved);
  }, [zones]);

  useEffect(() => { void fetchForecasts(); }, [fetchForecasts]);
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  const disruptedCount = zones.filter((z) => z.dai < 0.4).length;
  const totalRiders = payouts.reduce((s, p) => s + p.eligible_riders, 0);

  return (
    <div>
      {/* ── Header ── */}
      <header className="adm-header">
        <div className="adm-logo">
          <div className="adm-logo-dot" />
          HustleGuard Admin
        </div>
        <nav className="adm-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`adm-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
              type="button"
              id={`admin-tab-${t.toLowerCase().replace(" ", "-")}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div className="adm-live">
          <div className="adm-live-dot" />
          Live · {liveTime}
        </div>
        <div className="api-status" style={{ fontSize: 11 }}>
          <div className={`api-dot ${apiStatus}`} />
          {apiStatus === "ok" ? "API Online" : apiStatus === "db-offline" ? "DB Offline" : "Unreachable"}
        </div>
        <Link href="/" className="topbar-link">← Rider View</Link>
      </header>

      <div className="adm-body">
        {/* ── Overview Tab ── */}
        {tab === "Overview" && (
          <>
            {/* Top metrics */}
            <div className="adm-metric-grid" style={{ marginBottom: 18 }}>
              {[
                { label: "Active Policies", value: "0", delta: "—", up: true },
                { label: "Claims Today", value: String(payouts.length), delta: "—", up: false },
                { label: "Payout Today", value: fmtInr(totalPayout), delta: "—", up: false },
                { label: "Loss Ratio", value: "0%", delta: "—", up: true },
                { label: "Fraud Blocked", value: "0", delta: "—", up: true },
              ].map((m) => (
                <div key={m.label} className="metric-card">
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-value">{m.value}</div>
                  <div className="metric-sub" style={{ color: m.up ? "var(--brand)" : "var(--danger)" }}>
                    {m.delta}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-3">
              {/* Zone disruption map */}
              <div className="card">
                <div className="card-title">Zone Disruption Map <span className="card-tag">Real-time</span></div>
                <div className="zone-map-wrap">
                  <svg viewBox="0 0 340 180" style={{ width: "100%", height: "100%" }}>
                    {[
                      { cx: 80, cy: 80, rx: 55, ry: 45, zone: "Koramangala" },
                      { cx: 200, cy: 60, rx: 42, ry: 35, zone: "HSR Layout" },
                      { cx: 280, cy: 110, rx: 40, ry: 32, zone: "Indiranagar" },
                      { cx: 160, cy: 140, rx: 38, ry: 28, zone: "E-City" },
                      { cx: 290, cy: 40, rx: 30, ry: 22, zone: "Whitefield" },
                    ].map((b) => {
                      const zd = zones.find((z) => z.zone_name.toLowerCase().includes(b.zone.toLowerCase().split(" ")[0]));
                      const dai = zd?.dai ?? 0.5;
                      const fill = dai < 0.4 ? "#F09595" : dai < 0.65 ? "#FAC775" : "#97C459";
                      const textColor = dai < 0.4 ? "#791F1F" : dai < 0.65 ? "#633806" : "#27500A";
                      return (
                        <g key={b.zone}>
                          <ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={fill} opacity="0.75" />
                          <text x={b.cx} y={b.cy - 2} textAnchor="middle" fontSize="8" fontWeight="500" fill={textColor}>{b.zone}</text>
                          <text x={b.cx} y={b.cy + 10} textAnchor="middle" fontSize="7" fill={textColor}>DAI {dai.toFixed(2)}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="zone-legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background: "#F09595" }} /> Disrupted (&lt;0.4)</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: "#FAC775" }} /> Moderate</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: "#97C459" }} /> Normal</div>
                </div>
              </div>

              {/* Weekly loss ratio */}
              <div className="card">
                <div className="card-title">Weekly Loss Ratio</div>
                <div className="bar-chart">
                  {[
                    { week: "W14", h: 50, color: "#B5D4F4" },
                    { week: "W15", h: 62, color: "#85B7EB" },
                    { week: "W16", h: 44, color: "#B5D4F4" },
                    { week: "W17", h: 78, color: "#F09595" },
                    { week: "W18", h: 58, color: "#85B7EB" },
                    { week: "W19", h: 68, color: "#E24B4A" },
                  ].map((b) => (
                    <div key={b.week} className="bar-group">
                      <div className="bar" style={{ height: b.h, background: b.color }} />
                      <div className="bar-label">{b.week}</div>
                    </div>
                  ))}
                </div>
                <div className="chart-note">% of premiums paid as claims · W19 spike = rain event</div>
              </div>

              {/* ML Forecast */}
              <div className="card">
                <div className="card-title">ML Disruption Forecast <span className="card-tag">0.40 threshold</span></div>
                <MLForecastBars zones={zones} forecasts={mlForecasts} loading={loading} />
                <div className="chart-note" style={{ marginTop: 8 }}>RandomForest · R² 0.94 · 50K training samples</div>
              </div>
            </div>

            {/* Bottom grid */}
            <div className="grid-2-equal">
              <div className="card">
                <div className="card-title">Fraud Detection Queue <span className="card-tag" style={{ color: "var(--danger)", background: "var(--danger-bg)" }}>0 flagged</span></div>
                <FraudQueue />
              </div>
              <div className="card">
                <div className="card-title">Payout Pipeline · Today</div>
                <div className="payout-summary">
                  {[
                    { label: "Instant", amount: fmtInr(totalRiders * 600), riders: totalRiders, color: "var(--brand)" },
                    { label: "Provisional", amount: "₹0", riders: 0, color: "var(--warning-dark)" },
                    { label: "Held", amount: "₹0", riders: 0, color: "var(--danger-dark)" },
                  ].map((p) => (
                    <div key={p.label} className="payout-box">
                      <div className="payout-box-label">{p.label}</div>
                      <div className="payout-box-amount" style={{ color: p.color }}>{p.amount}</div>
                      <div className="payout-box-riders">{p.riders} riders</div>
                    </div>
                  ))}
                </div>
                <div className="recent-label">Recent events</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {payouts.slice(0, 4).map((p) => (
                    <div key={p.id} className="payout-row">
                      <div className="payout-dot" />
                      <div className="payout-info">{p.zone_name}</div>
                      <div className="payout-amount" style={{ color: "var(--brand)" }}>{fmtInr(p.payout_amount_inr)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Claims Tab ── */}
        {tab === "Claims" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>Claims Management</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>All parametric payout events — auto-triggered by ML disruption model</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="metric-card" style={{ padding: "8px 14px" }}>
                  <div className="metric-label">Total Events</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{payouts.length}</div>
                </div>
                <div className="metric-card" style={{ padding: "8px 14px" }}>
                  <div className="metric-label">Total Paid</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "var(--brand)" }}>{fmtInr(totalPayout)}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <ClaimsAdminTable payouts={payouts} />
            </div>
          </div>
        )}

        {/* ── Fraud Tab ── */}
        {tab === "Fraud" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>Fraud Detection Queue</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Real-time fraud signal evaluation across 6 risk dimensions</div>
              </div>
            </div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title">Signal Dimensions</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { label: "Environmental", desc: "Rainfall/AQI vs claimed disruption", color: "var(--brand)" },
                  { label: "DAI Consistency", desc: "Zone DAI vs claim severity", color: "var(--brand)" },
                  { label: "Behavioral", desc: "Zone history & claim frequency", color: "var(--warning)" },
                  { label: "Motion Realism", desc: "GPS velocity & teleport detection", color: "var(--warning)" },
                  { label: "IP / Network", desc: "GPS vs IP city match, subnet clusters", color: "var(--danger)" },
                  { label: "Peer Coordination", desc: "Synchronized claim burst detection", color: "var(--danger)" },
                ].map((d) => (
                  <div key={d.label} style={{ background: "var(--bg-raised)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: d.color, marginBottom: 3 }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">Fraud Queue <span className="card-tag">Live sample</span></div>
              <FraudQueue />
            </div>
          </div>
        )}

        {/* ── ML Models Tab ── */}
        {tab === "ML Models" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>ML Model Registry</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Phase 2 RandomForest models — trained on 50,000 synthetic samples</div>
            </div>
            <div className="grid-2-equal">
              {[
                {
                  title: "Model 1: DAI Regressor", badge: "Production", badgeVariant: "safe",
                  rows: [
                    ["Type", "RandomForestRegressor"],
                    ["CV R²", "0.9402 ± 0.0010"],
                    ["Test R²", "0.9404"],
                    ["MAE", "0.0336"],
                    ["n_estimators", "250"],
                    ["max_features", "log2"],
                    ["Training set", "50,000 rows"],
                  ],
                },
                {
                  title: "Model 2: Disruption Classifier", badge: "Beta A/B", badgeVariant: "beta",
                  rows: [
                    ["Type", "RandomForestClassifier"],
                    ["CV Accuracy", "97.89% ± 0.18%"],
                    ["Test Accuracy", "97.88%"],
                    ["F1-Score", "0.9783"],
                    ["n_estimators", "250"],
                    ["max_depth", "15"],
                    ["Trigger threshold", "0.40 (optimized)"],
                  ],
                },
              ].map((m) => (
                <div key={m.title} className="card">
                  <div className="card-title">
                    {m.title}
                    <span className="card-tag" style={{ color: m.badgeVariant === "safe" ? "var(--brand)" : "var(--warning-dark)", background: m.badgeVariant === "safe" ? "var(--brand-muted)" : "var(--warning-bg)" }}>
                      {m.badge}
                    </span>
                  </div>
                  {m.rows.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">Live ML Disruption Forecast <span className="card-tag">Threshold 0.40</span></div>
              <MLForecastBars zones={zones} forecasts={mlForecasts} loading={loading} />
            </div>
          </div>
        )}

        {/* ── Zones Tab ── */}
        {tab === "Zones" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>Zone Management</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Live zone health — refreshes every 60s</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "🔴 Disrupted", count: zones.filter((z) => z.dai < 0.4).length },
                  { label: "🟡 Moderate", count: zones.filter((z) => z.dai >= 0.4 && z.dai < 0.65).length },
                  { label: "🟢 Normal", count: zones.filter((z) => z.dai >= 0.65).length },
                ].map((m) => (
                  <div key={m.label} className="metric-card" style={{ padding: "6px 12px" }}>
                    <div className="metric-label">{m.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{m.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <ZoneAdminTable zones={zones} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

