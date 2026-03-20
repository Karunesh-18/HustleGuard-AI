"use client";

import Link from "next/link";
import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";

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

type RiderOnboardRead = {
  id: number;
  name: string;
  email: string;
  city: string;
  home_zone: string;
  reliability_score: number;
  created_at: string;
};

type SubscriptionRead = {
  id: number;
  rider_id: number;
  plan_name: string;
  weekly_premium: number;
  active: boolean;
  created_at: string;
};

type HealthRead = {
  status: string;
  database_ready: boolean;
  database_error: string | null;
  database_backend: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function zoneStatus(dai: number): "danger" | "warning" | "safe" {
  if (dai < 0.4) return "danger";
  if (dai < 0.65) return "warning";
  return "safe";
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icons = {
  grid: (
    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm0 1.5a.75.75 0 00-.75.75v3.5c0 .41.34.75.75.75h2.5a.75.75 0 000-1.5H8.75V5.25A.75.75 0 008 4.5z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
      <path d="M3 2h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm0 3v7h10V5H3zm1 2h4v1H4V7zm0 2h8v1H4V9z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
      <path d="M8 1L14 4v4c0 3.5-2.5 6-6 7C2.5 14 0 11.5 0 8V4l8-3z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 15, height: 15 }}>
      <path d="M2 12l3-4 3.5 3 2.5-4 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
      <path d="M2 2h3v12H2zm4.5 4h3v8H6.5zM11 6h3v8h-3z" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
      <path d="M13.7 6A6 6 0 108 2a6 6 0 00-4.2 1.7" strokeLinecap="round" />
      <path d="M1 1v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 16 16" fill="white" style={{ width: 16, height: 16 }}>
      <path d="M8 1L10.5 6H13.5L11 9.5L12 14L8 11.5L4 14L5 9.5L2.5 6H5.5Z" />
    </svg>
  ),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RiderDashboard() {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [payoutEvents, setPayoutEvents] = useState<PayoutEventRead[]>([]);
  const [health, setHealth] = useState<HealthRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState("Dashboard");

  // Onboarding
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Bangalore");
  const [homeZone, setHomeZone] = useState("Koramangala");
  const [onboardStatus, setOnboardStatus] = useState("");
  const [createdRider, setCreatedRider] = useState<RiderOnboardRead | null>(null);

  // Subscription
  const [planName, setPlanName] = useState("Weekly Shield");
  const [subStatus, setSubStatus] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionRead | null>(null);

  // Derived
  const worstZone = useMemo(
    () => (zones.length ? [...zones].sort((a, b) => a.dai - b.dai)[0] : null),
    [zones]
  );
  const selectedZone = worstZone ?? zones[0] ?? null;

  const refreshLiveData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [zonesRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/zones/live-data`, { cache: "no-store" }),
        fetch(`${API_BASE}/payouts/recent`, { cache: "no-store" }),
      ]);
      if (!zonesRes.ok || !payoutsRes.ok) throw new Error("Failed to load live data.");
      setZones((await zonesRes.json()) as ZoneLiveData[]);
      setPayoutEvents((await payoutsRes.json()) as PayoutEventRead[]);
    } catch {
      setApiError("Unable to load live data — make sure backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLiveData();
    void checkHealth();
    // Auto-refresh every 60s
    const timer = setInterval(() => void refreshLiveData(), 60_000);
    return () => clearInterval(timer);
  }, [refreshLiveData]);

  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (res.ok) setHealth((await res.json()) as HealthRead);
    } catch { /* silent */ }
  }

  async function handleOnboard(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setOnboardStatus("Onboarding rider…");
    try {
      const res = await fetch(`${API_BASE}/riders/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, city, home_zone: homeZone }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? "Onboarding failed.");
      const rider = (await res.json()) as RiderOnboardRead;
      setCreatedRider(rider);
      setOnboardStatus(`✓ Rider onboarded — ID: ${rider.id}`);
      setSubscription(null);
      setSubStatus("");
    } catch (err) {
      setOnboardStatus(err instanceof Error ? err.message : "Onboarding failed.");
    }
  }

  async function handleSubscribe(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createdRider) { setSubStatus("Onboard a rider first."); return; }
    setSubStatus("Activating subscription…");
    try {
      const res = await fetch(`${API_BASE}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: createdRider.id, plan_name: planName }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? "Subscription failed.");
      const sub = (await res.json()) as SubscriptionRead;
      setSubscription(sub);
      setSubStatus("✓ Subscription activated!");
    } catch (err) {
      setSubStatus(err instanceof Error ? err.message : "Subscription failed.");
    }
  }

  return (
    <div className="hg-app">
      {/* ── Sidebar ── */}
      <aside className="hg-sidebar">
        <div className="hg-sidebar-logo">
          <div className="hg-logo-mark">
            <div className="hg-logo-icon">{Icons.star}</div>
            <div>
              <div className="hg-logo-text">HustleGuard</div>
              <div className="hg-logo-sub">AI Insurance</div>
            </div>
          </div>
        </div>

        <nav className="hg-nav">
          <div className="hg-nav-section">Platform</div>
          {[
            { label: "Dashboard", icon: Icons.grid },
            { label: "Live Alerts", icon: Icons.bell, badge: apiError ? "!" : loading ? "…" : zones.filter(z => z.dai < 0.4).length || undefined },
            { label: "Claims", icon: Icons.list },
            { label: "Payouts", icon: Icons.shield },
          ].map(({ label, icon, badge }) => (
            <button
              key={label}
              className={`hg-nav-item${activeNavItem === label ? " active" : ""}`}
              onClick={() => setActiveNavItem(label)}
              type="button"
            >
              {icon}
              {label}
              {badge ? <span className="hg-nav-badge">{badge}</span> : null}
            </button>
          ))}
          <div className="hg-nav-section" style={{ marginTop: 8 }}>Analytics</div>
          {[
            { label: "Zone Heatmap", icon: Icons.chart },
            { label: "Risk Analytics", icon: Icons.bars },
          ].map(({ label, icon }) => (
            <button
              key={label}
              className={`hg-nav-item${activeNavItem === label ? " active" : ""}`}
              onClick={() => setActiveNavItem(label)}
              type="button"
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        <div className="hg-sidebar-footer">
          <div className="hg-rider-pill">
            <div className="hg-avatar">{createdRider ? createdRider.name.slice(0, 2).toUpperCase() : "AK"}</div>
            <div className="hg-rider-info">
              <div className="hg-rider-name">{createdRider?.name ?? "Arjun Kumar"}</div>
              <div className="hg-rider-plan">{subscription ? `${subscription.plan_name} · Active` : "No active plan"}</div>
            </div>
            <div className="hg-status-dot" />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="hg-main">
        {/* Topbar */}
        <div className="hg-topbar">
          <div className="hg-topbar-title">Rider Dashboard</div>
          <div className="hg-topbar-meta">
            Bangalore · Zone: {selectedZone?.zone_name ?? "–"}
          </div>
          {health && (
            <div className="hg-api-status">
              <div className={`hg-api-dot ${health.database_ready ? "ok" : "err"}`} />
              {health.database_ready ? "API Connected" : "DB Offline"}
            </div>
          )}
          {selectedZone && zoneStatus(selectedZone.dai) !== "safe" && (
            <div className="hg-alert-banner">
              <div className="hg-alert-dot" />
              {selectedZone.dai < 0.4
                ? `Heavy disruption alert — ${selectedZone.zone_name}`
                : `Moderate risk — ${selectedZone.zone_name}`}
            </div>
          )}
          <button type="button" className="hg-refresh-btn" onClick={() => void refreshLiveData()}>
            {Icons.refresh}
          </button>
          <Link href="/admin" className="hg-admin-link">Admin →</Link>
        </div>

        <div className="hg-content">
          {/* Error banner */}
          {apiError && (
            <div className="hg-error-banner">
              ⚠ {apiError}
            </div>
          )}

          {/* Zone strip */}
          {loading ? (
            <div className="hg-zone-strip">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="hg-zone-pill hg-skeleton" style={{ height: 68 }} />
              ))}
            </div>
          ) : (
            <div className="hg-zone-strip">
              {zones.map(z => {
                const st = zoneStatus(z.dai);
                return (
                  <div key={z.zone_name} className={`hg-zone-pill ${st}`}>
                    <div className="hg-zone-name">{z.zone_name}</div>
                    <div className="hg-zone-dai">{z.dai.toFixed(2)}</div>
                    <div className="hg-zone-label">
                      DAI · {st === "danger" ? "Disrupted" : st === "warning" ? "Moderate" : "Normal"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Metric cards */}
          <div className="hg-metrics">
            <div className="hg-metric">
              <div className="hg-metric-label">Weekly Premium</div>
              <div className="hg-metric-value">{subscription ? fmtInr(subscription.weekly_premium) : "₹32"}</div>
              <div className="hg-metric-sub">{subscription ? "Active coverage" : "Estimated"}</div>
            </div>
            <div className="hg-metric">
              <div className="hg-metric-label">Protected Earnings</div>
              <div className="hg-metric-value">₹4,800</div>
              <div className="hg-metric-sub"><span className="hg-up">↑ 12%</span> vs last week</div>
            </div>
            <div className="hg-metric">
              <div className="hg-metric-label">Claims This Month</div>
              <div className="hg-metric-value">{payoutEvents.length}</div>
              <div className="hg-metric-sub">
                {fmtInr(payoutEvents.reduce((s, p) => s + p.payout_amount_inr, 0))} paid out
              </div>
            </div>
            <div className="hg-metric">
              <div className="hg-metric-label">Fraud Trust Score</div>
              <div className="hg-metric-value">{createdRider?.reliability_score ?? 84}</div>
              <div className="hg-metric-sub"><span className="hg-up">Instant payout</span> eligible</div>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="hg-grid2">
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* DAI chart */}
              <div className="hg-card">
                <div className="hg-card-title">
                  Delivery Activity Index — Today
                  <span className="hg-card-tag">Live</span>
                </div>
                <div className="hg-dai-chart">
                  <svg viewBox="0 0 480 110" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#1D9E75" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="22" x2="480" y2="22" stroke="var(--color-border-tertiary)" strokeWidth="0.5" />
                    <line x1="0" y1="55" x2="480" y2="55" stroke="var(--color-border-tertiary)" strokeWidth="0.5" />
                    <line x1="0" y1="88" x2="480" y2="88" stroke="var(--color-border-tertiary)" strokeWidth="0.5" />
                    {/* Trigger threshold at DAI=0.4 (y≈72 in 0–1 scale mapped to 0–110 inverted) */}
                    <line x1="0" y1="72" x2="480" y2="72" stroke="#E24B4A" strokeWidth="0.75" strokeDasharray="4 3" opacity="0.7" />
                    <text x="472" y="70" fontSize="8" fill="#A32D2D" textAnchor="end" opacity="0.9">trigger 0.4</text>
                    <path d="M0 55 C30 50 60 40 90 38 S140 35 160 38 S200 45 230 60 S270 80 300 85 S350 88 380 86 S440 82 480 75 L480 110 L0 110 Z" fill="url(#g1)" />
                    <path d="M0 55 C30 50 60 40 90 38 S140 35 160 38 S200 45 230 60 S270 80 300 85 S350 88 380 86 S440 82 480 75" fill="none" stroke="#1D9E75" strokeWidth="1.75" strokeLinecap="round" />
                    <path d="M230 60 S270 80 300 85 S330 87 350 88" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round" />
                    <text x="0" y="108" fontSize="9" fill="var(--color-text-tertiary)">06:00</text>
                    <text x="110" y="108" fontSize="9" fill="var(--color-text-tertiary)">10:00</text>
                    <text x="225" y="108" fontSize="9" fill="var(--color-text-tertiary)">14:00</text>
                    <text x="345" y="108" fontSize="9" fill="var(--color-text-tertiary)">18:00</text>
                    <text x="445" y="108" fontSize="9" fill="var(--color-text-tertiary)">22:00</text>
                    <circle cx="480" cy="75" r="3.5" fill="#E24B4A" />
                    <circle cx="480" cy="75" r="7" fill="#E24B4A" opacity="0.2" />
                  </svg>
                </div>
              </div>

              {/* Recent claims / payout events */}
              <div className="hg-card">
                <div className="hg-card-title">Recent Claims & Payouts</div>
                {payoutEvents.length === 0 && !loading ? (
                  <p style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>No payout events yet.</p>
                ) : (
                  <table className="hg-claims-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Trigger</th>
                        <th>Amount</th>
                        <th>Riders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutEvents.map(p => (
                        <tr key={p.id}>
                          <td style={{ color: "var(--color-text-secondary)" }}>{fmtTime(p.event_time)}</td>
                          <td>{p.trigger_reason}</td>
                          <td style={{ fontWeight: 500 }}>{fmtInr(p.payout_amount_inr)}</td>
                          <td>
                            <span className="hg-badge hg-badge-approved">{p.eligible_riders}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Onboarding forms */}
              <div className="hg-card">
                <div className="hg-card-title">Rider Onboarding</div>
                <form onSubmit={handleOnboard} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {[
                    { placeholder: "Rider Name", value: name, onChange: setName, type: "text" },
                    { placeholder: "Email", value: email, onChange: setEmail, type: "email" },
                    { placeholder: "City", value: city, onChange: setCity, type: "text" },
                    { placeholder: "Home Zone", value: homeZone, onChange: setHomeZone, type: "text" },
                  ].map(f => (
                    <input
                      key={f.placeholder}
                      className="hg-input"
                      type={f.type}
                      placeholder={f.placeholder}
                      value={f.value}
                      onChange={e => f.onChange(e.target.value)}
                      required
                    />
                  ))}
                  <button type="submit" className="hg-btn-primary">Onboard Rider</button>
                </form>
                {onboardStatus && <p className="hg-form-status">{onboardStatus}</p>}
              </div>

              {/* Subscription form */}
              <div className="hg-card">
                <div className="hg-card-title">Insurance Subscription</div>
                <form onSubmit={handleSubscribe} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  <input
                    className="hg-input"
                    type="text"
                    placeholder="Plan Name"
                    value={planName}
                    onChange={e => setPlanName(e.target.value)}
                    required
                  />
                  <button type="submit" className="hg-btn-secondary" disabled={!createdRider}>
                    Activate Subscription
                  </button>
                </form>
                {subStatus && <p className="hg-form-status">{subStatus}</p>}
                {subscription && (
                  <div className="hg-sub-active">
                    {subscription.plan_name} · {fmtInr(subscription.weekly_premium)}/week
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Premium card */}
              <div className="hg-premium-card">
                <div className="hg-premium-badge">
                  {subscription?.plan_name ?? "Weekly Shield Plan"}
                </div>
                <div className="hg-premium-amount">
                  {subscription ? fmtInr(subscription.weekly_premium) : "₹32"}
                  <span style={{ fontSize: 14, opacity: 0.6 }}> /week</span>
                </div>
                <div className="hg-premium-period">
                  Coverage: Mar 18 – 24, 2026
                </div>
                <div className="hg-premium-divider" />
                <div className="hg-premium-row"><span>Max payout / event</span><strong>₹600</strong></div>
                <div className="hg-premium-row">
                  <span>Risk zone</span>
                  <strong>{selectedZone ? (zoneStatus(selectedZone.dai) === "danger" ? "High" : zoneStatus(selectedZone.dai) === "warning" ? "Medium" : "Low") : "–"}</strong>
                </div>
                <div className="hg-premium-row">
                  <span>AI risk score</span>
                  <strong>{createdRider?.reliability_score ?? 84}/100</strong>
                </div>
                <div className="hg-payout-btn">Claim triggered automatically</div>
              </div>

              {/* Parametric triggers */}
              <div className="hg-card">
                <div className="hg-card-title">Parametric Triggers</div>
                <div className="hg-triggers">
                  {[
                    {
                      icon: "🌧",
                      name: "Rainfall",
                      val: selectedZone ? `${selectedZone.rainfall_mm.toFixed(0)}mm · threshold >80mm` : "–",
                      status: selectedZone && selectedZone.rainfall_mm > 80 ? "fire" : selectedZone && selectedZone.rainfall_mm > 50 ? "warn" : "ok",
                      bg: "#FAECE7",
                    },
                    {
                      icon: "📊",
                      name: "DAI Index",
                      val: selectedZone ? `${selectedZone.dai.toFixed(2)} · threshold <0.40` : "–",
                      status: selectedZone && selectedZone.dai < 0.4 ? "fire" : selectedZone && selectedZone.dai < 0.65 ? "warn" : "ok",
                      bg: "#E1F5EE",
                    },
                    {
                      icon: "💨",
                      name: "AQI Level",
                      val: selectedZone ? `${selectedZone.aqi} · threshold >300` : "–",
                      status: selectedZone && selectedZone.aqi > 300 ? "fire" : selectedZone && selectedZone.aqi > 200 ? "warn" : "ok",
                      bg: "#FAEEDA",
                    },
                    {
                      icon: "🚦",
                      name: "Traffic Index",
                      val: selectedZone ? `${selectedZone.traffic_index} · threshold <25` : "–",
                      status: selectedZone && selectedZone.traffic_index < 25 ? "fire" : selectedZone && selectedZone.traffic_index < 40 ? "warn" : "ok",
                      bg: "#E6F1FB",
                    },
                  ].map(t => (
                    <div key={t.name} className="hg-trigger-row">
                      <div className="hg-trigger-icon" style={{ background: t.bg }}>{t.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div className="hg-trigger-name">{t.name}</div>
                        <div className="hg-trigger-val">{t.val}</div>
                      </div>
                      <div className={`hg-trigger-status ts-${t.status}`}>
                        {t.status === "fire" ? "Active" : t.status === "warn" ? "Warning" : "Normal"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zone detail */}
              {selectedZone && (
                <div className="hg-card">
                  <div className="hg-card-title">Zone Conditions — {selectedZone.zone_name}</div>
                  <div className="hg-signals">
                    {[
                      { name: "Workability", value: selectedZone.workability_score, max: 100, color: selectedZone.workability_score < 50 ? "#E24B4A" : selectedZone.workability_score < 80 ? "#EF9F27" : "#1D9E75" },
                      { name: "Rainfall mm", value: Math.min(selectedZone.rainfall_mm, 120), max: 120, color: selectedZone.rainfall_mm > 80 ? "#E24B4A" : "#1D9E75" },
                      { name: "AQI", value: Math.min(selectedZone.aqi, 500), max: 500, color: selectedZone.aqi > 300 ? "#E24B4A" : selectedZone.aqi > 150 ? "#EF9F27" : "#1D9E75" },
                      { name: "Traffic idx", value: selectedZone.traffic_index, max: 100, color: "#1D9E75" },
                    ].map(s => (
                      <div key={s.name} className="hg-signal-row">
                        <div className="hg-signal-name">{s.name}</div>
                        <div className="hg-signal-bar-wrap">
                          <div className="hg-signal-bar" style={{ width: `${(s.value / s.max) * 100}%`, background: s.color }} />
                        </div>
                        <div className="hg-signal-val">{Math.round(s.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Styles ── */}
      <style>{`
        .hg-app { display:flex; height:100vh; min-height:600px; font-family:var(--font-sans); }
        
        /* Sidebar */
        .hg-sidebar { width:220px; flex-shrink:0; background:var(--color-background-secondary); border-right:0.5px solid var(--color-border-tertiary); display:flex; flex-direction:column; }
        .hg-sidebar-logo { padding:20px 20px 16px; border-bottom:0.5px solid var(--color-border-tertiary); }
        .hg-logo-mark { display:flex; align-items:center; gap:8px; }
        .hg-logo-icon { width:28px; height:28px; background:#1D9E75; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .hg-logo-text { font-size:15px; font-weight:600; color:var(--color-text-primary); }
        .hg-logo-sub { font-size:10px; color:var(--color-text-tertiary); margin-top:1px; letter-spacing:.05em; text-transform:uppercase; }
        .hg-nav { padding:12px 8px; flex:1; }
        .hg-nav-section { font-size:10px; font-weight:500; color:var(--color-text-tertiary); letter-spacing:.08em; text-transform:uppercase; padding:8px 12px 4px; }
        .hg-nav-item { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:var(--border-radius-md); font-size:13px; color:var(--color-text-secondary); cursor:pointer; width:100%; border:none; background:transparent; transition:background .15s; margin:1px 0; text-align:left; }
        .hg-nav-item:hover { background:var(--color-background-primary); color:var(--color-text-primary); }
        .hg-nav-item.active { background:var(--color-background-primary); color:var(--color-text-primary); font-weight:500; border:0.5px solid var(--color-border-secondary); }
        .hg-nav-badge { margin-left:auto; background:#1D9E75; color:white; font-size:10px; font-weight:500; padding:1px 6px; border-radius:10px; }
        .hg-sidebar-footer { padding:12px 8px; border-top:0.5px solid var(--color-border-tertiary); }
        .hg-rider-pill { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:var(--border-radius-md); cursor:pointer; }
        .hg-rider-pill:hover { background:var(--color-background-primary); }
        .hg-avatar { width:28px; height:28px; border-radius:50%; background:#9FE1CB; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:500; color:#085041; flex-shrink:0; }
        .hg-rider-info { flex:1; min-width:0; }
        .hg-rider-name { font-size:12px; font-weight:500; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hg-rider-plan { font-size:11px; color:var(--color-text-tertiary); }
        .hg-status-dot { width:7px; height:7px; border-radius:50%; background:#1D9E75; flex-shrink:0; }
        
        /* Main */
        .hg-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .hg-topbar { padding:13px 24px; border-bottom:0.5px solid var(--color-border-tertiary); display:flex; align-items:center; gap:10px; background:var(--color-background-primary); flex-wrap:wrap; }
        .hg-topbar-title { font-size:15px; font-weight:600; flex:1; }
        .hg-topbar-meta { font-size:12px; color:var(--color-text-tertiary); }
        .hg-api-status { font-size:11px; color:var(--color-text-tertiary); display:flex; align-items:center; gap:5px; }
        .hg-api-dot { width:6px; height:6px; border-radius:50%; }
        .hg-api-dot.ok { background:#1D9E75; }
        .hg-api-dot.err { background:#E24B4A; }
        .hg-alert-banner { background:#FAC775; border:0.5px solid #EF9F27; border-radius:var(--border-radius-md); padding:6px 12px; font-size:12px; color:#412402; display:flex; align-items:center; gap:6px; }
        .hg-alert-dot { width:6px; height:6px; border-radius:50%; background:#BA7517; flex-shrink:0; }
        .hg-refresh-btn { border:0.5px solid var(--color-border-secondary); background:transparent; border-radius:var(--border-radius-md); padding:5px 8px; display:flex; align-items:center; color:var(--color-text-secondary); transition:border-color .15s; }
        .hg-refresh-btn:hover { border-color:var(--color-brand); color:var(--color-brand); }
        .hg-admin-link { font-size:12px; font-weight:500; color:var(--color-brand); border:0.5px solid var(--color-brand); border-radius:var(--border-radius-md); padding:5px 10px; transition:background .15s; }
        .hg-admin-link:hover { background:#E1F5EE; }

        .hg-content { flex:1; overflow-y:auto; padding:20px 24px; }
        .hg-error-banner { background:var(--color-danger-bg); border:0.5px solid var(--color-danger); border-radius:var(--border-radius-md); padding:10px 14px; font-size:12px; color:var(--color-danger-dark); margin-bottom:16px; }

        /* Zone strip */
        .hg-zone-strip { display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
        .hg-zone-pill { flex:1; min-width:120px; padding:10px 12px; border-radius:var(--border-radius-md); border:0.5px solid var(--color-border-tertiary); background:var(--color-background-primary); cursor:pointer; transition:border-color .15s,transform .1s; }
        .hg-zone-pill:hover { transform:translateY(-1px); }
        .hg-zone-pill.danger { border-color:#E24B4A; background:#FCEBEB; }
        .hg-zone-pill.warning { border-color:#EF9F27; background:#FAEEDA; }
        .hg-zone-pill.safe { border-color:#639922; background:#EAF3DE; }
        .hg-zone-name { font-size:11px; font-weight:500; color:var(--color-text-secondary); }
        .hg-zone-pill.danger .hg-zone-name { color:#791F1F; }
        .hg-zone-pill.warning .hg-zone-name { color:#633806; }
        .hg-zone-pill.safe .hg-zone-name { color:#27500A; }
        .hg-zone-dai { font-size:18px; font-weight:500; margin-top:2px; }
        .hg-zone-pill.danger .hg-zone-dai { color:#A32D2D; }
        .hg-zone-pill.warning .hg-zone-dai { color:#854F0B; }
        .hg-zone-pill.safe .hg-zone-dai { color:#3B6D11; }
        .hg-zone-label { font-size:10px; color:var(--color-text-tertiary); margin-top:2px; }

        /* Metrics */
        .hg-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px; }
        @media(max-width:900px){ .hg-metrics { grid-template-columns:repeat(2,1fr); } }
        .hg-metric { background:var(--color-background-secondary); border-radius:var(--border-radius-md); padding:14px 16px; border:0.5px solid var(--color-border-tertiary); }
        .hg-metric-label { font-size:11px; color:var(--color-text-tertiary); font-weight:500; letter-spacing:.02em; margin-bottom:6px; }
        .hg-metric-value { font-size:22px; font-weight:600; color:var(--color-text-primary); }
        .hg-metric-sub { font-size:11px; color:var(--color-text-tertiary); margin-top:4px; }
        .hg-up { color:#1D9E75; }

        /* Grid */
        .hg-grid2 { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:16px; margin-bottom:16px; }
        @media(max-width:1100px){ .hg-grid2 { grid-template-columns:1fr; } }

        /* Card */
        .hg-card { background:var(--color-background-primary); border:0.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); padding:16px 18px; }
        .hg-card-title { font-size:13px; font-weight:600; color:var(--color-text-primary); margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; }
        .hg-card-tag { font-size:10px; color:var(--color-text-tertiary); border:0.5px solid var(--color-border-tertiary); border-radius:10px; padding:2px 8px; font-weight:400; }

        /* DAI chart */
        .hg-dai-chart { height:115px; }
        .hg-dai-chart svg { width:100%; height:100%; }

        /* Claims table */
        .hg-claims-table { width:100%; border-collapse:collapse; font-size:12px; }
        .hg-claims-table th { font-size:10px; font-weight:500; color:var(--color-text-tertiary); text-align:left; padding:0 0 8px; letter-spacing:.04em; text-transform:uppercase; border-bottom:0.5px solid var(--color-border-tertiary); }
        .hg-claims-table td { padding:8px 0; border-bottom:0.5px solid var(--color-border-tertiary); vertical-align:middle; }
        .hg-claims-table tr:last-child td { border-bottom:none; }
        .hg-badge { display:inline-flex; align-items:center; font-size:10px; font-weight:500; padding:2px 8px; border-radius:10px; }
        .hg-badge-approved { background:var(--color-safe-bg); color:#27500A; }
        .hg-badge-review { background:var(--color-warning-bg); color:#633806; }

        /* Premium card */
        .hg-premium-card { background:#085041; border-radius:var(--border-radius-lg); padding:18px 18px; color:white; position:relative; overflow:hidden; }
        .hg-premium-card::before { content:''; position:absolute; top:-30px; right:-30px; width:120px; height:120px; border-radius:50%; background:rgba(255,255,255,0.06); }
        .hg-premium-card::after { content:''; position:absolute; bottom:-20px; left:-20px; width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,0.04); }
        .hg-premium-badge { display:inline-block; font-size:9px; font-weight:600; background:rgba(255,255,255,0.15); border-radius:10px; padding:2px 10px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px; }
        .hg-premium-amount { font-size:30px; font-weight:700; margin:4px 0; }
        .hg-premium-period { font-size:12px; opacity:0.65; }
        .hg-premium-divider { height:0.5px; background:rgba(255,255,255,0.2); margin:12px 0; }
        .hg-premium-row { display:flex; justify-content:space-between; font-size:11px; opacity:0.8; margin-bottom:5px; }
        .hg-premium-row strong { opacity:1; font-weight:600; }
        .hg-payout-btn { margin-top:14px; background:rgba(255,255,255,0.15); color:white; border:0.5px solid rgba(255,255,255,0.3); border-radius:var(--border-radius-md); padding:9px; font-size:12px; font-weight:500; text-align:center; transition:background .15s; cursor:pointer; }
        .hg-payout-btn:hover { background:rgba(255,255,255,0.25); }

        /* Triggers */
        .hg-triggers { display:flex; flex-direction:column; gap:8px; margin-top:4px; }
        .hg-trigger-row { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:var(--border-radius-md); background:var(--color-background-secondary); font-size:12px; }
        .hg-trigger-icon { width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:15px; }
        .hg-trigger-name { font-weight:500; color:var(--color-text-primary); font-size:12px; }
        .hg-trigger-val { font-size:11px; color:var(--color-text-secondary); }
        .hg-trigger-status { font-size:10px; font-weight:500; padding:2px 8px; border-radius:10px; flex-shrink:0; }
        .ts-ok { background:var(--color-safe-bg); color:#27500A; }
        .ts-warn { background:var(--color-warning-bg); color:#633806; }
        .ts-fire { background:var(--color-danger-bg); color:#791F1F; }

        /* Signals */
        .hg-signals { display:flex; flex-direction:column; gap:8px; }
        .hg-signal-row { display:flex; align-items:center; gap:8px; font-size:11px; }
        .hg-signal-name { color:var(--color-text-secondary); width:80px; flex-shrink:0; }
        .hg-signal-bar-wrap { flex:1; height:4px; background:var(--color-border-tertiary); border-radius:2px; overflow:hidden; }
        .hg-signal-bar { height:100%; border-radius:2px; transition:width .4s; }
        .hg-signal-val { color:var(--color-text-tertiary); font-size:10px; min-width:28px; text-align:right; }

        /* Forms */
        .hg-input { width:100%; border:0.5px solid var(--color-border-secondary); border-radius:var(--border-radius-md); background:var(--color-background-secondary); padding:8px 12px; font-size:13px; color:var(--color-text-primary); font-family:var(--font-sans); outline:none; transition:border-color .15s; }
        .hg-input:focus { border-color:var(--color-brand); }
        .hg-btn-primary { background:#1D9E75; color:white; border:none; border-radius:var(--border-radius-md); padding:9px 16px; font-size:13px; font-weight:600; transition:background .15s; }
        .hg-btn-primary:hover { background:#0D7A5A; }
        .hg-btn-secondary { background:var(--color-brand-muted); color:#085041; border:none; border-radius:var(--border-radius-md); padding:9px 16px; font-size:13px; font-weight:600; transition:background .15s; }
        .hg-btn-secondary:disabled { opacity:0.5; cursor:not-allowed; }
        .hg-form-status { font-size:12px; color:var(--color-text-secondary); margin-top:8px; }
        .hg-sub-active { margin-top:10px; background:var(--color-brand-muted); color:#085041; border-radius:var(--border-radius-md); padding:10px 12px; font-size:12px; font-weight:500; }
        
        /* Skeleton */
        .hg-skeleton { background: linear-gradient(90deg, var(--color-background-elevated) 0%, var(--color-background-secondary) 50%, var(--color-background-elevated) 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--border-radius-md); }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </div>
  );
}
