"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRiderPolicy, quotePolicy, getRiderClaims } from "@/lib/api";
import type { RiderPolicyRead, PolicyQuoteResponse, ClaimRead } from "@/types";
import { useRazorpay } from "@/hooks/useRazorpay";
import {
  UserIcon, MapPinIcon, ShieldIcon, ZapIcon, ActivityIcon,
  CreditCardIcon, BanknoteIcon, CheckIcon, ChevronRightIcon,
  LogOutIcon, ClockIcon, InfoIcon, LayersIcon,
} from "@/components/Icon";

type Rider = { id?: number; name?: string; home_zone?: string; reliability_score?: number };

// ── Mock payment methods ─────────────────────────────────────────────────────
// Real integration would use Razorpay or Cashfree SDK
const PAYMENT_METHODS = [
  { id: "upi",  label: "UPI",           sub: "Linked via GPay",        icon: ZapIcon,        active: true },
  { id: "bank", label: "Bank Account",  sub: "ICICI **** 4321",        icon: BanknoteIcon,   active: false },
  { id: "card", label: "Debit Card",    sub: "Add a card",             icon: CreditCardIcon, active: false },
] as const;

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"coverage" | "payouts" | "payment">("coverage");
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string } | null>(null);
  const { loading: payLoading, openCheckout } = useRazorpay();

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
      Promise.allSettled(fetches).finally(() => setLoading(false));
    } catch {
      router.replace("/onboard");
    }
  }, [router]);

  const handleSignOut = () => {
    localStorage.removeItem("hg_rider");
    router.replace("/onboard");
  };

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

              {/* Plan details */}
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
            </div>

            {/* All 3 tiers comparison */}
            {quote && (
              <div className="card">
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  <InfoIcon size={16} color="var(--text-tertiary)" />
                  <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>All Policy Tiers</span>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {quote.plans.map((plan) => {
                    const isCurrent = plan.policy_name === (policy?.policy_name ?? "Standard Guard");
                    return (
                      <div key={plan.policy_name} style={{
                        padding: "12px 14px", borderRadius: "var(--radius-md)",
                        border: `1px solid ${isCurrent ? "var(--brand-border)" : "var(--border)"}`,
                        background: isCurrent ? "var(--brand-muted)" : "var(--bg-raised)",
                      }}>
                        <div className="row justify-between" style={{ marginBottom: 4 }}>
                          <div className="row" style={{ gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: isCurrent ? "var(--brand-light)" : "var(--text-primary)" }}>
                              {plan.policy_name}
                            </span>
                            {isCurrent && <div className="badge badge-brand" style={{ fontSize: "0.5625rem" }}>Current</div>}
                          </div>
                          <div className="row" style={{ gap: 2 }}>
                            <span style={{ fontWeight: 700, color: isCurrent ? "var(--brand-light)" : "var(--text-primary)", fontSize: "1rem" }}>₹{plan.quoted_premium_inr}</span>
                            <span className="body-sm" style={{ color: "var(--text-tertiary)" }}>/wk</span>
                          </div>
                        </div>
                        <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>
                          Payout ₹{plan.payout_per_disruption_inr} · DAI trigger &lt;{plan.dai_trigger_threshold.toFixed(2)} · {plan.max_claims_per_week} claims/wk
                          {plan.supports_partial_disruption && " · Partial claims"}
                          {plan.supports_community_claims && " · Community"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 10, textAlign: "center" }}>
                  Premiums adjusted based on {rider?.home_zone} zone risk
                </div>
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
          {loading ? (
            <div className="skeleton-shimmer" style={{ height: 200 }} />
          ) : claims.length === 0 ? (
            <div className="empty-state">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <BanknoteIcon size={36} color="var(--text-tertiary)" />
              </div>
              <div className="empty-title">No claims yet</div>
              <div className="empty-body">Submit your first claim from the Claims tab</div>
            </div>
          ) : (
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

          {/* Payout methods */}
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <BanknoteIcon size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Payout Account</span>
            </div>
            <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 14 }}>
              Payouts are sent here automatically when a disruption claim is approved.
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {([
                { id: "upi",  label: "UPI",          sub: "Linked via GPay",  icon: ZapIcon,       active: true },
                { id: "bank", label: "Bank Account", sub: "ICICI **** 4321",  icon: BanknoteIcon,  active: false },
                { id: "card", label: "Debit Card",   sub: "Add a card",       icon: CreditCardIcon,active: false },
              ] as const).map(({ id, label, sub, icon: Icon, active }) => (
                <div key={id} style={{
                  padding: "12px 14px", borderRadius: "var(--radius-md)",
                  border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
                  background: active ? "var(--accent-muted)" : "var(--bg-raised)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "var(--radius-md)",
                    background: active ? "rgba(6,214,160,0.15)" : "var(--bg-hover)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={18} color={active ? "var(--accent)" : "var(--text-secondary)"} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: active ? "var(--accent)" : "var(--text-primary)" }}>{label}</div>
                    <div className="body-sm" style={{ color: "var(--text-tertiary)" }}>{sub}</div>
                  </div>
                  {active
                    ? <CheckIcon size={16} color="var(--accent)" />
                    : <ChevronRightIcon size={16} color="var(--text-tertiary)" />}
                </div>
              ))}
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
