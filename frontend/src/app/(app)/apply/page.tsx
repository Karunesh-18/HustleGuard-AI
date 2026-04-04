"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRecommendation, subscribeRiderToPolicy } from "@/lib/api";
import { useRazorpay } from "@/hooks/useRazorpay";
import type { PolicyRecommendation } from "@/types";
import {
  ShieldIcon, ZapIcon, CheckIcon, AlertIcon, ActivityIcon,
  CloudRainIcon, InfoIcon, ChevronRightIcon, ClockIcon, LayersIcon,
} from "@/components/Icon";

type Rider = { id?: number; name?: string; home_zone?: string; reliability_score?: number };

const TERMS = `HustleGuard AI — Insurance Coverage Terms & Conditions

1. COVERAGE SCOPE
Your policy activates automatically when your home zone's Delivery Activity Index (DAI) falls below the trigger threshold defined in your plan, as measured by our real-time ML monitoring system.

2. PAYOUT ELIGIBILITY
Payouts are triggered parametrically — no claim filing is required. The system evaluates zone conditions every 15 minutes. If conditions meet the trigger criteria, your payout is processed automatically via your registered UPI account.

3. FRAUD PREVENTION
HustleGuard uses a real-time fraud engine that scores each payout event. Payouts may be held for manual review (provisional) if anomalous GPS, device, or peer-correlation signals are detected.

4. WAITING PERIOD
Coverage becomes active after the waiting period specified in your plan. No claims can be filed during this period. Premium Armor has no waiting period.

5. PREMIUM PAYMENT
Premiums are charged weekly. By accepting this policy you authorise HustleGuard to initiate a Razorpay payment of the quoted weekly premium at the start of each coverage cycle.

6. CANCELLATION
You may cancel coverage at any time from your Profile. No refunds are issued for the current billing week.

7. DATA & PRIVACY
HustleGuard collects zone-level environmental data (rainfall, AQI, traffic) and your delivery activity signals. Location data is used only for zone assignment and fraud detection. Individual data is never sold to third parties.

8. DYNAMIC PRICING
Your premium is calculated using real-time ML risk models. Premiums may change at weekly renewal based on your zone's current risk level and your reliability score.

9. CLAIMS & DISPUTES
You may raise a manual distress claim within your plan's appeal window. All disputes are reviewed within 48 hours. For escalations, contact support@hustleguard.ai.

10. GOVERNING LAW
This agreement is governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in Bengaluru, Karnataka.

By tapping "Confirm & Pay", you agree to these Terms and Conditions.`;

function RiskBadge({ label }: { label: string }) {
  const map = { high: "danger", moderate: "warning", normal: "normal" } as const;
  const level = map[label as keyof typeof map] ?? "normal";
  return (
    <span className={`pill pill-${level === "danger" ? "high" : level === "warning" ? "moderate" : "normal"}`}
      style={{ fontSize: "0.625rem" }}>
      {label.toUpperCase()} RISK
    </span>
  );
}

