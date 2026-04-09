"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRiderPolicy, quotePolicy, getRiderClaims, getRecentPayouts, subscribeRiderToPolicy } from "@/lib/api";
import type { RiderPolicyRead, PolicyQuoteResponse, ClaimRead, PayoutEventRead, PolicyQuotedPlan } from "@/types";
import { useRazorpay } from "@/hooks/useRazorpay";
import PlanSelector from "@/components/PlanSelector";
import {
  UserIcon, MapPinIcon, ShieldIcon, ZapIcon, ActivityIcon,
  CreditCardIcon, BanknoteIcon, CheckIcon, ChevronRightIcon,
  LogOutIcon, ClockIcon, InfoIcon, LayersIcon,
} from "@/components/Icon";

type Rider = { id?: number; name?: string; home_zone?: string; reliability_score?: number };



function StatusRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="row justify-between" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="body-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: "0.875rem", color: accent ? "var(--accent)" : "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [rider, setRider] = useState<Rider | null>(null);
  const [policy, setPolicy] = useState<RiderPolicyRead | null>(null);
  const [quote, setQuote] = useState<PolicyQuoteResponse | null>(null);
  const [claims, setClaims] = useState<ClaimRead[]>([]);
  const [payoutEvents, setPayoutEvents] = useState<PayoutEventRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"coverage" | "payouts" | "payment">("coverage");
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string } | null>(null);
  // Change-plan state
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<PolicyQuotedPlan | null>(null);
  const [planChangeResult, setPlanChangeResult] = useState<{ success: boolean; message: string } | null>(null);
  const { loading: payLoading, sdkBlocked, openCheckout } = useRazorpay();

  useEffect(() => {
    const raw = localStorage.getItem("hg_rider");
    if (!raw) { router.replace("/onboard"); return; }
    try {
      const r = JSON.parse(raw) as Rider;
      setRider(r);
      const fetches: Promise<void>[] = [];
      if (r.id) {
        fetches.push(getRiderPolicy(r.id).then((p) => { if (p) setPolicy(p); }).catch(() => {}));
        fetches.push(getRiderClaims(r.id).then(setClaims).catch(() => {}));
      }
      if (r.home_zone) {
        fetches.push(quotePolicy(r.home_zone, r.reliability_score ?? 60).then(setQuote).catch(() => {}));
      }
      // Always fetch zone payout events — shows disruption payouts from simulate-disruption
      fetches.push(getRecentPayouts().then(setPayoutEvents).catch(() => {}));
      Promise.allSettled(fetches).finally(() => setLoading(false));
    } catch {
      router.replace("/onboard");
    }
  }, [router]);

  const handleSignOut = () => {
    localStorage.removeItem("hg_rider");
    router.replace("/onboard");
  };

  /** Pay for a new plan then subscribe the rider to it. */
  const handleChangePlan = useCallback(async () => {
    if (!rider?.id || !selectedNewPlan || !quote) return;
    setPlanChangeResult(null);

    // Payment step (skip if Razorpay blocked)
    let payOk = sdkBlocked;
    if (!sdkBlocked) {
      const result = await openCheckout({
        amount_inr: selectedNewPlan.quoted_premium_inr,
        rider_id: rider.id,
        purpose: "premium",
        name: rider.name ?? "",
        description: `${selectedNewPlan.policy_name} — weekly premium (${quote.zone_name})`,
      });
      payOk = result.success;
      if (!result.success) {
        setPlanChangeResult({ success: false, message: `Payment failed: ${result.error}` });
        return;
      }
    }

    if (payOk) {
      try {
        await subscribeRiderToPolicy(rider.id, selectedNewPlan.policy_name);
        // Refresh policy
        if (rider.id) {
          const updated = await getRiderPolicy(rider.id);
          if (updated) setPolicy(updated);
        }
        setPlanChangeResult({ success: true, message: `Switched to ${selectedNewPlan.policy_name} ✓` });
        setChangingPlan(false);
        setSelectedNewPlan(null);
      } catch (e) {
        setPlanChangeResult({ success: false, message: e instanceof Error ? e.message : "Plan change failed." });
      }
    }
  }, [rider, selectedNewPlan, quote, sdkBlocked, openCheckout]);

  const activePlan = quote?.plans.find((p) => p.policy_name === policy?.policy_name) ?? quote?.plans[1];
  const riskColor = quote?.risk_label === "high" ? "var(--danger)" : quote?.risk_label === "moderate" ? "var(--warning)" : "var(--accent)";
  const instantClaims = claims.filter((c) => c.decision === "instant_payout").length;

  const handlePay = useCallback(async (amountInr: number, purpose: string) => {
    if (!rider?.id) return;
    setPaymentResult(null);
    const result = await openCheckout({
      amount_inr: amountInr,
      rider_id: rider.id,
      purpose,
      name: rider.name ?? "",
      description: purpose === "premium" ? `Weekly premium — ${activePlan?.policy_name}` : "HustleGuard payment",
    });
    setPaymentResult({ success: result.success, message: result.success ? result.message : result.error });
  }, [rider, activePlan, openCheckout]);

  return (
    <div className="p-md stack">
      <div style={{ paddingTop: 4 }}>
        <div className="display-sm">Profile</div>
      </div>

      {/* Rider card */}
      {rider && (
        <div className="glass-brand" style={{ padding: "var(--space-md)" }}>
          <div className="row" style={{ gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <UserIcon size={22} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{rider.name ?? "Rider"}</div>
              <div className="row" style={{ gap: 4, marginTop: 3 }}>
                <MapPinIcon size={13} color="var(--text-tertiary)" />
                <span className="body-sm" style={{ color: "var(--text-secondary)" }}>{rider.home_zone ?? "—"}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="label" style={{ color: "var(--text-tertiary)" }}>Reliability</div>
              <div style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
                {rider.reliability_score ?? 60}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="row" style={{ gap: 0, background: "var(--bg-raised)", borderRadius: "var(--radius-md)", padding: 3 }}>
        {(["coverage", "payouts", "payment"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "7px 0", borderRadius: "calc(var(--radius-md) - 2px)",
              background: tab === t ? "var(--bg-card)" : "transparent",
              border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
              fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.02em",
              transition: "all 0.15s", textTransform: "capitalize",
            }}
          >
            {t === "coverage" ? "Coverage" : t === "payouts" ? "Payouts" : "Payment"}
          </button>
        ))}
      </div>

      {/* ── COVERAGE tab ── */}
      {tab === "coverage" && (
        loading ? <div className="skeleton-shimmer" style={{ height: 220 }} /> :
        activePlan ? (
          <div className="stack">
            {/* Plan header */}
            <div className="card">
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <ShieldIcon size={18} color="var(--brand-light)" />
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>Active Coverage</span>
                <div className="badge badge-accent" style={{ marginLeft: "auto" }}>ACTIVE</div>
              </div>
              <div className="row justify-between" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--text-primary)" }}>
                    HustleGuard Protection
                  </div>
                  <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 2 }}>via {activePlan.policy_name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="display-sm" style={{ color: "var(--brand-light)" }}>₹{activePlan.quoted_premium_inr}</div>
                  <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>/week</div>
                </div>
              </div>

              {/* ML risk context */}
              {quote && (
                <div style={{
                  padding: "8px 12px", borderRadius: "var(--radius-md)",
                  background: "var(--bg-raised)", border: "1px solid var(--border)", marginBottom: 14,
                }}>
                  <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                    <ActivityIcon size={13} color={riskColor} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: riskColor }}>
                      {rider?.home_zone} — {quote.risk_label} risk zone
                    </span>
                  </div>
                  <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                    Rain {quote.zone_conditions.rainfall_mm}mm · AQI {quote.zone_conditions.aqi} · DAI {Math.round(quote.zone_conditions.dai * 100)}% · Disruption {Math.round(quote.disruption_probability * 100)}%
                  </div>
                </div>
              )}

            {/* Plan details metric strip */}
              <div className="grid-3" style={{ gap: 8 }}>
                {[
                  { label: "Payout", value: `₹${activePlan.payout_per_disruption_inr}` },
                  { label: "DAI trigger", value: `< ${activePlan.dai_trigger_threshold.toFixed(2)}` },
                  { label: "Max claims", value: `${activePlan.max_claims_per_week}/wk` },
                ].map(({ label, value }) => (
                  <div key={label} className="metric-card" style={{ padding: "8px 10px", gap: 2 }}>
                    <div className="metric-label" style={{ fontSize: "0.5625rem" }}>{label}</div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Change plan button */}
              {!changingPlan && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => { setChangingPlan(true); setPlanChangeResult(null); setSelectedNewPlan(null); }}
                  style={{ marginTop: 6, fontSize: "0.875rem", padding: "10px 0" }}
                >
                  <LayersIcon size={15} color="var(--brand-light)" /> Change Coverage Plan
                </button>
              )}
            </div>

            {/* ── Inline Plan Change ── */}
            {changingPlan && quote && (
              <div className="card">
                <div className="row justify-between" style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Choose a new plan</div>
                  <button type="button" onClick={() => { setChangingPlan(false); setSelectedNewPlan(null); setPlanChangeResult(null); }}
                    style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "0.8125rem" }}>
                    ✕ Cancel
                  </button>
                </div>

                <PlanSelector
                  quote={quote}
                  currentPolicyName={policy?.policy_name}
                  selectedPlan={selectedNewPlan?.policy_name ?? null}
                  onSelect={setSelectedNewPlan}
                />

                {planChangeResult && (
                  <div style={{
                    marginTop: 10, padding: "10px 12px", borderRadius: "var(--radius-md)",
                    background: planChangeResult.success ? "rgba(6,214,160,0.08)" : "rgba(239,68,68,0.08)",
                    border: `1px solid ${planChangeResult.success ? "var(--accent)" : "var(--danger)"}`,
                    fontSize: "0.8125rem", fontWeight: 600,
                    color: planChangeResult.success ? "var(--accent)" : "var(--danger)",
                  }}>
                    {planChangeResult.message}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!selectedNewPlan || selectedNewPlan.policy_name === policy?.policy_name || payLoading}
                  onClick={handleChangePlan}
                  style={{ marginTop: 12, padding: "13px 0", fontSize: "0.9rem" }}
                >
                  {payLoading
                    ? <><span className="spinner" /> Processing…</>
                    : selectedNewPlan && selectedNewPlan.policy_name !== policy?.policy_name
                      ? <>Pay ₹{selectedNewPlan.quoted_premium_inr} · Switch to {selectedNewPlan.policy_name}</>
                      : "Select a different plan to switch"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="stack">
            {/* No policy — prominent enrollment CTA */}
            <div style={{
              padding: "var(--space-md)",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, rgba(91,33,182,0.15) 0%, rgba(6,214,160,0.08) 100%)",
              border: "1px solid var(--brand-border)",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShieldIcon size={26} color="white" />
                </div>
              </div>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "1.0625rem", marginBottom: 6 }}>Not yet protected</div>
                <div className="body-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Get your personalised coverage plan — our ML model analyses your zone's live disruption risk
                  and reliability score to allocate the right plan automatically.
                </div>
              </div>
              {/* Preview bullets */}
              <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
                {[
                  "Automatic payouts — no claim forms",
                  "Zone DAI-triggered coverage",
                  "Premium priced by real-time ML risk",
                  "UPI payout in seconds via Razorpay",
                ].map((s) => (
                  <div key={s} className="row" style={{ gap: 8 }}>
                    <CheckIcon size={13} color="var(--accent)" />
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{s}</span>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => router.push("/apply")}
                style={{ fontSize: "0.9375rem", width: "100%" }}
              >
                <LayersIcon size={16} color="white" /> Get My Coverage Plan
              </button>
            </div>

            {/* What our ML looks at */}
            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <ActivityIcon size={14} color="var(--text-secondary)" />
                <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>How your plan is selected</span>
              </div>
              {[
                ["Zone risk (live ML)", "Real-time disruption probability for " + (rider?.home_zone ?? "your zone")],
                ["Reliability score", `Your score of ${rider?.reliability_score ?? 60} may upgrade your tier`],
                ["Claim history", "Recent activity adjusts plan breadth automatically"],
              ].map(([title, desc]) => (
                <div key={title as string} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{title}</div>
                  <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── PAYOUTS tab ── */}
      {tab === "payouts" && (
        <div className="stack">
          <div className="grid-2">
            <div className="metric-card">
              <div className="metric-label">Total Claims</div>
              <div className="metric-value">{loading ? "—" : claims.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Instant Payouts</div>
              <div className="metric-value" style={{ color: "var(--accent)" }}>{loading ? "—" : instantClaims}</div>
            </div>
          </div>

          {/* Zone disruption payout events (from simulate-disruption + parametric triggers) */}
          {payoutEvents.length > 0 && (
            <div className="card">
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <ZapIcon size={14} color="var(--accent)" />
                <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>Zone Disruption Events</span>
                <div className="badge badge-accent" style={{ marginLeft: "auto", fontSize: "0.5625rem" }}>LIVE</div>
              </div>
              <div className="body-sm" style={{ color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.5 }}>
                Automatic payouts triggered by verified zone-wide disruptions. All eligible riders receive these.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {payoutEvents.slice(0, 5).map((ev, i) => (
                  <div key={ev.id} style={{
                    padding: "10px 0",
                    borderBottom: i < Math.min(payoutEvents.length, 5) - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--accent)", flexShrink: 0, marginTop: 5,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{ev.zone_name}</div>
                      <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>{ev.trigger_reason}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--accent)" }}>₹{ev.payout_amount_inr}</div>
                      <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>{ev.eligible_riders} riders</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal claims history */}
          {loading ? (
            <div className="skeleton-shimmer" style={{ height: 200 }} />
          ) : claims.length === 0 ? (
            <div className="empty-state">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <BanknoteIcon size={36} color="var(--text-tertiary)" />
              </div>
              <div className="empty-title">No personal claims yet</div>
              <div className="empty-body">Submit a panic button claim from the Claims tab</div>
            </div>
          ) : (
            <div>
              <div className="label" style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>Your Claims</div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {claims.slice(0, 10).map((c, i) => {
                  const isInstant = c.decision === "instant_payout";
                  const isProvisional = c.decision === "provisional_payout_with_review";
                  const statusColor = isInstant ? "var(--accent)" : isProvisional ? "var(--warning)" : "var(--text-tertiary)";
                  return (
                    <div key={c.id} style={{
                      padding: "12px 14px",
                      borderBottom: i < claims.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: isInstant ? "var(--accent-muted)" : "var(--bg-raised)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isInstant ? <ZapIcon size={16} color="var(--accent)" /> : <ClockIcon size={16} color="var(--text-tertiary)" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", textTransform: "capitalize" }}>
                          {c.claim_type.replace(/_/g, " ")}
                        </div>
                        <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                          {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: statusColor }}>
                          {c.decision.replace(/_/g, " ")}
                        </div>
                        <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                          Score: {Math.round(c.trust_score)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENT tab ── */}
      {tab === "payment" && (
        <div className="stack">

          {/* Payment result feedback */}
          {paymentResult && (
            <div style={{
              padding: "12px 14px", borderRadius: "var(--radius-md)",
              background: paymentResult.success ? "rgba(6,214,160,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${paymentResult.success ? "var(--accent)" : "var(--danger)"}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <CheckIcon size={16} color={paymentResult.success ? "var(--accent)" : "var(--danger)"} />
              <span style={{ fontSize: "0.875rem", fontWeight: 600,
                color: paymentResult.success ? "var(--accent)" : "var(--danger)" }}>
                {paymentResult.message}
              </span>
            </div>
          )}

          {/* Pay premium card */}
          {activePlan && (
            <div className="glass-brand" style={{ padding: "var(--space-md)" }}>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <ShieldIcon size={16} color="var(--brand-light)" />
                <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Pay Weekly Premium</span>
              </div>
              <div className="row justify-between" style={{ marginBottom: 14 }}>
                <div className="body-sm" style={{ color: "var(--text-secondary)" }}>
                  {activePlan.policy_name} — renews weekly
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--brand-light)", fontFamily: "var(--font-display)" }}>
                  ₹{activePlan.quoted_premium_inr}
                </div>
              </div>
              <button
                className="btn btn-primary"
                type="button"
                disabled={payLoading}
                onClick={() => handlePay(activePlan.quoted_premium_inr, "premium")}
                style={{ fontSize: "0.9rem" }}
              >
                {payLoading
                  ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Processing…</>
                  : <><ZapIcon size={16} color="white" /> Pay ₹{activePlan.quoted_premium_inr} via Razorpay</>}
              </button>
            </div>
          )}

          {/* Payout info */}
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <BanknoteIcon size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Payout Account</span>
            </div>
            <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
              Payouts are processed automatically via Razorpay to the UPI ID or
              bank account you used when paying your premium. No separate setup needed.
            </div>
            <div style={{
              padding: "12px 14px", borderRadius: "var(--radius-md)",
              background: "var(--accent-muted)", border: "1px solid var(--accent-border)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius-md)",
                background: "rgba(6,214,160,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <ZapIcon size={18} color="var(--accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--accent)" }}>Razorpay UPI</div>
                <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                  Linked during premium payment
                </div>
              </div>
              <CheckIcon size={16} color="var(--accent)" />
            </div>
          </div>

          {/* Add new method — opens Razorpay */}
          <div className="card" style={{ border: "1px solid var(--border-md)" }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <CreditCardIcon size={16} color="var(--brand-light)" />
              <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Add Payment Method</span>
            </div>
            <div className="body-sm" style={{ color: "var(--text-tertiary)", marginBottom: 12 }}>
              Link a UPI ID, bank account, or debit card. Powered by Razorpay.
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={payLoading}
              onClick={() => handlePay(1, "account_link")}
              style={{ fontSize: "0.875rem", padding: "11px 0" }}
            >
              {payLoading
                ? <><span className="spinner" /> Opening Razorpay…</>
                : <><CreditCardIcon size={15} color="var(--text-primary)" /> Add UPI / Bank Account</>}
            </button>
            <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 8, textAlign: "center" }}>
              A ₹1 verification charge is collected and refunded within 24 hrs.
            </div>
          </div>

          {/* Billing summary */}
          {activePlan && (
            <div className="card" style={{ background: "var(--bg-raised)" }}>
              <StatusRow label="Plan" value={activePlan.policy_name} />
              <StatusRow label="Weekly Premium" value={`₹${activePlan.quoted_premium_inr}`} />
              <StatusRow label="Billing" value="Auto-renewal via UPI" accent />
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <div style={{ marginTop: "auto", paddingTop: "var(--space-sm)" }}>
        <button
          className="btn btn-ghost"
          onClick={handleSignOut}
          type="button"
          style={{ width: "100%", gap: 8 }}
        >
          <LogOutIcon size={16} color="var(--text-secondary)" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
