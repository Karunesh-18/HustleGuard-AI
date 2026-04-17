"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getZoneLiveData, getRecentPayouts, quotePolicy } from "@/lib/api";
import {
  MapPinIcon, ShieldIcon, BanknoteIcon, AlertIcon,
  RefreshIcon, CloudRainIcon, ActivityIcon, ZapIcon, CheckIcon,
} from "@/components/Icon";
import type { ZoneLiveData, PayoutEventRead, PolicyQuoteResponse } from "@/types";

type Rider = { name?: string; home_zone?: string; reliability_score?: number };

/** The big DAI ring shown only for the rider's home zone. */
function DAIRing({ value, size = 100 }: { value: number; size?: number }) {
  const r = 38, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value);
  const cls = value >= 0.6 ? "" : value >= 0.4 ? "dai-moderate" : "dai-danger";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={9} className="dai-ring-track" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" strokeWidth={9}
        className={`dai-ring-fill ${cls}`}
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x={50} y={46} textAnchor="middle" fill="var(--text-primary)"
        style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}
      >
        {Math.round(value * 100)}%
      </text>
      <text x={50} y={60} textAnchor="middle" fill="var(--text-tertiary)"
        style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
      >
        Zone DAI
      </text>
    </svg>
  );
}

/** Tiny horizontal status dot for each other zone in the network strip. */
function ZoneStatusDot({ zone }: { zone: ZoneLiveData }) {
  const bad = zone.dai < 0.4;
  const warn = zone.dai < 0.6;
  const color = bad ? "var(--danger)" : warn ? "var(--warning)" : "var(--accent)";
  const isReal = zone.data_source === "real";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 14px", borderBottom: "1px solid var(--border)",
    }}>
      <div className="row" style={{ gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0,
          boxShadow: bad ? `0 0 6px ${color}` : "none",
        }} />
        <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>
          {zone.zone_name}
        </span>
        {isReal && (
          <span style={{
            fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.06em",
            color: "var(--accent)", background: "rgba(6,214,160,0.12)",
            padding: "1px 5px", borderRadius: 3, lineHeight: 1.5,
          }}>LIVE</span>
        )}
      </div>
      <div className="row" style={{ gap: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          {Math.round(zone.dai * 100)}%
        </span>
        <span style={{
          fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.05em",
          color, padding: "2px 6px", borderRadius: 4,
          background: bad ? "rgba(239,68,68,0.12)" : warn ? "rgba(245,158,11,0.12)" : "rgba(6,214,160,0.1)",
        }}>
          {bad ? "DISRUPTED" : warn ? "WATCH" : "OK"}
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [payouts, setPayouts] = useState<PayoutEventRead[]>([]);
  const [rider, setRider] = useState<Rider | null>(null);
  const [quote, setQuote] = useState<PolicyQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (riderData?: Rider) => {
    try {
      const r = riderData ?? rider;
      const [zonesResult, payoutsResult] = await Promise.allSettled([
        getZoneLiveData(),
        getRecentPayouts(),
      ]);

      let fetchError: string | null = null;

      if (zonesResult.status === "fulfilled") {
        setZones(zonesResult.value);
      } else {
        fetchError = "Backend unreachable — check your connection.";
      }
      if (payoutsResult.status === "fulfilled") {
        setPayouts(payoutsResult.value);
      }

      if (r?.home_zone && !quote) {
        quotePolicy(r.home_zone, r.reliability_score ?? 60).then(setQuote).catch(() => {});
      }

      setError(fetchError);
      if (!fetchError) setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [rider, quote]);

  useEffect(() => {
    const raw = localStorage.getItem("hg_rider");
    if (!raw) { router.replace("/onboard"); return; }
    let r: Rider;
    try { r = JSON.parse(raw); } catch { router.replace("/onboard"); return; }
    setRider(r);
    void fetchData(r);
    const id = setInterval(() => void fetchData(r), 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const homeZone = zones.find((z) => z.zone_name === rider?.home_zone);
  const otherZones = zones.filter((z) => z.zone_name !== rider?.home_zone);
  const recentPayout = payouts.find((p) => p.zone_name === rider?.home_zone) ?? payouts[0];
  const myPlan = quote?.plans[1]; // Standard Guard default
  const isProtected = homeZone && myPlan ? homeZone.dai < myPlan.dai_trigger_threshold : false;
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";

  // Coverage status messaging
  const coverageStatus = () => {
    if (!homeZone) return { label: "Loading…", color: "var(--text-tertiary)", level: "normal" as const };
    if (homeZone.dai < 0.4) return { label: "Disrupted — payout processing", color: "var(--danger)", level: "high" as const };
    if (homeZone.dai < 0.55) return { label: "Moderate disruption — watch active", color: "var(--warning)", level: "moderate" as const };
    return { label: "All clear — no disruption", color: "var(--accent)", level: "normal" as const };
  };
  const status = coverageStatus();

  return (
    <div className="p-md stack">

      {/* Greeting */}
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>{greeting}</div>
          <div className="display-sm" style={{ fontFamily: "var(--font-display)" }}>{rider?.name ?? "Rider"}</div>
        </div>
        {lastUpdated && (
          <div className="row" style={{ gap: 4, paddingBottom: 4 }}>
            <RefreshIcon size={11} color="var(--text-tertiary)" />
            <span className="body-sm" style={{ color: "var(--text-tertiary)" }}>
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      {/* ── Backend error banner ─────────────────────────────────────────── */}
      {!loading && error && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.3)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <AlertIcon size={18} color="var(--danger)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--danger)" }}>
              {error}
            </div>
            <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 2 }}>
              Live data may be stale. Retrying automatically every 15s.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { void fetchData(); }}
            style={{ padding: "6px 12px", fontSize: "0.8125rem", flexShrink: 0 }}
          >
            <RefreshIcon size={13} color="var(--text-primary)" /> Retry
          </button>
        </div>
      )}

      {/* ── Home zone hero card ─────────────────────────────────────────── */}
      {loading && !homeZone ? (
        <div className="skeleton-shimmer" style={{ height: 160 }} />
      ) : homeZone ? (
        <div className="glass-brand" style={{ padding: "var(--space-md)" }}>
          {/* Zone name + status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div className="row" style={{ gap: 5, marginBottom: 5 }}>
                <MapPinIcon size={13} color="var(--text-tertiary)" />
                <span className="label" style={{ color: "var(--text-tertiary)" }}>Your Zone</span>
              </div>
              <div className="display-sm" style={{ marginBottom: 8 }}>{homeZone.zone_name}</div>
              <div className={`pill pill-${status.level}`}>{status.label}</div>
            </div>
            <DAIRing value={homeZone.dai} size={100} />
          </div>

          {/* What DAI means for this rider */}
          {myPlan && (
            <div style={{
              background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)",
              padding: "8px 12px", marginBottom: 12,
              border: `1px solid ${isProtected ? "rgba(239,68,68,0.3)" : "rgba(6,214,160,0.15)"}`,
            }}>
              <div className="row" style={{ gap: 6 }}>
                {isProtected
                  ? <ZapIcon size={13} color="var(--danger)" />
                  : <CheckIcon size={13} color="var(--accent)" />}
                <span style={{ fontSize: "0.8125rem", color: isProtected ? "var(--danger)" : "var(--accent)", fontWeight: 600 }}>
                  {isProtected
                    ? `Zone DAI ${Math.round(homeZone.dai * 100)}% — below your ${Math.round(myPlan.dai_trigger_threshold * 100)}% trigger — payout eligible`
                    : `Zone DAI ${Math.round(homeZone.dai * 100)}% — above ${Math.round(myPlan.dai_trigger_threshold * 100)}% trigger — all good`}
                </span>
              </div>
            </div>
          )}

          {/* Zone environmental conditions — what's causing the DAI */}
          <div className="grid-3" style={{ gap: 8 }}>
            {[
              { label: "Rain",    value: `${homeZone.rainfall_mm}mm`, icon: CloudRainIcon },
              { label: "AQI",     value: String(homeZone.aqi),        icon: ActivityIcon },
              { label: homeZone.traffic_speed_kmh ? "Speed" : "Traffic",
                value: homeZone.traffic_speed_kmh ? `${homeZone.traffic_speed_kmh}km/h` : String(homeZone.traffic_index),
                icon: MapPinIcon },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="metric-card" style={{ padding: "8px 10px", gap: 3 }}>
                <div className="row" style={{ gap: 4, marginBottom: 2 }}>
                  <Icon size={10} color="var(--text-tertiary)" />
                  <div className="metric-label" style={{ fontSize: "0.5625rem" }}>{label}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Temperature + pollutant row — only shown when real API data is present */}
          {(homeZone.temperature_celsius != null || homeZone.dominant_pollutant) && (
            <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {homeZone.temperature_celsius != null && (
                <span className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                  🌡️ {homeZone.temperature_celsius.toFixed(1)}°C
                </span>
              )}
              {homeZone.dominant_pollutant && (
                <span className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                  💨 {homeZone.dominant_pollutant.toUpperCase()} dominant
                </span>
              )}
              {homeZone.weather_description && (
                <span className="body-sm" style={{ color: "var(--text-tertiary)", textTransform: "capitalize" }}>
                  {homeZone.weather_description}
                </span>
              )}
            </div>
          )}

          {/* Data source badge */}
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <span style={{
              fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em",
              color: homeZone.data_source === "real" ? "var(--accent)" : "var(--text-tertiary)",
              background: homeZone.data_source === "real" ? "rgba(6,214,160,0.1)" : "rgba(255,255,255,0.06)",
              padding: "2px 7px", borderRadius: 4, border: "1px solid",
              borderColor: homeZone.data_source === "real" ? "rgba(6,214,160,0.3)" : "var(--border)",
            }}>
              {homeZone.data_source === "real" ? "● LIVE DATA" : "◌ SIMULATED"}
            </span>
          </div>
        </div>
      ) : null}

      {/* ── Coverage + Last payout row ─────────────────────────────────── */}
      <div className="grid-2">
        <div className="metric-card">
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <ShieldIcon size={12} color="var(--text-tertiary)" />
            <div className="metric-label">Coverage</div>
          </div>
          <div className="metric-value" style={{ color: "var(--brand-light)", fontSize: "1rem" }}>
            {myPlan?.policy_name ?? (loading ? "—" : "Not set")}
          </div>
          <div className="metric-sub">
            {myPlan ? `Pays ₹${myPlan.payout_per_disruption_inr} on disruption` : "Visit Profile to set up"}
          </div>
        </div>
        <div className="metric-card">
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <BanknoteIcon size={12} color="var(--text-tertiary)" />
            <div className="metric-label">Last Payout</div>
          </div>
          <div className="metric-value" style={{ color: "var(--accent)" }}>
            {recentPayout ? `₹${recentPayout.payout_amount_inr}` : loading ? "—" : "—"}
          </div>
          <div className="metric-sub">{recentPayout?.zone_name ?? "No recent payouts"}</div>
        </div>
      </div>

      {/* ── City Network Status ─────────────────────────────────────────── */}
      {/* Other zones shown as compact one-liners — city-wide context, not the rider's concern */}
      <div className="section">
        <div className="section-title" style={{ marginBottom: 6 }}>
          <ActivityIcon size={14} color="var(--text-secondary)" />
          <span>City Network</span>
          <span className="body-sm" style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontWeight: 400 }}>
            {zones.length} zones monitored
          </span>
        </div>
        <div className="body-sm" style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>
          Other zones in Bengaluru — for context only. Your coverage applies to {rider?.home_zone ?? "your zone"}.
        </div>
        {loading ? (
          <div className="skeleton-shimmer" style={{ height: 140 }} />
        ) : otherZones.length === 0 ? (
          <div className="empty-state">
            <AlertIcon size={28} color="var(--text-tertiary)" />
            <div className="empty-title">No network data</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {otherZones.map((z) => <ZoneStatusDot key={z.zone_name} zone={z} />)}
          </div>
        )}
      </div>
    </div>
  );
}
