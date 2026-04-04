"use client";

import { useState } from "react";
import type { PolicyRead } from "@/types";

const TIER_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  "Basic Shield": { accent: "#4B8FD4", bg: "#E3EEFB", text: "#1A4F8A" },
  "Standard Guard": { accent: "#EF9F27", bg: "#FAEEDA", text: "#854F0B" },
  "Premium Armor": { accent: "#1D9E75", bg: "#EAF3DE", text: "#27500A" },
};

export function PolicyPicker({
  policies,
  currentPolicyName,
  onSelect,
  loading,
}: {
  policies: PolicyRead[];
  currentPolicyName: string | null;
  onSelect: (name: string) => Promise<unknown>;
  loading: boolean;
}) {
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelect = async (name: string) => {
    if (loading || selecting) return;
    setSelecting(name);
    try {
      await onSelect(name);
    } finally {
      setSelecting(null);
    }
  };

  const displayPolicies = policies;

  return (
    <div className="policy-grid">
      {displayPolicies.map((p) => {
        const colors = TIER_COLORS[p.name] ?? TIER_COLORS["Basic Shield"];
        const isCurrent = currentPolicyName === p.name;
        const isSelecting = selecting === p.name;

        return (
          <div
            key={p.name}
            className="policy-card"
            style={{
              borderColor: isCurrent ? colors.accent : "var(--border-md)",
              boxShadow: isCurrent ? `0 0 0 1.5px ${colors.accent}` : undefined,
            }}
          >
            {/* Header */}
            <div className="policy-card-header">
              <span className="policy-name" style={{ color: colors.text }}>
                {p.name}
              </span>
              {isCurrent && (
                <span
                  className="policy-active-badge"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  Active
                </span>
              )}
            </div>

            {/* Price */}
            <div className="policy-price" style={{ color: colors.accent }}>
              ₹{p.weekly_premium_inr}
              <span className="policy-period">/wk</span>
            </div>

            {/* Key specs */}
            <div className="policy-specs">
              <div className="policy-spec-row">
                <span>Payout per event</span>
                <strong>₹{p.payout_per_disruption_inr}</strong>
              </div>
              <div className="policy-spec-row">
                <span>DAI trigger</span>
                <strong>&lt;{p.dai_trigger_threshold.toFixed(2)}</strong>
              </div>
              <div className="policy-spec-row">
                <span>Rain trigger</span>
                <strong>&gt;{p.rainfall_trigger_mm}mm</strong>
              </div>
              <div className="policy-spec-row">
                <span>Claims/week</span>
                <strong>{p.max_claims_per_week}</strong>
              </div>
            </div>

            {/* Feature flags */}
            <div className="policy-features">
              <FeatureChip enabled={p.supports_partial_disruption} label="Partial payout" />
              <FeatureChip enabled={p.supports_community_claims} label="Community claims" />
              <FeatureChip enabled={p.appeal_window_hours > 0} label={`${p.appeal_window_hours}h appeal`} />
            </div>

            {/* CTA */}
            {!isCurrent && (
              <button
                className="policy-select-btn"
                style={{ background: colors.accent }}
                onClick={() => void handleSelect(p.name)}
                disabled={loading || !!selecting}
                type="button"
              >
                {isSelecting ? "Subscribing…" : "Subscribe"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FeatureChip({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className="feature-chip"
      style={{
        background: enabled ? "#EAF3DE" : "var(--bg-raised)",
        color: enabled ? "#27500A" : "var(--text-tertiary)",
        textDecoration: enabled ? undefined : "line-through",
        opacity: enabled ? 1 : 0.6,
      }}
    >
      {enabled ? "✓" : "✗"} {label}
    </span>
  );
}

