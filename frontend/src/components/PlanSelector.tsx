/**
 * PlanSelector — shared plan selection component used in both onboarding and profile.
 *
 * Shows all 3 tiers with ML-dynamic pricing:
 *   - Price range (base ₹N – max at 1.45× risk multiplier)
 *   - Your zone's current ML-adjusted price (highlighted)
 *   - Feature comparison per tier
 *   - Recommended badge on Standard Guard
 */
"use client";

import type { PolicyQuotedPlan, PolicyQuoteResponse } from "@/types";

const TIER_META: Record<string, {
  emoji: string;
  tagline: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  features: string[];
}> = {
  "Basic Shield": {
    emoji: "🛡️",
    tagline: "Essential rain cover",
    color: "var(--text-secondary)",
    gradientFrom: "rgba(100,116,139,0.12)",
    gradientTo: "rgba(100,116,139,0.04)",
    features: ["₹300 payout per event", "Up to 2 claims/week", "DAI trigger < 0.35"],
  },
  "Standard Guard": {
    emoji: "⚡",
    tagline: "Best value for most riders",
    color: "var(--brand-light)",
    gradientFrom: "rgba(91,33,182,0.18)",
    gradientTo: "rgba(91,33,182,0.06)",
    features: [
      "₹500 payout per event",
      "Up to 3 claims/week",
      "DAI trigger < 0.40",
      "Partial disruption claims",
      "Community claims",
    ],
  },
  "Premium Armor": {
    emoji: "🔥",
    tagline: "Maximum protection",
    color: "var(--accent)",
    gradientFrom: "rgba(6,214,160,0.15)",
    gradientTo: "rgba(6,214,160,0.04)",
    features: [
      "₹700 payout per event",
      "Up to 5 claims/week",
      "DAI trigger < 0.50",
      "Partial + Community claims",
      "72h appeal window",
      "No waiting period",
    ],
  },
};

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RiskBadge({ label }: { label: "normal" | "moderate" | "high" }) {
  const colors = { normal: "var(--accent)", moderate: "var(--warning)", high: "var(--danger)" };
  const labels = { normal: "Low Risk Zone", moderate: "Moderate Risk", high: "High Risk Zone" };
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
      borderRadius: 99, background: `color-mix(in srgb, ${colors[label]} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colors[label]} 35%, transparent)`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors[label] }} />
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: colors[label], letterSpacing: "0.03em" }}>
        {labels[label]}
      </span>
    </div>
  );
}

type Props = {
  quote: PolicyQuoteResponse;
  currentPolicyName?: string;
  selectedPlan: string | null;
  onSelect: (plan: PolicyQuotedPlan) => void;
  /** True = highlight selected plan distinctly (choosing mode). False = just display. */
  interactive?: boolean;
};

export default function PlanSelector({ quote, currentPolicyName, selectedPlan, onSelect, interactive = true }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Zone context header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{quote.zone_name}</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginTop: 1 }}>
            {Math.round(quote.disruption_probability * 100)}% disruption probability · DAI {Math.round(quote.predicted_dai * 100)}%
          </div>
        </div>
        <RiskBadge label={quote.risk_label} />
      </div>

      {/* Plan cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {quote.plans.map((plan) => {
          const meta = TIER_META[plan.policy_name] ?? TIER_META["Standard Guard"];
          const isRecommended = plan.policy_name === "Standard Guard";
          const isCurrent = plan.policy_name === currentPolicyName;
          const isSelected = plan.policy_name === selectedPlan;
          const isActive = isSelected || (!selectedPlan && isCurrent);

          // Price range: base price at 1.0× → max at 1.45× multiplier
          const priceMin = Math.round(plan.base_premium_inr);
          const priceMax = Math.round(plan.base_premium_inr * 1.45);

          const borderColor = isActive
            ? (plan.policy_name === "Premium Armor" ? "var(--accent)" : "var(--brand)")
            : "var(--border)";

          return (
            <div
              key={plan.policy_name}
              onClick={() => interactive && onSelect(plan)}
              style={{
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${borderColor}`,
                background: isActive
                  ? `linear-gradient(135deg, ${meta.gradientFrom} 0%, ${meta.gradientTo} 100%)`
                  : "var(--bg-raised)",
                padding: "14px 16px",
                cursor: interactive ? "pointer" : "default",
                transition: "border-color 0.15s, background 0.2s",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Recommended / Current badge */}
              {(isRecommended || isCurrent) && (
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  display: "flex", gap: 4,
                }}>
                  {isCurrent && (
                    <div style={{
                      fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.06em",
                      padding: "2px 7px", borderRadius: 99,
                      background: "var(--accent)", color: "#000",
                    }}>CURRENT</div>
                  )}
                  {isRecommended && !isCurrent && (
                    <div style={{
                      fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.06em",
                      padding: "2px 7px", borderRadius: 99,
                      background: "var(--brand)", color: "white",
                    }}>POPULAR</div>
                  )}
                </div>
              )}

              {/* Header row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{meta.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: isActive ? meta.color : "var(--text-primary)" }}>
                    {plan.policy_name}
                  </div>
                  <div style={{ fontSize: "0.78125rem", color: "var(--text-tertiary)", marginTop: 1 }}>
                    {meta.tagline}
                  </div>
                </div>
                {/* Pricing block */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.25rem", color: meta.color, fontFamily: "var(--font-display)", lineHeight: 1 }}>
                    ₹{plan.quoted_premium_inr}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    /week
                  </div>
                  <div style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", marginTop: 3 }}>
                    ₹{priceMin}–{priceMax} range
                  </div>
                </div>
              </div>

              {/* Risk multiplier callout when non-1× */}
              {quote.risk_multiplier > 1.0 && (
                <div style={{
                  fontSize: "0.6875rem", color: "var(--text-tertiary)",
                  marginBottom: 8, padding: "3px 8px",
                  background: "rgba(239,68,68,0.06)", borderRadius: 6,
                  borderLeft: "2px solid rgba(239,68,68,0.3)",
                }}>
                  Zone risk surcharge {quote.risk_multiplier.toFixed(2)}× applied to base ₹{priceMin}
                </div>
              )}

              {/* Feature list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {meta.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <CheckIcon color={isActive ? meta.color : "var(--text-tertiary)"} />
                    <span style={{ fontSize: "0.8125rem", color: isActive ? "var(--text-secondary)" : "var(--text-tertiary)" }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Waiting period note */}
              {plan.waiting_period_days > 0 && (
                <div style={{ marginTop: 8, fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                  ⏱ {plan.waiting_period_days}-day waiting period after enrollment
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
