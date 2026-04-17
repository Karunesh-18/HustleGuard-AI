/**
 * PolicyDocumentModal — full policy document in a bottom-sheet modal.
 *
 * Fetches GET /api/v1/policies/document and displays:
 *  - Coverage triggers per tier
 *  - What's covered list
 *  - Mandatory exclusions (IRDAI)
 *  - Payout process steps
 *  - Data attribution
 *
 * Usage:
 *   <PolicyDocumentModal open={open} onClose={() => setOpen(false)} />
 */
"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type PolicyDoc = {
  policy_name: string;
  version: string;
  effective_date: string;
  coverage_triggers: Record<string, { dai_threshold: number; rainfall_mm: number; aqi: number; payout_inr: number }>;
  covered_events: string[];
  mandatory_exclusions: { id: string; label: string; legal_detail: string }[];
  payout_process: { step: number; action: string; eta: string }[];
  waiting_periods: Record<string, number>;
  data_sources: string[];
  regulator: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function PolicyDocumentModal({ open, onClose }: Props) {
  const [doc, setDoc] = useState<PolicyDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"coverage" | "exclusions" | "process">("coverage");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${API_BASE}/api/v1/policies/document`)
      .then((r) => r.json() as Promise<PolicyDoc>)
      .then(setDoc)
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const TABS = [
    { id: "coverage" as const,   label: "✅ Coverage" },
    { id: "exclusions" as const, label: "⚠️ Exclusions" },
    { id: "process" as const,    label: "💸 Payouts" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)", zIndex: 1000,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg-card)", borderRadius: "20px 20px 0 0",
        border: "1px solid var(--border)", borderBottom: "none",
        zIndex: 1001, maxHeight: "88vh", display: "flex", flexDirection: "column",
        animation: "slide-up 0.25s ease-out",
      }}>
        <style>{`
          @keyframes slide-up {
            from { transform: translateY(40px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 20px 12px",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.0625rem" }}>Policy Document</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>
              {doc ? `v${doc.version} · ${doc.regulator}` : "HustleGuard AI Protection"}
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: "var(--bg-raised)", border: "1px solid var(--border)",
              borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.875rem", color: "var(--text-secondary)",
            }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 8, padding: "0 20px 12px", overflowX: "auto",
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              style={{
                padding: "6px 14px", borderRadius: 99, border: "1px solid",
                cursor: "pointer", whiteSpace: "nowrap", fontSize: "0.8125rem",
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? "var(--brand)" : "var(--bg-raised)",
                borderColor: activeTab === tab.id ? "var(--brand)" : "var(--border)",
                color: activeTab === tab.id ? "white" : "var(--text-secondary)",
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "0 20px 40px", flex: 1 }}>
          {loading && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
              Loading policy document…
            </div>
          )}

          {!loading && !doc && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--danger)" }}>
              Could not load policy document. Please try again.
            </div>
          )}

          {!loading && doc && activeTab === "coverage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Covered events */}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: "0.9375rem" }}>
                  What&apos;s Covered
                </div>
                {doc.covered_events.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", alignItems: "flex-start" }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{ev}</span>
                  </div>
                ))}
              </div>

              {/* Trigger thresholds per tier */}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: "0.9375rem" }}>
                  Auto-Trigger Thresholds by Plan
                </div>
                {Object.entries(doc.coverage_triggers).map(([tier, t]) => (
                  <div key={tier} style={{
                    padding: "12px 14px", borderRadius: "var(--radius-md)",
                    background: "var(--bg-raised)", border: "1px solid var(--border)", marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 8 }}>{tier}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "DAI <", val: `${(t.dai_threshold * 100).toFixed(0)}%` },
                        { label: "Rain >", val: `${t.rainfall_mm}mm` },
                        { label: "AQI >", val: String(t.aqi) },
                        { label: "Payout", val: `₹${t.payout_inr}` },
                      ].map(({ label, val }) => (
                        <span key={label} style={{
                          padding: "3px 9px", borderRadius: 99, fontSize: "0.75rem",
                          background: "rgba(91,33,182,0.1)", border: "1px solid rgba(91,33,182,0.2)",
                          color: "var(--brand-light)", fontWeight: 600,
                        }}>
                          {label} {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data sources */}
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "rgba(6,214,160,0.05)", border: "1px solid rgba(6,214,160,0.15)",
              }}>
                <div style={{ fontWeight: 700, fontSize: "0.8125rem", marginBottom: 6, color: "var(--accent)" }}>
                  📡 Live Data Sources
                </div>
                {doc.data_sources.map((src, i) => (
                  <div key={i} style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", padding: "2px 0" }}>
                    {src}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && doc && activeTab === "exclusions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6,
              }}>
                ⚠️ The following events are <strong>categorically excluded</strong> from all HustleGuard
                plans under IRDAI Master Circular 2023 §4. These exclusions cannot be waived, overridden,
                or appealed under any circumstance.
              </div>

              {doc.mandatory_exclusions.map((ex) => (
                <div key={ex.id} style={{
                  padding: "14px 16px", borderRadius: "var(--radius-lg)",
                  background: "var(--bg-raised)", border: "1px solid rgba(239,68,68,0.2)",
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 6, color: "var(--danger)" }}>
                    {ex.label}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                    {ex.legal_detail}
                  </div>
                </div>
              ))}

              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textAlign: "center", paddingTop: 8 }}>
                Ref: IRDAI Master Circular — General Insurance 2023, Section 4, Clauses 4.1–4.5
              </div>
            </div>
          )}

          {!loading && doc && activeTab === "process" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 4 }}>
                Parametric Payout Process
              </div>
              {doc.payout_process.map((step) => (
                <div key={step.step} style={{
                  display: "flex", gap: 14, padding: "12px 14px",
                  background: "var(--bg-raised)", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "var(--brand-muted)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "0.875rem", color: "var(--brand-light)",
                  }}>{step.step}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 3 }}>{step.action}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>⏱ {step.eta}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
