"use client";

import { useState } from "react";
import type { RiderOnboardRead, RiderPolicyRead } from "@/types";

type Step = 0 | 1 | 2;

const STEPS = ["Profile", "Choose Plan", "Coverage Active"] as const;

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
  const [form, setForm] = useState({ name: "", email: "", city: "", home_zone: "Koramangala" });
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateForm = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleOnboard = async () => {
    setError(null);
    if (!form.name || !form.email || !form.city) {
      setError("Please fill in all fields");
      return;
    }
    try {
      await onOnboard(form);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) { setError("Pick a plan first"); return; }
    setError(null);
    try {
      await onSubscribe(selectedPlan);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    }
  };

  return (
    <div className="wizard">
      {/* Step indicators */}
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`wizard-step${step >= i ? " done" : ""}${step === i ? " active" : ""}`}>
            <div className="wizard-step-dot">
              {step > i ? "✓" : i + 1}
            </div>
            <div className="wizard-step-label">{s}</div>
            {i < STEPS.length - 1 && <div className="wizard-step-line" />}
          </div>
        ))}
      </div>

      {/* Step 0 — Profile */}
      {step === 0 && (
        <div className="wizard-body">
          <div className="wizard-title">Create your rider profile</div>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Rahul Kumar"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              placeholder="rahul@example.com"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                className="form-input"
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
                placeholder="Bangalore"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Home zone</label>
              <select
                className="form-input"
                value={form.home_zone}
                onChange={(e) => updateForm("home_zone", e.target.value)}
              >
                {["Koramangala", "HSR Layout", "Indiranagar", "Whitefield", "Electronic City"].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button
            className="btn-primary wizard-next"
            onClick={() => void handleOnboard()}
            disabled={loading}
            type="button"
          >
            {loading ? "Creating profile…" : "Continue →"}
          </button>
        </div>
      )}

      {/* Step 1 — Pick plan */}
      {step === 1 && (
        <div className="wizard-body">
          <div className="wizard-title">Choose your coverage tier</div>
          <div className="wizard-plans">
            {WIZARD_PLANS.map((p) => (
              <button
                key={p.name}
                className={`wizard-plan${selectedPlan === p.name ? " selected" : ""}`}
                onClick={() => setSelectedPlan(p.name)}
                type="button"
              >
                <div className="wizard-plan-name">{p.name}</div>
                <div className="wizard-plan-price">{p.price}<span>/wk</span></div>
                <ul className="wizard-plan-features">
                  {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
              </button>
            ))}
          </div>
          {error && <div className="form-error">{error}</div>}
          <button
            className="btn-primary wizard-next"
            onClick={() => void handleSubscribe()}
            disabled={loading || !selectedPlan}
            type="button"
          >
            {loading ? "Subscribing…" : "Activate Coverage →"}
          </button>
        </div>
      )}

      {/* Step 2 — Done */}
      {step === 2 && (
        <div className="wizard-body wizard-done">
          <div className="wizard-done-icon">🛡️</div>
          <div className="wizard-title">You&apos;re covered!</div>
          <div className="wizard-done-sub">
            Your {selectedPlan} plan is now active. The system will automatically detect disruptions and trigger payouts. No action needed from you.
          </div>
        </div>
      )}
    </div>
  );
}

const WIZARD_PLANS = [
  {
    name: "Basic Shield",
    price: "₹20",
    features: ["₹300 per disruption", "2 claims/week", "DAI < 0.35 trigger"],
  },
  {
    name: "Standard Guard",
    price: "₹32",
    features: ["₹500 per disruption", "3 claims/week", "Partial payout", "24h appeal window"],
  },
  {
    name: "Premium Armor",
    price: "₹45",
    features: ["₹700 per disruption", "5 claims/week", "Widest DAI trigger (< 0.50)", "72h appeal window"],
  },
];
