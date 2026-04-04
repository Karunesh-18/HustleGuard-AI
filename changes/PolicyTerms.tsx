"use client";

/**
 * PolicyTerms Component — HustleGuard AI
 *
 * Displays the full policy terms to riders including:
 * - What IS covered (weather, AQI, DAI drops)
 * - What is NOT covered (war, pandemic, terrorism, nuclear, govt orders)
 * - Coverage limits
 * - How to appeal exclusion decisions
 *
 * This was completely missing from the original frontend — riders had no way
 * to see what events were excluded, which is a regulatory requirement and
 * basic transparency obligation for any insurance product.
 *
 * Usage: Import and render inside the rider dashboard sidebar or a dedicated
 * "Policy" tab.
 */

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyExclusion = {
  category: string;
  severity: "absolute" | "conditional";
  title: string;
  description: string;
  reinsurer_required: boolean;
};

type PolicyTerms = {
  product_name: string;
  version: string;
  effective_date: string;
  covered_events: string[];
  exclusions: PolicyExclusion[];
  coverage_limits: Record<string, number>;
  appeal_process: string;
  regulator_note: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  absolute: { bg: "#FCEBEB", text: "#791F1F", border: "#E24B4A", label: "ABSOLUTE" },
  conditional: { bg: "#FAEEDA", text: "#633806", border: "#EF9F27", label: "CONDITIONAL" },
};