function PlanFeatureRow({ yes, label }: { yes: boolean; label: string }) {
  return (
    <div className="row" style={{ gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <CheckIcon size={14} color={yes ? "var(--accent)" : "var(--text-tertiary)"} />
      <span style={{ fontSize: "0.875rem", color: yes ? "var(--text-primary)" : "var(--text-tertiary)" }}>{label}</span>
    </div>
  );
}

export default function ApplyPage() {
  const router = useRouter();
  const [rider, setRider] = useState<Rider | null>(null);
  const [rec, setRec] = useState<PolicyRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [step, setStep] = useState<"review" | "tc" | "pay" | "success">("review");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const { loading: payLoading, openCheckout } = useRazorpay();

  useEffect(() => {
    const raw = localStorage.getItem("hg_rider");
    if (!raw) { router.replace("/onboard"); return; }
    let r: Rider;
    try { r = JSON.parse(raw); } catch { router.replace("/onboard"); return; }
    setRider(r);
    if (!r.id) { setError("Session invalid — please sign in again."); setLoading(false); return; }
    getRecommendation(r.id)
      .then(setRec)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load recommendation."))
      .finally(() => setLoading(false));
  }, [router]);

  const handlePayAndEnroll = useCallback(async () => {
    if (!rider?.id || !rec) return;
    const plan = rec.recommended_plan;
    const result = await openCheckout({
      amount_inr: plan.quoted_premium_inr,
      rider_id: rider.id,
      purpose: "premium",
      name: rider.name ?? "",
      description: `${plan.policy_name} — first week premium`,
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    // Payment verified — now subscribe in DB
    try {
      await subscribeRiderToPolicy(rider.id, plan.policy_name);
      setPaymentId(result.payment_id);
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription failed after payment — contact support.");
    }
  }, [rider, rec, openCheckout]);

  const plan = rec?.recommended_plan;
  const riskColor = rec?.risk_label === "high" ? "var(--danger)" : rec?.risk_label === "moderate" ? "var(--warning)" : "var(--accent)";

  // ── Success screen ─────────────────────────────────────────────────────────
  if (step === "success" && plan) {
    return (
      <div className="p-md stack" style={{ paddingTop: 24 }}>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
            background: "linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldIcon size={32} color="white" />
          </div>
          <div className="display-sm" style={{ marginBottom: 6 }}>You&apos;re Protected</div>
          <div className="body-md" style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
            {plan.policy_name} is now active on your account.
          </div>
        </div>

        <div className="glass-brand" style={{ padding: "var(--space-md)" }}>
          <div className="row justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Plan</span>
            <span style={{ fontWeight: 700, color: "var(--brand-light)" }}>{plan.policy_name}</span>
          </div>
          <div className="row justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Weekly Premium</span>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>₹{plan.quoted_premium_inr}</span>
          </div>
          <div className="row justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Payout on disruption</span>
            <span style={{ fontWeight: 700 }}>₹{plan.payout_per_disruption_inr}</span>
          </div>
          {plan.waiting_period_days > 0 && (
            <div className="row" style={{ gap: 6, marginTop: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <ClockIcon size={13} color="var(--warning)" />
              <span style={{ fontSize: "0.8125rem", color: "var(--warning)" }}>
                {plan.waiting_period_days}-day waiting period — eligible from{" "}
                {new Date(Date.now() + plan.waiting_period_days * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
          )}
          {paymentId && (
            <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 6 }}>
              Payment ID: {paymentId}
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={() => router.replace("/home")} type="button">
          Go to Dashboard
        </button>
        <button className="btn btn-ghost" onClick={() => router.replace("/profile")} type="button">
          View Profile
        </button>
      </div>
    );
  }

  // ── Loading & error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-md stack">
        <div style={{ paddingTop: 4 }}>
          <div className="display-sm">Getting your plan…</div>
          <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Analysing your zone risk with our ML model
          </div>
        </div>
        {[1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer" style={{ height: 80 }} />)}
      </div>
    );
  }

  if (error || !rec || !plan) {
    return (
      <div className="p-md stack">
        <div className="empty-state">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <AlertIcon size={36} color="var(--danger)" />
          </div>
          <div className="empty-title">Could not load recommendation</div>
          <div className="empty-body">{error ?? "Try again later."}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => router.back()} type="button">Go Back</button>
      </div>
    );
  }

  // ── T&C Screen ─────────────────────────────────────────────────────────────
  if (step === "tc") {
    return (
      <div className="p-md stack">
        <div style={{ paddingTop: 4 }}>
          <div className="display-sm">Terms &amp; Conditions</div>
          <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Read and accept before enrolling
          </div>
        </div>
        <div style={{
          background: "var(--bg-raised)", borderRadius: "var(--radius-lg)", padding: 16,
          border: "1px solid var(--border)", maxHeight: 420, overflowY: "auto",
        }}>
          <pre style={{
            whiteSpace: "pre-wrap", fontFamily: "var(--font-body)", fontSize: "0.8125rem",
            color: "var(--text-secondary)", lineHeight: 1.7, margin: 0,
          }}>
            {TERMS}
          </pre>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={tcAccepted}
            onChange={(e) => setTcAccepted(e.target.checked)}
            style={{ marginTop: 3, accentColor: "var(--brand)", width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            I have read and agree to the HustleGuard Terms &amp; Conditions and authorise the weekly premium payment of{" "}
            <strong style={{ color: "var(--text-primary)" }}>₹{plan.quoted_premium_inr}</strong>.
          </span>
        </label>

        <button
          className="btn btn-primary"
          disabled={!tcAccepted || payLoading}
          onClick={handlePayAndEnroll}
          type="button"
        >
          {payLoading
            ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Opening Razorpay…</>
            : <><ZapIcon size={16} color="white" /> Confirm &amp; Pay ₹{plan.quoted_premium_inr}</>}
        </button>
        {error && <div className="form-error" style={{ textAlign: "center" }}>{error}</div>}
        <button className="btn btn-ghost" onClick={() => setStep("review")} type="button">Back</button>
      </div>
    );
  }

  // ── Review screen (default) ────────────────────────────────────────────────
  return (
    <div className="p-md stack">
      <div style={{ paddingTop: 4 }}>
        <div className="display-sm">Your Coverage Plan</div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Dynamically selected for you — no forms needed.
        </div>
      </div>

      {/* Recommendation rationale */}
      <div style={{
        padding: "14px 16px", borderRadius: "var(--radius-lg)",
        background: "var(--bg-raised)", border: `1px solid ${riskColor}44`,
      }}>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <ActivityIcon size={14} color={riskColor} />
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: riskColor }}>
            ML Analysis — {rec.zone_name}
          </span>
          <RiskBadge label={rec.risk_label} />
        </div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {rec.reason}
        </div>
        {/* Zone conditions that drove the ML result */}
        <div className="grid-3" style={{ gap: 8, marginTop: 12 }}>
          {[
            { label: "Rain", val: `${rec.quote.zone_conditions.rainfall_mm}mm`, icon: CloudRainIcon },
            { label: "AQI", val: String(rec.quote.zone_conditions.aqi), icon: ActivityIcon },
            { label: "Disruption", val: `${Math.round(rec.disruption_probability * 100)}%`, icon: AlertIcon },
          ].map(({ label, val, icon: Icon }) => (
            <div key={label} className="metric-card" style={{ padding: "8px 10px" }}>
              <div className="row" style={{ gap: 4, marginBottom: 2 }}>
                <Icon size={10} color="var(--text-tertiary)" />
                <div className="metric-label" style={{ fontSize: "0.5625rem" }}>{label}</div>
              </div>
              <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended plan card */}
      <div className="glass-brand" style={{ padding: "var(--space-md)" }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <ShieldIcon size={18} color="var(--brand-light)" />
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>Recommended Plan</span>
          <div className="badge badge-brand" style={{ marginLeft: "auto" }}>ML SELECTED</div>
        </div>

        <div className="row justify-between" style={{ marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.125rem" }}>{plan.policy_name}</div>
            {plan.risk_multiplier > 1 && (
              <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 2 }}>
                Base ₹{plan.base_premium_inr} × {plan.risk_multiplier}× risk = ₹{plan.quoted_premium_inr}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: "1.75rem", color: "var(--brand-light)", fontFamily: "var(--font-display)", lineHeight: 1 }}>
              ₹{plan.quoted_premium_inr}
            </div>
            <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>/week</div>
          </div>
        </div>

        {/* Key benefits */}
        <PlanFeatureRow yes label={`₹${plan.payout_per_disruption_inr} payout per disruption`} />
        <PlanFeatureRow yes label={`DAI trigger < ${(plan.dai_trigger_threshold * 100).toFixed(0)}% — broadest in ${plan.policy_name}`} />
        <PlanFeatureRow yes label={`Up to ${plan.max_claims_per_week} claims per week`} />
        <PlanFeatureRow yes={plan.supports_partial_disruption} label="Partial disruption payouts" />
        <PlanFeatureRow yes={plan.supports_community_claims} label="Community claim support" />
        <PlanFeatureRow yes={plan.waiting_period_days === 0} label={plan.waiting_period_days === 0 ? "Immediate coverage — no waiting period" : `${plan.waiting_period_days}-day waiting period`} />

        {/* How it triggers */}
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: "var(--radius-md)",
          background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)",
        }}>
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <InfoIcon size={12} color="var(--text-tertiary)" />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Auto-trigger conditions</span>
          </div>
          <div className="body-sm" style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}>
            Your zone DAI drops below {(plan.dai_trigger_threshold * 100).toFixed(0)}%
            — checked every 15 minutes automatically. No claim filing required.
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <LayersIcon size={14} color="var(--text-secondary)" />
          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>What happens next</span>
        </div>
        {[
          "Review the Terms & Conditions",
          "Pay your first weekly premium via Razorpay UPI",
          "Coverage activates immediately" + (plan.waiting_period_days > 0 ? ` after ${plan.waiting_period_days} days` : ""),
          "Payouts land in your UPI account automatically",
        ].map((s, i) => (
          <div key={i} className="row" style={{ gap: 10, padding: "5px 0" }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "var(--brand-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              fontSize: "0.625rem", fontWeight: 700, color: "var(--brand-light)",
            }}>{i + 1}</div>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{s}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={() => setStep("tc")} type="button" style={{ fontSize: "0.9375rem" }}>
        <ChevronRightIcon size={16} color="white" /> View Terms &amp; Continue
      </button>
      <button className="btn btn-ghost" onClick={() => router.back()} type="button">
        Cancel
      </button>
    </div>
  );
}
