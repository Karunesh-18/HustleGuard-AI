"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onboardRider, subscribeRiderToPolicy, signinRider, quotePolicy, getZones, getZoneLiveData } from "@/lib/api";
import { useRazorpay } from "@/hooks/useRazorpay";
import PlanSelector from "@/components/PlanSelector";
import GPSGate from "@/components/GPSGate";
import type { PolicyQuoteResponse, PolicyQuotedPlan, RiderOnboardRead, ZoneRead, ZoneLiveData } from "@/types";

// Static fallback in case the API is unreachable during onboarding
const FALLBACK_ZONES: ZoneRead[] = [
  { id: 1, name: "Koramangala", city: "Bangalore" },
  { id: 2, name: "HSR Layout", city: "Bangalore" },
  { id: 3, name: "Indiranagar", city: "Bangalore" },
  { id: 4, name: "Whitefield", city: "Bangalore" },
  { id: 5, name: "Electronic City", city: "Bangalore" },
  { id: 6, name: "Jayanagar", city: "Bangalore" },
  { id: 7, name: "MG Road", city: "Bangalore" },
  { id: 8, name: "Marathahalli", city: "Bangalore" },
  { id: 9, name: "BTm Layout", city: "Bangalore" },
  { id: 10, name: "Bellandur", city: "Bangalore" },
];

// Steps: 0=welcome  1=details  2=otp  3=choose-plan  4=success
type Step = 0 | 1 | 2 | 3 | 4;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="wizard-step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`wizard-step-dot ${i < current ? "done" : i === current ? "active" : ""}`}
          style={{ width: i === current ? 24 : 12, transition: "width 0.25s" }}
        />
      ))}
    </div>
  );
}

/** Returns a colour + label for a zone's live risk level */
function riskBadge(zoneName: string, liveData: ZoneLiveData[]): { label: string; color: string } | null {
  const z = liveData.find((d) => d.zone_name === zoneName);
  if (!z) return null;
  if (z.dai >= 0.7 || z.rainfall_mm >= 20) return { label: "High Risk", color: "var(--error)" };
  if (z.dai >= 0.4 || z.rainfall_mm >= 8) return { label: "Moderate", color: "var(--warning)" };
  return { label: "Safe", color: "var(--success)" };
}

