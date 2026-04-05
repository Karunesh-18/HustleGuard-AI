"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onboardRider, subscribeRiderToPolicy } from "@/lib/api";

const ZONES = ["Koramangala", "HSR Layout", "Indiranagar", "Whitefield", "Electronic City"];

type Step = 0 | 1 | 2 | 3;

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="wizard-step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`wizard-step-dot ${i < step ? "done" : i === step ? "active" : ""}`}
          style={{ width: i === step ? 24 : 12 }}
        />
      ))}
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState({ name: "", phone: "", city: "Bangalore", home_zone: ZONES[0] });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateForm = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleOtp = (v: string) => {
    setOtp(v);
    if (v.length === 4) setTimeout(() => setStep(2), 200);
  };

  const handleComplete = async () => {
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
      // Removed auto-subscribe so rider goes to Home "Not Protected" state 
      // and proceeds through the Razorpay Premium flow.
      localStorage.setItem("hg_rider", JSON.stringify(rider));
      setStep(3);
      setTimeout(() => router.push("/home"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard-page">
      <div className="wizard-container animate-in">

        {/* ── Step 0: Welcome ─── */}
        {step === 0 && (
          <div className="wizard-body" style={{ justifyContent: "center", textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 80, marginBottom: 8 }}>🛡️</div>
            <div className="display-lg" style={{ marginBottom: 8 }}>HustleGuard</div>
            <div className="body-lg" style={{ color: "var(--text-secondary)", marginBottom: 40 }}>
              Income protection for gig workers.<br />
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>Automatic payouts</span> when disruptions stop you working.
            </div>

            <div className="stack" style={{ gap: 10, marginBottom: 24 }}>
              {["⚡ Instant payouts during floods & curfews", "🤖 ML-powered risk pricing", "📍 Zone-based coverage — Bangalore"].map((f) => (
                <div key={f} className="card-raised" style={{ textAlign: "left", fontSize: "0.875rem", color: "var(--text-secondary)", padding: "10px 14px" }}>
                  {f}
                </div>
              ))}
            </div>

            <button className="btn btn-primary" onClick={() => setStep(1)} type="button" style={{ fontSize: "1rem", padding: "14px 0" }}>
              Get Protected
            </button>
            <div style={{ marginTop: 16, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              Already registered? <span style={{ color: "var(--brand-light)", cursor: "pointer" }} onClick={() => router.push("/home")}>Sign in</span>
            </div>
          </div>
        )}

        {/* ── Step 1: Details ─── */}
        {step === 1 && (
          <>
            <StepDots step={1} total={3} />
            <div className="display-sm" style={{ marginBottom: 4 }}>Create your profile</div>
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
              <div className="form-group">
                <label className="form-label">Home Zone</label>
                <select className="form-input" value={form.home_zone} onChange={(e) => updateForm("home_zone", e.target.value)}>
                  {ZONES.map((z) => <option key={z}>{z}</option>)}
                </select>
              </div>
              {error && <div className="form-error">{error}</div>}
              <button className="btn btn-primary" style={{ marginTop: "auto", padding: "14px 0" }}
                onClick={() => {
                  if (!form.name.trim() || form.phone.trim().length < 10) {
                    setError("Please fill in your name and a 10-digit phone number.");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                type="button"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: OTP ─── */}
        {step === 2 && (
          <>
            <StepDots step={2} total={3} />
            <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
              <div className="display-sm" style={{ marginBottom: 6 }}>Verify your phone</div>
              <div className="body-md" style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
                Code sent to +91 {form.phone}
              </div>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={otp}
                onChange={(e) => handleOtp(e.target.value.replace(/\D/g, ""))}
                style={{
                  fontSize: 36, letterSpacing: 18, textAlign: "center",
                  width: 180, padding: "12px 20px",
                  background: "var(--bg-raised)", border: "2px solid var(--brand)",
                  borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none",
                  display: "block",
                }}
                placeholder="0000"
              />
              <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 16, fontStyle: "italic" }}>
                Demo mode — any 4 digits accepted
              </div>
              <div style={{ marginTop: 12, fontSize: "0.8125rem", color: "var(--brand-light)", cursor: "pointer" }}>
                Resend code
              </div>
            </div>
            <button className="btn btn-primary" style={{ padding: "14px 0" }}
              onClick={handleComplete}
              disabled={otp.length < 4 || loading}
              type="button"
            >
              {loading ? <><span className="spinner" />Activating…</> : "Activate Protection"}
            </button>
          </>
        )}

        {/* ── Step 3: Success ─── */}
        {step === 3 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 80 }}>✅</div>
            <div className="display-md" style={{ marginTop: 20 }}>You&apos;re Protected</div>
            <div className="body-md" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>HustleGuard Protection</span> is now active for {form.home_zone}.
            </div>
            <div className="spinner" style={{ marginTop: 32 }} />
          </div>
        )}

      </div>
    </div>
  );
}
