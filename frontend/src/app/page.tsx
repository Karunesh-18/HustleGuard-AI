"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { useLiveData } from "@/hooks/useLiveData";
import { useRider } from "@/hooks/useRider";
import { useHealth } from "@/hooks/useHealth";
import { getPolicies } from "@/lib/api";
import { fmtTime, fmtInr } from "@/lib/formatters";

import { ZoneStrip } from "@/components/zones/ZoneStrip";
import { ZoneSignals } from "@/components/zones/ZoneSignals";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { DAIChart } from "@/components/dashboard/DAIChart";
import { TriggerList } from "@/components/dashboard/TriggerList";
import { PremiumCard } from "@/components/dashboard/PremiumCard";
import { PolicyPicker } from "@/components/dashboard/PolicyPicker";
import { ManualDistressPanel } from "@/components/claims/ManualDistressPanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ToastStack } from "@/components/shared/Toast";
import { EmptyState } from "@/components/shared/EmptyState";

import type { PolicyRead, ZoneLiveData } from "@/types";

type Tab = "Dashboard" | "Alerts" | "Claims" | "Coverage" | "Onboarding";

const NAV: { tab: Tab; icon: string; label: string }[] = [
  { tab: "Dashboard", icon: "📊", label: "Dashboard" },
  { tab: "Alerts", icon: "⚡", label: "Live Alerts" },
  { tab: "Claims", icon: "🛡", label: "My Claims" },
  { tab: "Coverage", icon: "📋", label: "Coverage" },
  { tab: "Onboarding", icon: "👤", label: "Profile" },
];

