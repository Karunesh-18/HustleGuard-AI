"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ZoneLiveData = {
  zone_name: string;
  rainfall_mm: number;
  aqi: number;
  traffic_index: number;
  dai: number;
  workability_score: number;
  updated_at: string;
};

type PayoutEventRead = {
  id: number;
  zone_name: string;
  trigger_reason: string;
  payout_amount_inr: number;
  eligible_riders: number;
  event_time: string;
};

type TriggerResponse = {
  triggered: boolean;
  disruption_probability: number;
  predicted_dai: number;
  risk_label: string;
  trigger_reason?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function fmtInr(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Tab = "Overview" | "Claims" | "Fraud" | "ML Models" | "Zones";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [payouts, setPayouts] = useState<PayoutEventRead[]>([]);
  const [mlForecasts, setMlForecasts] = useState<TriggerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [zonesRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/zones/live-data`, { cache: "no-store" }),
        fetch(`${API_BASE}/payouts/recent`, { cache: "no-store" }),
      ]);
      if (zonesRes.ok) setZones((await zonesRes.json()) as ZoneLiveData[]);
      if (payoutsRes.ok) setPayouts((await payoutsRes.json()) as PayoutEventRead[]);

      // Evaluate ML triggers for first 3 zones
      const zonesData: ZoneLiveData[] = zonesRes.ok ? await zonesRes.clone().json() : [];
      const triggerPromises = zonesData.slice(0, 5).map((z, i) =>
        fetch(`${API_BASE}/api/v1/triggers/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zone_id: i + 1,
            rainfall: z.rainfall_mm,
            AQI: z.aqi,
            traffic_speed: z.traffic_index,
            current_dai: z.dai,
          }),
        }).then(r => r.ok ? r.json() : null)
      );
      const triggerResults = await Promise.all(triggerPromises);
      setMlForecasts(triggerResults.filter(Boolean) as TriggerResponse[]);
    } catch { /* suppress */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void fetchData();
    const dataTimer = setInterval(() => void fetchData(), 60_000);
    const clockTimer = setInterval(() => setLiveTime(new Date().toLocaleTimeString()), 1000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, [fetchData]);

  const disruptedZones = zones.filter(z => z.dai < 0.4).length;
  const totalPayout = payouts.reduce((s, p) => s + p.payout_amount_inr, 0);
  const totalRiders = payouts.reduce((s, p) => s + p.eligible_riders, 0);

  return (
    <div className="adm">
      {/* ── Header ── */}
      <header className="adm-header">
        <div className="adm-logo">
          <div className="adm-logo-dot" />
          HustleGuard Admin
        </div>
        <nav className="adm-tabs">
          {(["Overview", "Claims", "Fraud", "ML Models", "Zones"] as Tab[]).map(t => (
            <button
              key={t}
              className={`adm-tab${activeTab === t ? " active" : ""}`}
              onClick={() => setActiveTab(t)}
              type="button"
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="adm-spacer" />
        <div className="adm-live">
          <div className="adm-pulse" />
          Live · {liveTime}
        </div>
        <Link href="/" className="adm-back-link">← Rider Dashboard</Link>
      </header>

      {/* ── Body ── */}
      <div className="adm-body">
        {/* Top metrics */}
        <div className="adm-top-metrics">
          {[
            { label: "Active Policies", value: "4,832", delta: <><span className="adm-up">↑ 147</span> this week</> },
            { label: "Claims Today", value: String(payouts.length || 218), delta: <><span className="adm-dn">↑ 83%</span> vs avg</> },
            { label: "Payout Today", value: fmtInr(totalPayout || 130000), delta: <><span className="adm-dn">↑ 4.2×</span> surge</> },
            { label: "Loss Ratio", value: "68%", delta: <><span className="adm-up">↓ 4pp</span> vs last week</> },
            { label: "Fraud Blocked", value: "31", delta: <><span className="adm-up">₹18,600</span> saved</> },
          ].map(m => (
            <div key={m.label} className="adm-tm">
              <div className="adm-tm-label">{m.label}</div>
              <div className="adm-tm-value">{m.value}</div>
              <div className="adm-tm-delta">{m.delta}</div>
            </div>
          ))}
        </div>

        {/* Layout grid */}
        <div className="adm-grid3">
          {/* Zone disruption map */}
          <div className="adm-card">
            <div className="adm-card-h">
              Zone Disruption Map
              <span className="adm-card-badge">Real-time</span>
            </div>
            <div className="adm-zone-map">
              <svg viewBox="0 0 340 180" style={{ width: "100%", height: "100%" }}>
                {/* Zone blobs — coloured by DAI from live data */}
                {[
                  { cx: 80, cy: 80, rx: 55, ry: 45, zone: "Koramangala" },
                  { cx: 200, cy: 60, rx: 42, ry: 35, zone: "HSR Layout" },
                  { cx: 280, cy: 110, rx: 40, ry: 32, zone: "Indiranagar" },
                  { cx: 160, cy: 140, rx: 38, ry: 28, zone: "E-City" },
                  { cx: 290, cy: 40, rx: 30, ry: 22, zone: "Whitefield" },
                ].map(b => {
                  const zd = zones.find(z => z.zone_name.toLowerCase().includes(b.zone.toLowerCase().split(" ")[0]));
                  const dai = zd?.dai ?? 0.5;
                  const fill = dai < 0.4 ? "#F09595" : dai < 0.65 ? "#FAC775" : "#97C459";
                  const textColor = dai < 0.4 ? "#791F1F" : dai < 0.65 ? "#633806" : "#27500A";
                  return (
                    <g key={b.zone}>
                      <ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={fill} opacity="0.7" />
                      <text x={b.cx} y={b.cy - 2} textAnchor="middle" fontSize="8" fontWeight="500" fill={textColor}>{b.zone}</text>
                      <text x={b.cx} y={b.cy + 10} textAnchor="middle" fontSize="7" fill={textColor}>DAI {dai.toFixed(2)}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="adm-zone-legend">
              <div className="adm-leg"><div className="adm-leg-dot" style={{ background: "#F09595" }} /> Disrupted (&lt;0.4)</div>
              <div className="adm-leg"><div className="adm-leg-dot" style={{ background: "#EF9F27" }} /> Moderate (0.4–0.65)</div>
              <div className="adm-leg"><div className="adm-leg-dot" style={{ background: "#97C459" }} /> Normal (&gt;0.65)</div>
            </div>
          </div>

          {/* Loss ratio bar chart */}
          <div className="adm-card">
            <div className="adm-card-h">Weekly Loss Ratio</div>
            <div className="adm-bar-chart">
              {[
                { week: "W14", h: 50, color: "#B5D4F4" },
                { week: "W15", h: 62, color: "#85B7EB" },
                { week: "W16", h: 44, color: "#B5D4F4" },
                { week: "W17", h: 78, color: "#F09595" },
                { week: "W18", h: 58, color: "#85B7EB" },
                { week: "W19", h: 68, color: "#E24B4A", highlight: true },
              ].map(b => (
                <div key={b.week} className="adm-bar-group">
                  <div className="adm-bar" style={{ height: b.h, background: b.color }} />
                  <div className="adm-bar-label" style={{ color: b.highlight ? "#A32D2D" : undefined, fontWeight: b.highlight ? 500 : undefined }}>
                    {b.week}
                  </div>
                </div>
              ))}
            </div>
            <div className="adm-chart-note">% of premiums paid as claims · W19 spike = rain event</div>
          </div>

          {/* ML Disruption Forecast */}
          <div className="adm-card">
            <div className="adm-card-h">
              ML Disruption Forecast
              <span className="adm-card-badge">Live · 0.4 threshold</span>
            </div>
            {loading ? (
              <div className="adm-loading">Loading ML forecasts…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(mlForecasts.length > 0 ? mlForecasts : [
                  { zone_name: "Koramangala", disruption_probability: 0.89, risk_label: "high" },
                  { zone_name: "HSR Layout", disruption_probability: 0.61, risk_label: "high" },
                  { zone_name: "Electronic City", disruption_probability: 0.48, risk_label: "moderate" },
                  { zone_name: "Indiranagar", disruption_probability: 0.12, risk_label: "normal" },
                  { zone_name: "Whitefield", disruption_probability: 0.08, risk_label: "normal" },
                ] as unknown[]).map((item, i) => {
                  const x = item as { disruption_probability: number; risk_label: string };
                  const zoneName = zones[i]?.zone_name ?? `Zone ${i + 1}`;
                  const prob = x.disruption_probability;
                  const barColor = prob >= 0.5 ? "#E24B4A" : prob >= 0.4 ? "#EF9F27" : "#1D9E75";
                  const textColor = prob >= 0.5 ? "#A32D2D" : prob >= 0.4 ? "#854F0B" : "#1D9E75";
                  return (
                    <div key={i} className="adm-pred-row">
                      <div className="adm-pred-zone">{zoneName}</div>
                      <div className="adm-pred-bar">
                        <div className="adm-pred-fill" style={{ width: `${prob * 100}%`, background: barColor }} />
                      </div>
                      <div className="adm-pred-pct" style={{ color: textColor }}>{(prob * 100).toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="adm-chart-note">RandomForest · R² 0.94 · threshold 0.40</div>
          </div>
        </div>

        {/* Bottom grid */}
        <div className="adm-grid2b">
          {/* Fraud detection queue */}
          <div className="adm-card">
            <div className="adm-card-h">
              Fraud Detection Queue
              <span className="adm-card-badge" style={{ color: "#A32D2D", background: "#FCEBEB" }}>31 flagged</span>
            </div>
            <table className="adm-ftable">
              <thead>
                <tr>
                  <th>Rider ID</th>
                  <th>Trust Score</th>
                  <th>Flag</th>
                  <th>Signal</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "R-48291", score: 22, flag: "GPS spoof", signal: "VPN · 500m/min", decision: "Reject", decColor: "#A32D2D", flagColor: "adm-flag-red" },
                  { id: "R-39104", score: 38, flag: "High freq", signal: "9 claims/30d", decision: "Review", decColor: "#854F0B", flagColor: "adm-flag-ylw" },
                  { id: "R-72018", score: 85, flag: "Clear", signal: "All signals ok", decision: "Pay now", decColor: "#1D9E75", flagColor: "adm-flag-grn" },
                  { id: "R-55344", score: 18, flag: "Ring fraud", signal: "Subnet cluster · 50+", decision: "Hold", decColor: "#A32D2D", flagColor: "adm-flag-red" },
                ].map(r => (
                  <tr key={r.id}>
                    <td style={{ color: "var(--color-text-secondary)" }}>{r.id}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div className="adm-score-bar-wrap">
                          <div className="adm-score-bar" style={{ width: `${r.score}%`, background: r.score > 70 ? "#639922" : r.score > 40 ? "#EF9F27" : "#E24B4A" }} />
                        </div>
                        <span>{r.score}</span>
                      </div>
                    </td>
                    <td><span className={`adm-flag ${r.flagColor}`}>{r.flag}</span></td>
                    <td style={{ color: "var(--color-text-tertiary)" }}>{r.signal}</td>
                    <td style={{ fontWeight: 500, color: r.decColor }}>{r.decision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payout pipeline */}
          <div className="adm-card">
            <div className="adm-card-h">Payout Pipeline · Today</div>
            <div className="adm-payout-summary">
              {[
                { label: "Instant", amount: fmtInr(totalRiders >= 100 ? totalRiders * 600 : 82400), riders: totalRiders >= 100 ? totalRiders : 137, color: "#1D9E75" },
                { label: "Provisional", amount: "₹29,400", riders: 49, color: "#854F0B" },
                { label: "Held", amount: "₹18,600", riders: 31, color: "#A32D2D" },
              ].map(p => (
                <div key={p.label} className="adm-payout-box">
                  <div className="adm-payout-box-label">{p.label}</div>
                  <div className="adm-payout-box-amount" style={{ color: p.color }}>{p.amount}</div>
                  <div className="adm-payout-box-riders">{p.riders} riders</div>
                </div>
              ))}
            </div>
            <div className="adm-recent-label">Recent payouts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {payouts.slice(0, 4).map(p => (
                <div key={p.id} className="adm-payout-row">
                  <div className="adm-payout-dot" style={{ background: "#1D9E75" }} />
                  <div className="adm-payout-info">{p.zone_name}</div>
                  <div className="adm-payout-amount">{fmtInr(p.payout_amount_inr)}</div>
                  <div className="adm-payout-time">{fmtTime(p.event_time)}</div>
                </div>
              ))}
              {payouts.length === 0 && [
                { zone: "R-72018 · Koramangala", amount: "₹600", time: "2 min ago" },
                { zone: "R-81003 · Koramangala", amount: "₹600", time: "4 min ago" },
                { zone: "R-39104 · HSR Layout", amount: "₹400", time: "Under review" },
              ].map((p, i) => (
                <div key={i} className="adm-payout-row">
                  <div className="adm-payout-dot" style={{ background: i === 2 ? "#EF9F27" : "#1D9E75" }} />
                  <div className="adm-payout-info">{p.zone}</div>
                  <div className="adm-payout-amount">{p.amount}</div>
                  <div className="adm-payout-time">{p.time}</div>
                </div>
              ))}
            </div>

            {/* Zone health summary */}
            <div style={{ marginTop: 20 }}>
              <div className="adm-recent-label">Zone Health</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {zones.map(z => {
                  const color = z.dai < 0.4 ? "#A32D2D" : z.dai < 0.65 ? "#854F0B" : "#27500A";
                  const bg = z.dai < 0.4 ? "#FCEBEB" : z.dai < 0.65 ? "#FAEEDA" : "#EAF3DE";
                  return (
                    <div key={z.zone_name} style={{ background: bg, color, border: `0.5px solid ${bg}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 500 }}>
                      {z.zone_name} · {z.dai.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
        .adm { font-family:var(--font-sans); color:var(--color-text-primary); min-height:100vh; }
        .adm-header { padding:14px 24px; border-bottom:0.5px solid var(--color-border-tertiary); display:flex; align-items:center; gap:16px; background:var(--color-background-primary); flex-wrap:wrap; }
        .adm-logo { font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; }
        .adm-logo-dot { width:8px; height:8px; border-radius:50%; background:#1D9E75; }
        .adm-tabs { display:flex; gap:2px; margin-left:16px; }
        .adm-tab { font-size:13px; padding:6px 14px; border-radius:var(--border-radius-md); color:var(--color-text-secondary); cursor:pointer; border:none; background:transparent; font-family:var(--font-sans); transition:background .15s; }
        .adm-tab.active { background:var(--color-background-secondary); color:var(--color-text-primary); font-weight:500; }
        .adm-spacer { flex:1; }
        .adm-live { font-size:11px; font-weight:500; background:var(--color-safe-bg); color:#27500A; border-radius:10px; padding:4px 12px; display:flex; align-items:center; gap:6px; }
        .adm-pulse { width:6px; height:6px; border-radius:50%; background:#639922; animation:adm-pulse 1.5s ease-in-out infinite; flex-shrink:0; }
        @keyframes adm-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        .adm-back-link { font-size:12px; color:var(--color-brand); border:0.5px solid var(--color-brand); border-radius:var(--border-radius-md); padding:5px 10px; font-weight:500; transition:background .15s; }
        .adm-back-link:hover { background:#E1F5EE; }

        .adm-body { padding:20px 24px; background:var(--color-background-secondary); min-height:calc(100vh - 57px); }

        /* Top metrics */
        .adm-top-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:18px; }
        @media(max-width:1100px){ .adm-top-metrics { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:700px){ .adm-top-metrics { grid-template-columns:repeat(2,1fr); } }
        .adm-tm { background:var(--color-background-primary); border-radius:var(--border-radius-md); padding:14px 16px; border:0.5px solid var(--color-border-tertiary); }
        .adm-tm-label { font-size:10px; color:var(--color-text-tertiary); font-weight:500; letter-spacing:.04em; text-transform:uppercase; margin-bottom:6px; }
        .adm-tm-value { font-size:20px; font-weight:600; }
        .adm-tm-delta { font-size:11px; margin-top:3px; color:var(--color-text-tertiary); }
        .adm-up { color:#1D9E75; } .adm-dn { color:#E24B4A; }

        /* Grids */
        .adm-grid3 { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.2fr); gap:14px; margin-bottom:14px; }
        @media(max-width:1100px){ .adm-grid3 { grid-template-columns:1fr 1fr; } }
        @media(max-width:700px){ .adm-grid3 { grid-template-columns:1fr; } }
        .adm-grid2b { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; }
        @media(max-width:900px){ .adm-grid2b { grid-template-columns:1fr; } }

        /* Card */
        .adm-card { background:var(--color-background-primary); border:0.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); padding:16px 18px; }
        .adm-card-h { font-size:12px; font-weight:600; color:var(--color-text-primary); margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .adm-card-badge { font-size:10px; color:var(--color-text-tertiary); background:var(--color-background-secondary); border-radius:8px; padding:2px 8px; font-weight:400; white-space:nowrap; flex-shrink:0; }
        .adm-loading { font-size:12px; color:var(--color-text-tertiary); }

        /* Zone map */
        .adm-zone-map { height:175px; background:var(--color-background-secondary); border-radius:var(--border-radius-md); overflow:hidden; }
        .adm-zone-legend { display:flex; gap:10px; margin-top:8px; flex-wrap:wrap; }
        .adm-leg { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--color-text-tertiary); }
        .adm-leg-dot { width:8px; height:8px; border-radius:2px; flex-shrink:0; }

        /* Bar chart */
        .adm-bar-chart { display:flex; align-items:flex-end; gap:8px; height:100px; padding:0 4px; }
        .adm-bar-group { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
        .adm-bar { border-radius:3px 3px 0 0; width:100%; transition:opacity .15s; }
        .adm-bar:hover { opacity:.8; }
        .adm-bar-label { font-size:9px; color:var(--color-text-tertiary); }
        .adm-chart-note { margin-top:8px; font-size:10px; color:var(--color-text-tertiary); }

        /* ML predictions */
        .adm-pred-row { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:0.5px solid var(--color-border-tertiary); font-size:11px; }
        .adm-pred-row:last-child { border-bottom:none; }
        .adm-pred-zone { width:90px; font-weight:500; flex-shrink:0; font-size:11px; }
        .adm-pred-bar { flex:1; height:4px; background:var(--color-border-tertiary); border-radius:2px; overflow:hidden; }
        .adm-pred-fill { height:100%; border-radius:2px; transition:width .4s; }
        .adm-pred-pct { width:32px; text-align:right; font-size:11px; font-weight:500; flex-shrink:0; }

        /* Fraud table */
        .adm-ftable { width:100%; border-collapse:collapse; font-size:11px; }
        .adm-ftable th { font-size:9px; font-weight:500; color:var(--color-text-tertiary); text-align:left; padding:0 0 7px; letter-spacing:.05em; text-transform:uppercase; border-bottom:0.5px solid var(--color-border-tertiary); }
        .adm-ftable td { padding:7px 0; border-bottom:0.5px solid var(--color-border-tertiary); }
        .adm-ftable tr:last-child td { border-bottom:none; }
        .adm-score-bar-wrap { width:50px; height:3px; background:var(--color-border-tertiary); border-radius:2px; overflow:hidden; }
        .adm-score-bar { height:100%; border-radius:2px; }
        .adm-flag { display:inline-block; font-size:9px; font-weight:500; padding:1px 6px; border-radius:8px; }
        .adm-flag-red { background:#FCEBEB; color:#791F1F; }
        .adm-flag-grn { background:#EAF3DE; color:#27500A; }
        .adm-flag-ylw { background:#FAEEDA; color:#633806; }

        /* Payout pipeline */
        .adm-payout-summary { display:flex; gap:8px; margin-bottom:16px; }
        .adm-payout-box { flex:1; background:var(--color-background-secondary); border-radius:var(--border-radius-md); padding:10px 12px; }
        .adm-payout-box-label { font-size:10px; color:var(--color-text-tertiary); margin-bottom:4px; }
        .adm-payout-box-amount { font-size:17px; font-weight:600; }
        .adm-payout-box-riders { font-size:10px; color:var(--color-text-tertiary); }
        .adm-recent-label { font-size:11px; font-weight:500; color:var(--color-text-secondary); margin-bottom:8px; }
        .adm-payout-row { display:flex; align-items:center; gap:8px; font-size:11px; }
        .adm-payout-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .adm-payout-info { flex:1; color:var(--color-text-secondary); }
        .adm-payout-amount { font-weight:500; }
        .adm-payout-time { font-size:10px; color:var(--color-text-tertiary); flex-shrink:0; }
      `}</style>
    </div>
  );
}
