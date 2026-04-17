"use client";

import { useState, useEffect } from "react";
import { submitManualDistressClaim, getZones } from "@/lib/api";
import type { ZoneLiveData } from "@/types";

type Reason = "Rain" | "Traffic" | "Curfew" | "Other";

const REASONS: { value: Reason; icon: string; label: string }[] = [
  { value: "Rain", icon: "🌧", label: "Heavy Rain" },
  { value: "Traffic", icon: "🚗", label: "Traffic Jam" },
  { value: "Curfew", icon: "🚫", label: "Curfew/Lockdown" },
  { value: "Other", icon: "❓", label: "Other Reason" },
];

export function ManualDistressPanel({
  riderId,
  zone,
  onSuccess,
}: {
  riderId: number;
  zone: ZoneLiveData | null;
  onSuccess: (msg: string) => void;
}) {
  const [selected, setSelected] = useState<Reason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedZoneId, setResolvedZoneId] = useState<number>(1);
  const [result, setResult] = useState<{
    decision: string;
    eta: number;
    trust: number;
  } | null>(null);

  // Resolve zone_id from the zones API using the zone name from live data.
  // Falls back to 1 if the zones list is unavailable so the claim still submits.
  useEffect(() => {
    if (!zone?.zone_name) return;
    getZones()
      .then((zones) => {
        const match = zones.find(
          (z) => z.name.toLowerCase() === zone.zone_name.toLowerCase()
        );
        if (match?.id) setResolvedZoneId(match.id);
      })
      .catch(() => {
        // Non-fatal — keep the fallback id=1
      });
  }, [zone?.zone_name]);

  const handleSubmit = async () => {
    if (!selected || !zone || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitManualDistressClaim({
        rider_id: riderId,
        zone_id: resolvedZoneId,
        reason: selected,
        zone_dai: zone.dai,
        rainfall: zone.rainfall_mm,
        AQI: zone.aqi,
        traffic_speed: zone.traffic_index,
      });
      setResult({
        decision: res.decision,
        eta: res.estimated_payout_seconds,
        trust: res.trust_score,
      });
      onSuccess(
        res.decision === "instant_payout"
          ? `Payout processing — estimated ₹ in ~${res.estimated_payout_seconds}s`
          : `Claim submitted (trust score: ${res.trust_score.toFixed(0)})`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      onSuccess(`Error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const isInstant = result.decision === "instant_payout";
    return (
      <div className="distress-result">
        <div className="distress-result-icon">{isInstant ? "✅" : "🕐"}</div>
        <div className="distress-result-title">
          {isInstant ? "Payout Initiated" : "Claim Under Review"}
        </div>
        <div className="distress-result-sub">
          {isInstant
            ? `Processing in ~${result.eta}s · Trust score: ${result.trust.toFixed(0)}/100`
            : `Trust score: ${result.trust.toFixed(0)}/100 · Expected review in 5–10 min`}
        </div>
        <button
          className="btn-secondary"
          onClick={() => { setResult(null); setSelected(null); }}
          type="button"
        >
          File another claim
        </button>
      </div>
    );
  }

  return (
    <div className="distress-panel">
      <div className="distress-header">
        <div className="distress-title">Can&apos;t Work Right Now?</div>
        <div className="distress-sub">Select one reason — takes 3 seconds</div>
      </div>

      <div className="distress-reasons">
        {REASONS.map((r) => (
          <button
            key={r.value}
            className={`distress-reason-btn${selected === r.value ? " selected" : ""}`}
            onClick={() => setSelected(r.value)}
            type="button"
          >
            <span className="distress-reason-icon">{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      <button
        className="btn-primary distress-submit"
        onClick={() => void handleSubmit()}
        disabled={!selected || submitting || !zone}
        type="button"
      >
        {submitting ? "Submitting…" : "Submit Distress Claim"}
      </button>

      <div className="distress-note">
        Auto-validated using GPS, zone DAI, and peer activity.
        Trust score ≥ 80 → instant payout.
      </div>
    </div>
  );
}