const CATEGORY_ICONS: Record<string, string> = {
  war: "⚔️",
  pandemic: "🦠",
  terrorism: "💥",
  nuclear: "☢️",
  government_order: "🏛️",
  force_majeure: "🌋",
  intentional: "🚫",
  pre_existing: "📋",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PolicyTerms() {
  const [terms, setTerms] = useState<PolicyTerms | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"covered" | "excluded" | "limits" | "appeal">("covered");

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/policy/terms`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load policy terms")))
      .then((data: PolicyTerms) => setTerms(data))
      .catch(() => setError("Could not load policy terms. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PolicySkeleton />;
  if (error || !terms) return <PolicyError message={error ?? "Unknown error"} />;

  return (
    <div className="pt-wrap">
      {/* Header */}
      <div className="pt-header">
        <div className="pt-logo">📜</div>
        <div>
          <div className="pt-title">{terms.product_name}</div>
          <div className="pt-meta">
            Version {terms.version} · Effective {new Date(terms.effective_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="pt-irdai-badge">IRDAI Compliant</div>
      </div>

      {/* Tab navigation */}
      <div className="pt-tabs">
        {(["covered", "excluded", "limits", "appeal"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pt-tab${activeSection === tab ? " active" : ""}`}
            onClick={() => setActiveSection(tab)}
          >
            {tab === "covered" && "✅ Covered Events"}
            {tab === "excluded" && "🚫 Exclusions"}
            {tab === "limits" && "💰 Coverage Limits"}
            {tab === "appeal" && "⚖️ Appeals"}
          </button>
        ))}
      </div>

      {/* Covered Events */}
      {activeSection === "covered" && (
        <div className="pt-section">
          <div className="pt-section-title">What This Policy Covers</div>
          <div className="pt-section-desc">
            Payouts are triggered automatically when any of these conditions are confirmed in your active zone.
          </div>
          <div className="pt-covered-list">
            {terms.covered_events.map((event, i) => (
              <div key={i} className="pt-covered-row">
                <div className="pt-check">✓</div>
                <div className="pt-covered-text">{event}</div>
              </div>
            ))}
          </div>
          <div className="pt-note">
            ℹ️ Payouts are fully automatic — no claim filing required. The AI system detects qualifying conditions and triggers payment within minutes.
          </div>
        </div>
      )}

      {/* Exclusions */}
      {activeSection === "excluded" && (
        <div className="pt-section">
          <div className="pt-section-title">Policy Exclusions</div>
          <div className="pt-section-desc">
            The following events are <strong>not covered</strong> under this policy. These exclusions are standard across all parametric insurance products and required by IRDAI regulations.
          </div>

          {/* Severity legend */}
          <div className="pt-legend">
            <div className="pt-legend-item">
              <span className="pt-sev-pill" style={{ background: "#FCEBEB", color: "#791F1F", border: "0.5px solid #E24B4A" }}>ABSOLUTE</span>
              <span>Always denied — no exceptions</span>
            </div>
            <div className="pt-legend-item">
              <span className="pt-sev-pill" style={{ background: "#FAEEDA", color: "#633806", border: "0.5px solid #EF9F27" }}>CONDITIONAL</span>
              <span>May be reviewed with evidence</span>
            </div>
          </div>

          <div className="pt-exclusions-list">
            {terms.exclusions.map((ex) => {
              const colors = SEVERITY_COLORS[ex.severity];
              const icon = CATEGORY_ICONS[ex.category] ?? "❌";
              return (
                <div key={ex.category} className="pt-exclusion-card" style={{ borderColor: colors.border }}>
                  <div className="pt-exc-header">
                    <span className="pt-exc-icon">{icon}</span>
                    <span className="pt-exc-title">{ex.title}</span>
                    <span className="pt-sev-pill" style={{ background: colors.bg, color: colors.text, border: `0.5px solid ${colors.border}` }}>
                      {colors.label}
                    </span>
                  </div>
                  <div className="pt-exc-desc">{ex.description}</div>
                  {ex.severity === "conditional" && (
                    <div className="pt-exc-appealable">
                      ⚖️ This exclusion may be appealed with supporting evidence
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Coverage Limits */}
      {activeSection === "limits" && (
        <div className="pt-section">
          <div className="pt-section-title">Coverage Limits</div>
          <div className="pt-section-desc">
            Maximum payouts and policy boundaries for the Weekly Shield plan.
          </div>
          <div className="pt-limits-grid">
            {Object.entries(terms.coverage_limits).map(([key, val]) => {
              const label = key
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
              const displayVal = key.includes("inr")
                ? `₹${val.toLocaleString("en-IN")}`
                : key.includes("hours")
                ? `${val} hours`
                : String(val);
              return (
                <div key={key} className="pt-limit-card">
                  <div className="pt-limit-label">{label}</div>
                  <div className="pt-limit-val">{displayVal}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appeal Process */}
      {activeSection === "appeal" && (
        <div className="pt-section">
          <div className="pt-section-title">How to Appeal a Decision</div>
          <div className="pt-section-desc">
            If your payout was blocked by a conditional exclusion, you have the right to appeal.
          </div>
          <div className="pt-appeal-steps">
            {[
              { step: "1", title: "Check eligibility", desc: "Only conditional (yellow) exclusions can be appealed. Absolute exclusions (war, pandemic, terrorism, nuclear) cannot be appealed." },
              { step: "2", title: "Gather evidence", desc: "Collect zone weather data, platform activity logs, and a written explanation showing how your loss relates to a qualifying trigger (not the excluded event)." },
              { step: "3", title: "Submit within 14 days", desc: "Email your appeal to support@hustleguard.ai with your Rider ID and the date of the denied event." },
              { step: "4", title: "Review within 5 days", desc: "Our Grievance Officer reviews all appeals within 5 business days and sends a written decision." },
            ].map((s) => (
              <div key={s.step} className="pt-appeal-step">
                <div className="pt-step-num">{s.step}</div>
                <div>
                  <div className="pt-step-title">{s.title}</div>
                  <div className="pt-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-contacts">
            <div className="pt-contact-row">📧 support@hustleguard.ai</div>
            <div className="pt-contact-row">⚖️ Grievance Officer: grievance@hustleguard.ai</div>
          </div>
          <div className="pt-regulator-note">{terms.regulator_note}</div>
        </div>
      )}

      <style>{`
        .pt-wrap { font-family: var(--font-sans, system-ui); color: var(--color-text-primary, #111827); background: var(--color-background-primary, #fff); border-radius: 12px; border: 0.5px solid var(--color-border-tertiary, #E8ECF0); overflow: hidden; }
        .pt-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: #085041; color: white; }
        .pt-logo { font-size: 24px; }
        .pt-title { font-size: 15px; font-weight: 600; }
        .pt-meta { font-size: 11px; opacity: 0.7; margin-top: 2px; }
        .pt-irdai-badge { margin-left: auto; background: rgba(255,255,255,0.15); border: 0.5px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 3px 10px; font-size: 10px; font-weight: 500; white-space: nowrap; }
        .pt-tabs { display: flex; border-bottom: 0.5px solid var(--color-border-tertiary, #E8ECF0); background: var(--color-background-secondary, #F6F7F9); }
        .pt-tab { flex: 1; padding: 10px 4px; font-size: 11px; font-weight: 500; color: var(--color-text-secondary, #4B5563); cursor: pointer; border: none; background: transparent; border-bottom: 2px solid transparent; transition: all 0.15s; font-family: inherit; }
        .pt-tab.active { color: #085041; border-bottom-color: #1D9E75; background: var(--color-background-primary, #fff); }
        .pt-section { padding: 20px; }
        .pt-section-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
        .pt-section-desc { font-size: 12px; color: var(--color-text-secondary, #4B5563); margin-bottom: 16px; line-height: 1.5; }
        .pt-covered-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .pt-covered-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: #EAF3DE; border-radius: 8px; border: 0.5px solid #639922; }
        .pt-check { color: #27500A; font-weight: 700; flex-shrink: 0; }
        .pt-covered-text { font-size: 12px; color: #27500A; line-height: 1.4; }
        .pt-note { font-size: 11px; color: var(--color-text-tertiary, #9CA3AF); background: var(--color-background-secondary, #F6F7F9); border-radius: 8px; padding: 10px 12px; }
        .pt-legend { display: flex; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
        .pt-legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-text-secondary, #4B5563); }
        .pt-sev-pill { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.05em; white-space: nowrap; }
        .pt-exclusions-list { display: flex; flex-direction: column; gap: 10px; }
        .pt-exclusion-card { border: 0.5px solid; border-radius: 8px; padding: 12px 14px; }
        .pt-exc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .pt-exc-icon { font-size: 18px; flex-shrink: 0; }
        .pt-exc-title { font-size: 13px; font-weight: 600; flex: 1; }
        .pt-exc-desc { font-size: 11px; color: var(--color-text-secondary, #4B5563); line-height: 1.5; }
        .pt-exc-appealable { font-size: 11px; color: #854F0B; margin-top: 8px; background: #FAEEDA; border-radius: 6px; padding: 6px 10px; }
        .pt-limits-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (max-width: 500px) { .pt-limits-grid { grid-template-columns: 1fr; } }
        .pt-limit-card { background: var(--color-background-secondary, #F6F7F9); border-radius: 8px; padding: 12px 14px; border: 0.5px solid var(--color-border-tertiary, #E8ECF0); }
        .pt-limit-label { font-size: 11px; color: var(--color-text-tertiary, #9CA3AF); margin-bottom: 4px; }
        .pt-limit-val { font-size: 18px; font-weight: 600; color: #085041; }
        .pt-appeal-steps { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .pt-appeal-step { display: flex; gap: 14px; align-items: flex-start; }
        .pt-step-num { width: 28px; height: 28px; border-radius: 50%; background: #085041; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .pt-step-title { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
        .pt-step-desc { font-size: 12px; color: var(--color-text-secondary, #4B5563); line-height: 1.4; }
        .pt-contacts { background: var(--color-background-secondary, #F6F7F9); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .pt-contact-row { font-size: 12px; color: var(--color-text-secondary, #4B5563); margin-bottom: 5px; }
        .pt-contact-row:last-child { margin-bottom: 0; }
        .pt-regulator-note { font-size: 10px; color: var(--color-text-tertiary, #9CA3AF); line-height: 1.5; border-top: 0.5px solid var(--color-border-tertiary, #E8ECF0); padding-top: 12px; }
      `}</style>
    </div>
  );
}

function PolicySkeleton() {
  return (
    <div style={{ padding: 20, borderRadius: 12, border: "0.5px solid #E8ECF0" }}>
      {[80, 60, 40, 40, 60].map((w, i) => (
        <div key={i} style={{ height: 14, background: "#F0F2F5", borderRadius: 6, marginBottom: 10, width: `${w}%`, animation: "shimmer 1.5s infinite" }} />
      ))}
    </div>
  );
}

function PolicyError({ message }: { message: string }) {
  return (
    <div style={{ padding: 16, background: "#FCEBEB", borderRadius: 8, color: "#791F1F", fontSize: 13 }}>
      ⚠️ {message}
    </div>
  );
}