// GPS is mandatory — wrap the wizard so location is captured at account creation.
function OnboardPageInner() {
  const router = useRouter();
  const { openCheckout, loading: payLoading, sdkBlocked } = useRazorpay();

  const [step, setStep] = useState<Step>(0);
  const [mode, setMode] = useState<"register" | "signin">("register");

  // Zone data from backend
  const [zones, setZones] = useState<ZoneRead[]>(FALLBACK_ZONES);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [liveData, setLiveData] = useState<ZoneLiveData[]>([]);

  // Registration form
  const [form, setForm] = useState({ name: "", phone: "", city: "Bangalore", home_zone: FALLBACK_ZONES[0].name });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sign-in form
  const [signinPhone, setSigninPhone] = useState("");

  // Plan selection (step 3)
  const [pendingRider, setPendingRider] = useState<RiderOnboardRead | null>(null);
  const [quote, setQuote] = useState<PolicyQuoteResponse | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PolicyQuotedPlan | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const updateForm = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Fetch real zones + live status on mount (fallback kept if API unavailable)
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getZones(), getZoneLiveData()]).then(([zonesResult, liveResult]) => {
      if (!mounted) return;
      if (zonesResult.status === "fulfilled" && zonesResult.value.length > 0) {
        setZones(zonesResult.value);
        setForm((p) => ({ ...p, home_zone: zonesResult.value[0].name }));
      }
      if (liveResult.status === "fulfilled") {
        setLiveData(liveResult.value);
      }
      setZonesLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // ── Step 1 → 2: OTP auto-advance ─────────────────────────────────────────
  const handleOtp = (v: string) => {
    setOtp(v);
    if (v.length === 4) setTimeout(() => setStep(2), 300);
  };

  // ── Step 2 → 3: Create rider, fetch ML quote ──────────────────────────────
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const rider = await onboardRider({
        name: form.name,
        email: `${form.phone.replace(/\D/g, "")}@rider.hustleguard.com`,
        city: form.city,
        home_zone: form.home_zone,
        reliability_score: 60,
      });
      setPendingRider(rider);
      // Fetch ML-adjusted pricing for their chosen zone
      setQuoteLoading(true);
      const q = await quotePolicy(form.home_zone, 60);
      setQuote(q);
      setSelectedPlan(q.plans.find((p) => p.policy_name === "Standard Guard") ?? q.plans[1]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed. Try again.");
      return;
    } finally {
      setLoading(false);
      setQuoteLoading(false);
    }
    setStep(3);
  };

  // ── Step 3 → 4: Pay for selected plan, then subscribe ────────────────────
  const handlePayAndActivate = async () => {
    if (!pendingRider || !selectedPlan) return;
    setError(null);

    if (sdkBlocked) {
      setLoading(true);
      try {
        await subscribeRiderToPolicy(pendingRider.id, selectedPlan.policy_name, true);
        localStorage.setItem("hg_rider", JSON.stringify(pendingRider));
        setStep(4);
        setTimeout(() => router.push("/home"), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Activation failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const result = await openCheckout({
      amount_inr: selectedPlan.quoted_premium_inr,
      rider_id: pendingRider.id,
      purpose: "premium",
      policy_name: selectedPlan.policy_name,
      name: pendingRider.name,
      description: `${selectedPlan.policy_name} — weekly premium (${quote?.zone_name})`,
    });

    if (!result.success) {
      setError(`Payment failed: ${result.error}`);
      return;
    }

    // Payment verified — subscribe rider to chosen plan (waive waiting period after payment)
    setLoading(true);
    try {
      await subscribeRiderToPolicy(pendingRider.id, selectedPlan.policy_name, true);
      localStorage.setItem("hg_rider", JSON.stringify(pendingRider));
      setStep(4);
      setTimeout(() => router.push("/home"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed. Contact support.");
    } finally {
      setLoading(false);
    }
  };

  // ── Demo bypass: skip payment entirely (for test/demo environments) ────────
  // Razorpay test mode does not allow real UPI or card payments.
  // This path subscribes the rider directly with the waiting period waived.
  const handleDemoActivate = async () => {
    if (!pendingRider || !selectedPlan) return;
    setError(null);
    setLoading(true);
    try {
      await subscribeRiderToPolicy(pendingRider.id, selectedPlan.policy_name, true);
      localStorage.setItem("hg_rider", JSON.stringify(pendingRider));
      setStep(4);
      setTimeout(() => router.push("/home"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Sign-in ───────────────────────────────────────────────────────────────
  const handleSignin = async () => {
    if (signinPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rider = await signinRider(signinPhone);
      localStorage.setItem("hg_rider", JSON.stringify(rider));
      router.push("/home");
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) {
        setError("No account found. Register using 'Get Protected'.");
      } else {
        setError(e instanceof Error ? e.message : "Sign in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Currently selected zone's live risk badge
  const selectedBadge = riskBadge(form.home_zone, liveData);

  return (
    <div className="wizard-page">
      <div className="wizard-container animate-in">

        {/* ── Step 0: Welcome ─────────────────────────────────────────────── */}
        {step === 0 && mode === "register" && (
          <div className="wizard-body" style={{ justifyContent: "center", textAlign: "center", paddingTop: 52 }}>
            <div style={{ fontSize: 72, marginBottom: 6 }}>🛡️</div>
            <div className="display-lg" style={{ marginBottom: 6 }}>HustleGuard</div>
            <div className="body-lg" style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
              Income protection for gig workers.{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>Automatic payouts</span>{" "}
              when disruptions stop you working.
            </div>
            <div className="stack" style={{ gap: 8, marginBottom: 24 }}>
              {[
                { e: "⚡", t: "Instant payouts during floods & curfews" },
                { e: "🤖", t: "ML-powered pricing — adapts to zone risk" },
                { e: "📍", t: "3 coverage tiers — you choose what fits" },
              ].map(({ e, t }) => (
                <div key={t} className="card-raised" style={{ textAlign: "left", fontSize: "0.875rem", color: "var(--text-secondary)", padding: "9px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 18 }}>{e}</span>{t}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => setStep(1)} type="button" style={{ fontSize: "1rem", padding: "14px 0" }}>
              Get Protected
            </button>
            <div style={{ marginTop: 16, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              Already registered?{" "}
              <span style={{ color: "var(--brand-light)", cursor: "pointer", fontWeight: 600 }}
                onClick={() => { setMode("signin"); setError(null); }}>
                Sign in
              </span>
            </div>
          </div>
        )}

        {/* ── Sign-in mode ────────────────────────────────────────────────── */}
        {step === 0 && mode === "signin" && (
          <div className="wizard-body" style={{ justifyContent: "center", paddingTop: 40 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
              <div className="display-sm" style={{ marginBottom: 6 }}>Welcome back</div>
              <div className="body-md" style={{ color: "var(--text-secondary)" }}>
                Enter your registered number to restore your session
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                type="tel" inputMode="numeric"
                value={signinPhone}
                onChange={(e) => { setSigninPhone(e.target.value); setError(null); }}
                placeholder="9876543210"
                autoFocus
                style={{ fontSize: "1.1rem", letterSpacing: 2, textAlign: "center" }}
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button
              className="btn btn-primary" type="button"
              disabled={loading || signinPhone.replace(/\D/g, "").length < 10}
              onClick={handleSignin}
              style={{ marginTop: 8, padding: "14px 0" }}
            >
              {loading ? <><span className="spinner" /> Signing in…</> : "Sign In"}
            </button>
            <button className="btn btn-ghost" type="button"
              onClick={() => { setMode("register"); setError(null); setSigninPhone(""); }}
              style={{ marginTop: 8 }}>
              ← New user? Get Protected
            </button>
          </div>
        )}

        {/* ── Step 1: Details ─────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <StepDots current={0} total={3} />
            <div className="display-sm" style={{ marginBottom: 4 }}>Your profile</div>
            <div className="body-md" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Takes 30 seconds</div>
            <div className="wizard-body">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Rahul Kumar" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} placeholder="9876543210" />
              </div>

              {/* ── Zone selector ─────────────────────────────────────────── */}
              <div className="form-group">
                <label className="form-label">Home Zone</label>

                {zonesLoading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: "var(--radius-md)" }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {zones.map((z) => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => updateForm("home_zone", z.name)}
                        style={{
                          padding: "16px 14px",
                          textAlign: "center",
                          borderRadius: "var(--radius-md)",
                          border: form.home_zone === z.name ? "2px solid var(--brand)" : "2px solid var(--border)",
                          background: form.home_zone === z.name ? "var(--bg-raised)" : "transparent",
                          color: "var(--text-primary)",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: form.home_zone === z.name ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (form.home_zone !== z.name) {
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand-light)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (form.home_zone !== z.name) {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                          }
                        }}
                      >
                        📍 {z.name}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 12 }}>
                  Your zone determines ML-adjusted pricing and payout eligibility.
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}
              <button className="btn btn-primary" style={{ marginTop: "auto", padding: "14px 0" }}
                onClick={() => {
                  if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 10) {
                    setError("Please enter your name and a 10-digit phone number.");
                    return;
                  }
                  setError(null); setStep(2);
                }}
                type="button">
                Continue
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: OTP ─────────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <StepDots current={1} total={3} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📱</div>
              <div className="display-sm" style={{ marginBottom: 6 }}>Verify your phone</div>
              <div className="body-md" style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
                Code sent to +91 {form.phone}
              </div>
              <input
                autoFocus type="text" inputMode="numeric" maxLength={4}
                value={otp}
                onChange={(e) => handleOtp(e.target.value.replace(/\D/g, ""))}
                style={{
                  fontSize: 36, letterSpacing: 18, textAlign: "center",
                  width: 180, padding: "12px 20px",
                  background: "var(--bg-raised)", border: "2px solid var(--brand)",
                  borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none",
                }}
                placeholder="0000"
              />
              <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 14, fontStyle: "italic" }}>
                Demo — any 4 digits accepted
              </div>
            </div>
            {error && <div className="form-error" style={{ textAlign: "center" }}>{error}</div>}
            <button className="btn btn-primary" style={{ padding: "14px 0" }}
              onClick={handleVerifyOtp}
              disabled={otp.length < 4 || loading}
              type="button">
              {loading ? <><span className="spinner" /> Creating account…</> : "Verify & Continue"}
            </button>
          </>
        )}

        {/* ── Step 3: Choose Plan ─────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <StepDots current={2} total={3} />
            <div className="display-sm" style={{ marginBottom: 2 }}>Choose your plan</div>
            <div className="body-md" style={{ color: "var(--text-secondary)", marginBottom: 14 }}>
              Prices adjust to your zone&apos;s live disruption risk
            </div>

            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
              {quoteLoading || !quote ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: "var(--radius-lg)" }} />
                  ))}
                </div>
              ) : (
                <PlanSelector
                  quote={quote}
                  selectedPlan={selectedPlan?.policy_name ?? null}
                  onSelect={setSelectedPlan}
                />
              )}
            </div>

            {/* ── Test mode info banner ─────────────────────────────────── */}
            <div style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              marginTop: 4,
              fontSize: "0.8rem",
              color: "var(--brand-light)",
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🧪 Test Mode — Razorpay</div>
              <div style={{ color: "var(--text-secondary)" }}>
                UPI &amp; real cards don&apos;t work in test mode. Use test card:
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", margin: "0 4px" }}>4111 1111 1111 1111</span>
                · CVV: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>111</span>
                · Expiry: any future date. Or use
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", margin: "0 4px" }}>success@razorpay</span>
                for test UPI.
              </div>
            </div>

            {sdkBlocked && (
              <div className="warning-banner" style={{ marginTop: 4 }}>
                ⚠️ Razorpay blocked by ad-blocker — use the demo activate button below.
              </div>
            )}

            {error && <div className="form-error" style={{ textAlign: "center" }}>{error}</div>}

            {/* Primary: open Razorpay */}
            <button
              className="btn btn-primary"
              type="button"
              disabled={!selectedPlan || payLoading || loading || quoteLoading}
              onClick={handlePayAndActivate}
              style={{ padding: "14px 0" }}
            >
              {(payLoading || loading)
                ? <><span className="spinner" /> Processing…</>
                : selectedPlan
                  ? <>Pay ₹{selectedPlan.quoted_premium_inr} · Activate {selectedPlan.policy_name}</>
                  : "Select a plan to continue"}
            </button>

            {/* Secondary: demo bypass — skip Razorpay entirely */}
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!selectedPlan || loading || quoteLoading}
              onClick={handleDemoActivate}
              style={{ marginTop: 6, fontSize: "0.8125rem" }}
            >
              ⚡ Demo — Activate without payment
            </button>
          </>
        )}

        {/* ── Step 4: Success ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 72 }}>✅</div>
            <div className="display-md" style={{ marginTop: 18 }}>You&apos;re Protected</div>
            <div className="body-md" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{selectedPlan?.policy_name}</span> is active
              for {form.home_zone}.
            </div>
            <div style={{ marginTop: 10, fontSize: "0.8125rem", color: "var(--brand-light)", fontWeight: 600 }}>
              ₹{selectedPlan?.payout_per_disruption_inr} per disruption event
            </div>
            <div className="spinner" style={{ marginTop: 28 }} />
          </div>
        )}

      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <GPSGate context="app_open">
      <OnboardPageInner />
    </GPSGate>
  );
}
