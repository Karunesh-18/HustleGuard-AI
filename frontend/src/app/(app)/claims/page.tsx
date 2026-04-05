"use client";

import { useState, useEffect } from "react";
import { submitManualDistressClaim, getZoneLiveData } from "@/lib/api";
import type { ZoneLiveData } from "@/types";
import { CloudRainIcon, CarIcon, LockIcon, HelpCircleIcon, SosIcon, ZapIcon, ClockIcon, ActivityIcon } from "@/components/Icon";

const REASONS = [
  { value: "Rain",    Icon: CloudRainIcon, label: "Heavy Rain" },
  { value: "Traffic", Icon: CarIcon,       label: "Traffic Jam" },
  { value: "Curfew",  Icon: LockIcon,      label: "Curfew" },
  { value: "Other",   Icon: HelpCircleIcon,label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

function CountdownBar({ seconds }: { seconds: number }) {
  return (
    <div>
      <div className="row justify-between" style={{ marginBottom: 4, fontSize: "0.75rem" }}>
        <span style={{ color: "var(--text-tertiary)" }}>Estimated payout time</span>
        <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{seconds}s</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill accent" style={{ width: `${Math.min(100, (seconds / 300) * 100)}%` }} />
      </div>
    </div>
  );
}

type Rider = { id?: number; name?: string; home_zone?: string };

export default function ClaimsPage() {
  const [reason, setReason] = useState<Reason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ decision: string; estimated_payout_seconds: number; trust_score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [zones, setZones] = useState<ZoneLiveData[]>([]);

  // Load rider from localStorage and fetch live zone data for real conditions
  useEffect(() => {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("hg_rider") : null;
    if (raw) {
      try { setRider(JSON.parse(raw) as Rider); } catch { /* ignore */ }
    }
    getZoneLiveData().then(setZones).catch(() => {});
  }, []);

  // Pick the zone matching the rider's home_zone, fall back to the worst zone
  const homeZoneData = zones.find((z) => z.zone_name === rider?.home_zone)
    ?? zones.sort((a, b) => a.dai - b.dai)[0]
    ?? null;

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!rider?.id) {
        setError("Please complete onboarding first before submitting a claim.");
        return;
      }

      // Use live zone conditions — accurate fraud evaluation
      const zoneData = homeZoneData;
      const trafficSpeed = zoneData ? Math.max(5, 80 - zoneData.traffic_index) : 20;
      const zoneId = zoneData
        ? zones.indexOf(zoneData) + 1   // zone_id is 1-indexed in the DB order
        : 1;

      const res = await submitManualDistressClaim({
        rider_id: rider.id,
        zone_id: zoneId,
        reason,
        zone_dai: zoneData?.dai ?? 0.38,
        rainfall: zoneData?.rainfall_mm ?? 85,
        AQI: zoneData?.aqi ?? 220,
        traffic_speed: trafficSpeed,
      });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claim submission failed";
      if (msg.includes("400")) {
        setError(
          "Claim rejected — no active policy found. Open your Profile → Coverage to get protected first."
        );
      } else if (msg.includes("429")) {
        setError("Too many submissions — please wait a minute before trying again.");
      } else if (msg.includes("503")) {
        setError("Service temporarily unavailable. Please try again in a moment.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const isInstant = result.decision === "instant_payout";
    return (
      <div className="p-md stack">
        <div style={{ paddingTop: 4 }}>
          <div className="display-sm">Claim Submitted</div>
        </div>
        <div className={`glass-${isInstant ? "accent" : "brand"}`} style={{ padding: "var(--space-lg)", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            {isInstant
              ? <ZapIcon size={48} color="var(--accent)" />
              : <ClockIcon size={48} color="var(--brand-light)" />}
          </div>
          <div className="display-sm" style={{ marginTop: 4 }}>
            {isInstant ? "Instant Payout" : "Processing"}
          </div>
          <div className="body-md" style={{ color: "var(--text-secondary)", margin: "8px 0 20px" }}>
            {isInstant ? "Your payout has been approved automatically." : "Being reviewed by our system. Check back shortly."}
          </div>
          <CountdownBar seconds={result.estimated_payout_seconds} />
          <div className="grid-2" style={{ gap: 8, marginTop: 16 }}>
            <div className="metric-card" style={{ padding: "10px" }}>
              <div className="metric-label">Trust Score</div>
              <div className="metric-value" style={{ color: "var(--accent)", fontSize: "1.2rem" }}>{Math.round(result.trust_score)}</div>
            </div>
            <div className="metric-card" style={{ padding: "10px" }}>
              <div className="metric-label">Decision</div>
              <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--text-primary)", textTransform: "capitalize" }}>
                {result.decision.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => { setResult(null); setReason(null); }} type="button">
          Submit Another Claim
        </button>
      </div>
    );
  }

  return (
    <div className="p-md stack">
      <div style={{ paddingTop: 4 }}>
        <div className="display-sm">Submit a Claim</div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Can&apos;t work due to a disruption? We&apos;ll verify and pay instantly.
        </div>
      </div>

      {/* Live zone conditions badge */}
      {homeZoneData && (
        <div style={{
          padding: "8px 12px", borderRadius: "var(--radius-md)",
          background: homeZoneData.dai < 0.45 ? "rgba(239,68,68,0.08)" : "var(--bg-raised)",
          border: `1px solid ${homeZoneData.dai < 0.45 ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <ActivityIcon size={14} color={homeZoneData.dai < 0.45 ? "var(--danger)" : "var(--text-secondary)"} />
          <span style={{ fontSize: "0.8125rem", color: homeZoneData.dai < 0.45 ? "var(--danger)" : "var(--text-secondary)", fontWeight: 600 }}>
            {homeZoneData.zone_name} — {homeZoneData.dai < 0.45 ? "Active disruption" : "Conditions normal"}
          </span>
          <span className="body-sm" style={{ color: "var(--text-tertiary)", marginLeft: "auto" }}>
            DAI {Math.round(homeZoneData.dai * 100)}% · Rain {homeZoneData.rainfall_mm}mm
          </span>
        </div>
      )}

      {/* Panic button */}
      <button
        className="panic-button"
        onClick={handleSubmit}
        disabled={!reason || submitting}
        type="button"
        style={{ opacity: reason ? 1 : 0.5 }}
      >
        {submitting
          ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Processing…</>
          : <><SosIcon size={24} color="white" /> I Can&apos;t Work</>}
      </button>

      {/* Reason selection */}
      <div>
        <div className="label" style={{ color: "var(--text-tertiary)", marginBottom: 10 }}>Why can&apos;t you work?</div>
        <div className="grid-2" style={{ gap: 10 }}>
          {REASONS.map(({ value, Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setReason(value)}
              style={{
                padding: "14px 10px",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${reason === value ? "var(--brand)" : "var(--border)"}`,
                background: reason === value ? "var(--brand-muted)" : "var(--bg-raised)",
                color: reason === value ? "var(--brand-light)" : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.875rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                transition: "border-color 0.15s, background 0.15s, color 0.15s",
              }}
            >
              <Icon size={28} color={reason === value ? "var(--brand-light)" : "var(--text-tertiary)"} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error" style={{ textAlign: "center", padding: "8px 0" }}>{error}</div>}

      {/* Info card */}
      <div className="card" style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          <ActivityIcon size={14} color="var(--text-secondary)" />
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>How it works</span>
        </div>
        Our fraud engine evaluates your claim in real-time against weather, AQI, and peer signals.
        Trust score &ge; 80 triggers an instant payout in approximately 47 seconds.
      </div>
    </div>
  );
}
