"use client";

import { useState, useEffect } from "react";
import { quotePolicy } from "@/lib/api";
import type { PolicyQuoteResponse, PolicyQuotedPlan, RiderOnboardRead, RiderPolicyRead } from "@/types";

type Step = 0 | 1 | 2 | 3 | 4;

const POPULAR_PLAN = "Standard Guard";

const PLAN_DIFFERENTIATOR: Record<string, string> = {
  "Basic Shield":   "Instant basic cover — no waiting period required",
  "Standard Guard": "Best value — includes appeals & partial payouts",
  "Premium Armor":  "Widest trigger window — covers grey-zone disruptions",
};

// Risk badge config driven by ML risk_label
const RISK_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  normal:   { emoji: "🟢", label: "Calm zone — base pricing",     color: "var(--safe-dark)",    bg: "var(--safe-bg)" },
  moderate: { emoji: "🟡", label: "Moderate risk — +20% surcharge", color: "#8B6914",             bg: "#FFFBEA" },
  high:     { emoji: "🔴", label: "High disruption risk — +45%",  color: "var(--danger-dark)",  bg: "var(--danger-bg)" },
};

export function OnboardingWizard({
  onOnboard,
  onSubscribe,
  loading,
}: {
  onOnboard: (data: { name: string; email: string; city: string; home_zone: string }) => Promise<RiderOnboardRead>;
  onSubscribe: (plan: string) => Promise<RiderPolicyRead>;
  loading: boolean;
}) {
  const [step, setStep] = useState<Step>(0);
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState({ name: "", city: "", home_zone: "Koramangala" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ML quote data — replaces flat getPolicies()
  const [quote, setQuote] = useState<PolicyQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Fetch ML-driven quote whenever step 3 is reached or home_zone changes
  useEffect(() => {
    if (step !== 3) return;
    setQuoteLoading(true);
    setQuoteError(null);
    quotePolicy(form.home_zone, 60)
      .then(setQuote)
      .catch(() => setQuoteError("Could not load live pricing. Please try again."))
      .finally(() => setQuoteLoading(false));
  }, [step, form.home_zone]);

  // Re-quote when zone changes on step 3 (rider may change zone after going back)
  const updateForm = (k: keyof typeof form, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (k === "home_zone" && step === 3) {
      setQuote(null);
    }
  };

  const handleOTPChange = (val: string) => {
    setOtp(val);
    if (val.length === 4) setStep(3);
  };

  const handleOnboardAndSubscribe = async () => {
    setError(null);
    try {
      await onOnboard({
        name: form.name,
        email: `${phone.replace(/\D/g, "")}@rider.hustleguard.com`,
        city: form.city,
        home_zone: form.home_zone,
      });
      await onSubscribe(POPULAR_PLAN);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const riskCfg = quote ? (RISK_CONFIG[quote.risk_label] ?? RISK_CONFIG.normal) : null;
  const activePlan = quote?.plans.find((p) => p.policy_name === POPULAR_PLAN);

  return (
    <div className="wizard" style={{ maxWidth: 400, margin: "0 auto", padding: "12px 0" }}>

      {/* ── 0. Welcome ── */}
      {step === 0 && (
        <div style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🛡️</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.03em" }}>HustleGuard</div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 40 }}>
            Income protection for gig workers.
          </div>
          <button className="btn-primary" style={{ width: "100%", padding: 14, fontSize: 16 }} onClick={() => setStep(1)} type="button">
            Get Started
          </button>
          <div style={{ marginTop: 20, fontSize: 13, color: "var(--brand)", fontWeight: 500 }}>Already registered? Sign in.</div>
        </div>
      )}

      {/* ── 1. Basic Details ── */}
      {step === 1 && (
        <div className="wizard-body">
          <div className="wizard-title" style={{ fontSize: 24, marginBottom: 20 }}>Create Profile</div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Rahul Kumar" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={form.city} onChange={(e) => updateForm("city", e.target.value)} placeholder="Bangalore" />
          </div>
          <div className="form-group">
            <label className="form-label">Home Zone</label>
            <select className="form-input" value={form.home_zone} onChange={(e) => updateForm("home_zone", e.target.value)}>
              {["Koramangala", "HSR Layout", "Indiranagar", "Whitefield", "Electronic City"].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button
            className="btn-primary wizard-next"
            style={{ marginTop: 12, padding: 14, fontSize: 15 }}
            onClick={() => {
              if (!form.name || !phone || !form.city) setError("Please fill all fields");
              else { setError(null); setStep(2); }
            }}
            type="button"
          >
            Continue
          </button>
        </div>
      )}

      {/* ── 2. OTP ── */}
      {step === 2 && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div className="wizard-title" style={{ fontSize: 24 }}>Verify your phone</div>
          <div style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "10px 0 30px" }}>
            Enter the 4-digit code sent to +91 {phone}
          </div>
          <input
            autoFocus
            type="text"
            maxLength={4}
            value={otp}
            onChange={(e) => handleOTPChange(e.target.value)}
            style={{
              fontSize: 32, letterSpacing: 14, textAlign: "center",
              padding: "10px 20px", width: 180, borderRadius: 12,
              border: "2px solid var(--brand)", outline: "none",
              margin: "0 auto", background: "var(--bg-raised)",
              color: "var(--text-primary)", display: "block",
            }}
            placeholder="0000"
          />
          <div style={{ marginTop: 20, fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
            Demo mode — any 4 digits accepted
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--brand)", fontWeight: 500 }}>
            Resend code in 30s
          </div>
        </div>
      )}

      {/* ── 3. Auto-Assigned Plan — ML Quoted ── */}
      {step === 3 && (
        <div className="wizard-body">
          <div className="wizard-title" style={{ fontSize: 24, marginBottom: 4 }}>Your Dynamic Coverage</div>

          {/* Zone risk banner — driven by ML output */}
          {riskCfg && quote && !quoteLoading && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: riskCfg.bg, border: `1px solid ${riskCfg.color}`,
              borderRadius: 10, padding: "8px 12px", marginBottom: 16,
            }}>
              <span style={{ fontSize: 14 }}>{riskCfg.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: riskCfg.color }}>{form.home_zone} — {riskCfg.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  Rain {quote.zone_conditions.rainfall_mm}mm · AQI {quote.zone_conditions.aqi} · DAI {quote.zone_conditions.dai.toFixed(2)}
                  {" · "}Disruption prob {Math.round(quote.disruption_probability * 100)}%
                </div>
              </div>
            </div>
          )}

          {quoteLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 110, borderRadius: 16 }} />
              ))}
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                Running ML risk model for {form.home_zone}…
              </div>
            </div>
          ) : quoteError ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ color: "var(--danger)", marginBottom: 12, fontSize: 13 }}>{quoteError}</div>
              <button className="btn-secondary" onClick={() => { setQuoteError(null); setQuote(null); setQuoteLoading(true); quotePolicy(form.home_zone, 60).then(setQuote).catch(() => setQuoteError("Still unavailable.")).finally(() => setQuoteLoading(false)); }} type="button">
                Retry
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activePlan && (
                <div
                  key={activePlan.policy_name}
                  style={{
                    position: "relative",
                    padding: 16,
                    border: "2px solid var(--brand)",
                    borderRadius: 16,
                    background: "var(--brand-muted)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
                  }}
                >
                  <div style={{
                    position: "absolute", top: -11, right: 16,
                    background: "var(--brand)", color: "white",
                    fontSize: 10, fontWeight: 700, padding: "2px 10px",
                    borderRadius: 10, letterSpacing: 0.5,
                  }}>
                    RECOMMENDED FOR YOU
                  </div>

                  {/* Plan header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                        HustleGuard Protection
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {PLAN_DIFFERENTIATOR[activePlan.policy_name] ?? ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {/* Show base price as strikethrough when risk-adjusted */}
                      {activePlan.quoted_premium_inr !== activePlan.base_premium_inr && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "line-through", lineHeight: 1 }}>
                          ₹{activePlan.base_premium_inr}
                        </div>
                      )}
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--brand)", lineHeight: 1.1 }}>
                        ₹{activePlan.quoted_premium_inr}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>/week</div>
                    </div>
                  </div>

                  {/* Key details row */}
                  <div style={{
                    display: "flex", gap: 8, marginTop: 12,
                    padding: "8px 10px", background: "rgba(0,0,0,0.04)",
                    borderRadius: 8, fontSize: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "var(--text-tertiary)", marginBottom: 1 }}>Payout</div>
                      <div style={{ fontWeight: 700, color: "var(--brand)" }}>₹{activePlan.payout_per_disruption_inr}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "var(--text-tertiary)", marginBottom: 1 }}>DAI trigger</div>
                      <div style={{ fontWeight: 700 }}>&lt;{activePlan.dai_trigger_threshold.toFixed(2)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "var(--text-tertiary)", marginBottom: 1 }}>Claims/wk</div>
                      <div style={{ fontWeight: 700 }}>{activePlan.max_claims_per_week}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ML pricing footnote */}
          {quote && !quoteLoading && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 12 }}>
              💡 Prices are ML risk-adjusted for {form.home_zone} right now. Recalculate weekly.
            </div>
          )}

          {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}

          <button
            className="btn-primary"
            style={{
              width: "100%", marginTop: 16, padding: 14, fontSize: 15,
            }}
            onClick={() => void handleOnboardAndSubscribe()}
            disabled={loading || quoteLoading || !activePlan}
            type="button"
          >
            {loading ? "Activating…" : "Activate Protection"}
          </button>
        </div>
      )}

      {/* ── 4. Success ── */}
      {step === 4 && (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
          <div className="wizard-title" style={{ fontSize: 28, marginBottom: 8 }}>You&apos;re Protected</div>
          <div style={{
            width: "100%", background: "var(--bg-raised)", padding: 16,
            borderRadius: 16, margin: "24px 0", textAlign: "left",
          }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Active Plan</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>HustleGuard Protection</div>
            {activePlan && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                ₹{activePlan.payout_per_disruption_inr} per disruption · ₹{activePlan.quoted_premium_inr}/week
              </div>
            )}
            {quote?.risk_label && quote.risk_label !== "normal" && (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                {RISK_CONFIG[quote.risk_label]?.emoji} Risk-adjusted price for {form.home_zone}
              </div>
            )}
          </div>
          <button
            className="btn-primary"
            style={{ width: "100%", padding: 14, fontSize: 15 }}
            onClick={() => window.location.reload()}
            type="button"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