export default function RiderDashboard() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [selectedZoneName, setSelectedZoneName] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyRead[]>([]);
  const [liveTime, setLiveTime] = useState("--:--:--");
  const [distressMsg, setDistressMsg] = useState<string | null>(null);

  const { zones, payouts, loading, error, refresh, disruptedCount, totalPayout, toasts, dismissToast } = useLiveData();
  const { rider, policy, onboard, subscribe, loading: riderLoading } = useRider();
  const { status: apiStatus } = useHealth();

  // Resolved selected zone object
  const selectedZone: ZoneLiveData | null =
    zones.find((z) => z.zone_name === selectedZoneName) ??
    (zones.length > 0 ? zones.sort((a, b) => a.dai - b.dai)[0] : null);

  const isDisrupted = selectedZone ? selectedZone.dai < 0.4 : false;

  // Auto-select worst zone on first load
  useEffect(() => {
    if (!selectedZoneName && zones.length > 0) {
      setSelectedZoneName([...zones].sort((a, b) => a.dai - b.dai)[0].zone_name);
    }
  }, [zones, selectedZoneName]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load policies on coverage tab
  useEffect(() => {
    if (tab === "Coverage" && policies.length === 0) {
      getPolicies().then(setPolicies).catch(() => {});
    }
  }, [tab, policies.length]);

  const apiLabel = apiStatus === "ok" ? "API Online" : apiStatus === "db-offline" ? "DB Offline" : "API Unreachable";
  const initials = rider?.name?.slice(0, 2).toUpperCase() ?? "—";

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">🛡️</div>
          <div>
            <div className="logo-text">HustleGuard</div>
            <div className="logo-sub">AI Insurance</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">Rider</div>
          {NAV.map(({ tab: t, icon, label }) => (
            <button
              key={t}
              className={`nav-item${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
              type="button"
              id={`nav-${t.toLowerCase()}`}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {t === "Alerts" && disruptedCount > 0 && (
                <span className="nav-badge">{disruptedCount}</span>
              )}
            </button>
          ))}

          <div className="nav-section" style={{ marginTop: 16 }}>Admin</div>
          <Link href="/admin" className="nav-item">
            <span className="nav-icon">⚙️</span>
            Admin Panel
          </Link>
        </nav>

        <div className="sidebar-footer">
          {rider ? (
            <div className="rider-pill" onClick={() => setTab("Onboarding")} role="button">
              <div className="avatar">{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rider-name">{rider.name}</div>
                <div className="rider-plan">{policy?.policy_name ?? "No plan"}</div>
              </div>
              <div className="rider-status-dot" />
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setTab("Onboarding")} type="button" style={{ width: "100%", fontSize: 12 }}>
              Create Profile
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">
            {tab === "Dashboard" && "Zone Dashboard"}
            {tab === "Alerts" && "Live Disruption Alerts"}
            {tab === "Claims" && "My Claims"}
            {tab === "Coverage" && "Insurance Coverage"}
            {tab === "Onboarding" && "Rider Profile"}
          </div>
          <div className="topbar-meta">{liveTime}</div>
          <div className="api-status" title={apiLabel}>
            <div className={`api-dot ${apiStatus}`} />
            {apiLabel}
          </div>
          <button
            className="topbar-btn"
            onClick={() => void refresh()}
            type="button"
            title="Refresh live data"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Page content */}
        <div className="page-content">
          {error && <div className="error-banner">⚠ {error}</div>}

          {/* ─ Dashboard Tab ─ */}
          {tab === "Dashboard" && (
            <>
              <MetricCards
                zones={zones}
                totalPayout={totalPayout}
                payoutCount={payouts.length}
                riderReliability={rider?.reliability_score}
              />
              <ZoneStrip zones={zones} selected={selectedZoneName} onSelect={setSelectedZoneName} />

              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div className="card">
                  <div className="card-title">
                    DAI Across Zones
                    <span className="card-tag">Threshold 0.40</span>
                  </div>
                  <DAIChart zones={zones} />
                </div>
                <div>
                  <PremiumCard
                    policy={policy}
                    isDisrupted={isDisrupted}
                    reliabilityScore={rider?.reliability_score ?? 60}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-title">
                    Parametric Triggers
                    {selectedZone && <span className="card-tag">{selectedZone.zone_name}</span>}
                  </div>
                  <TriggerList zone={selectedZone} />
                </div>
                <div className="card">
                  <div className="card-title">
                    Zone Conditions
                    {selectedZone && <span className="card-tag">{selectedZone.zone_name}</span>}
                  </div>
                  {selectedZone ? (
                    <ZoneSignals zone={selectedZone} />
                  ) : (
                    <EmptyState icon="📍" title="Select a zone above" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* ─ Alerts Tab ─ */}
          {tab === "Alerts" && (
            <div className="card">
              <div className="card-title">
                Live Disruption Alerts
                <span className="card-tag">{disruptedCount} disrupted</span>
              </div>
              {zones.filter((z) => z.dai < 0.65).length === 0 ? (
                <EmptyState icon="✅" title="All zones operating normally" description="No disruptions detected" />
              ) : (
                <div className="alert-feed">
                  {[...zones]
                    .filter((z) => z.dai < 0.65)
                    .sort((a, b) => a.dai - b.dai)
                    .map((z) => {
                      const isCritical = z.dai < 0.4;
                      return (
                        <div key={z.zone_name} className={`alert-card ${isCritical ? "danger" : "warning"}`}>
                          <div className={`alert-dot ${isCritical ? "danger" : "warning"}`} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {isCritical ? "⚡ TRIGGERED" : "⚠ WATCH"} — {z.zone_name}
                            </div>
                            <div style={{ fontSize: 11, marginTop: 3, color: "var(--text-secondary)" }}>
                              DAI {z.dai.toFixed(2)} · Rain {z.rainfall_mm.toFixed(0)}mm · AQI {z.aqi}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                            {fmtTime(z.updated_at)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ─ Claims Tab ─ */}
          {tab === "Claims" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {rider && (
                <div className="card">
                  <div className="card-title">File a Distress Claim</div>
                  {distressMsg && (
                    <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--brand-muted)", borderRadius: 8, fontSize: 12, color: "var(--brand-dark)" }}>
                      {distressMsg}
                    </div>
                  )}
                  <ManualDistressPanel
                    riderId={rider.id}
                    zone={selectedZone}
                    onSuccess={setDistressMsg}
                  />
                </div>
              )}

              <div className="card">
                <div className="card-title">
                  Recent Payout Events
                  <span className="card-tag">{payouts.length} events</span>
                </div>
                {payouts.length === 0 ? (
                  <EmptyState icon="📋" title="No payout events yet" description="Payouts appear here when a parametric trigger fires" />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      <div style={{ flex: 1, background: "var(--bg-raised)", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>Total Paid</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>{fmtInr(totalPayout)}</div>
                      </div>
                      <div style={{ flex: 1, background: "var(--bg-raised)", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>Events</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{payouts.length}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {payouts.slice(0, 10).map((p) => (
                        <div key={p.id} className="payout-row">
                          <div className="payout-dot" />
                          <div className="payout-info">{p.zone_name} · {p.trigger_reason.slice(0, 40)}{p.trigger_reason.length > 40 ? "…" : ""}</div>
                          <div className="payout-amount" style={{ color: "var(--brand)" }}>{fmtInr(p.payout_amount_inr)}</div>
                          <div className="payout-time">{fmtTime(p.event_time)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─ Coverage Tab ─ */}
          {tab === "Coverage" && (
            <div className="card">
              <div className="card-title">
                Insurance Plans
                {policy && <span className="card-tag">Active: {policy.policy_name}</span>}
              </div>
              <PolicyPicker
                policies={policies}
                currentPolicyName={policy?.policy_name ?? null}
                onSelect={subscribe}
                loading={riderLoading}
              />
            </div>
          )}

          {/* ─ Onboarding Tab ─ */}
          {tab === "Onboarding" && (
            <div className="card">
              <div className="card-title">Rider Profile</div>
              {rider ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{initials}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{rider.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{rider.email}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { k: "City", v: rider.city },
                      { k: "Zone", v: rider.home_zone },
                      { k: "Reliability", v: `${rider.reliability_score}/100` },
                      { k: "Plan", v: policy?.policy_name ?? "No plan" },
                      { k: "Joined", v: fmtTime(rider.created_at) },
                      { k: "Eligible from", v: policy?.eligible_from ? fmtTime(policy.eligible_from) : "—" },
                    ].map(({ k, v }) => (
                      <div key={k} style={{ background: "var(--bg-raised)", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-secondary" onClick={() => setTab("Coverage")} type="button">
                    Change Coverage Plan →
                  </button>
                </div>
              ) : (
                <OnboardingWizard
                  onOnboard={onboard}
                  onSubscribe={subscribe}
                  loading={riderLoading}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Toast notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
