"use client";

import { useEffect, useState, useCallback } from "react";
import { getRiderClaims } from "@/lib/api";
import type { ClaimRead } from "@/types";

const DECISION_COLORS: Record<string, string> = {
  instant_payout: "var(--accent)",
  provisional_payout_with_review: "var(--warning)",
  manual_review_required: "var(--brand-light)",
  hold_or_reject: "var(--danger)",
};

const BAND_LABELS: Record<string, string> = {
  green: "✅ Green",
  yellow: "🟡 Yellow",
  orange: "🟠 Orange",
  red: "🔴 Red",
};

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [riderId, setRiderId] = useState("1");

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRiderClaims(parseInt(riderId, 10));
      setClaims(data);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => { void fetch(); }, [fetch]);

  const totalClaims = claims.length;
  const instantCount = claims.filter((c) => c.decision === "instant_payout").length;
  const avgTrust = claims.length > 0 ? claims.reduce((s, c) => s + c.trust_score, 0) / claims.length : 0;
  const suspectCount = claims.filter((c) => c.trust_score < 40).length;

  return (
    <div>
      <div className="admin-header">
        <div>
          <div className="display-md">Claims &amp; Fraud</div>
          <div className="body-md" style={{ color: "var(--text-secondary)", marginTop: 4 }}>Claim history + fraud evaluation log</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="form-input"
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
            placeholder="Rider ID"
            style={{ width: 100 }}
            type="number"
            min={1}
          />
          <button className="btn btn-ghost" onClick={fetch} type="button" style={{ width: "auto", padding: "10px 16px" }}>
            Load
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        {[
          { label: "Total Claims", value: totalClaims },
          { label: "Instant Payouts", value: instantCount, accent: true },
          { label: "Avg Trust Score", value: avgTrust.toFixed(1), accent: true },
          { label: "Suspect Claims", value: suspectCount, danger: suspectCount > 0 },
        ].map(({ label, value, accent, danger }) => (
          <div key={label} className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value" style={{ color: danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--text-primary)" }}>
              {loading ? "—" : value}
            </div>
          </div>
        ))}
      </div>

      {/* Claims table */}
      <div className="section">
        <div className="section-title"><span>📋</span> Claims (Rider #{riderId})</div>
        {loading ? (
          <div className="skeleton-shimmer" style={{ height: 200 }} />
        ) : claims.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">No claims found</div>
            <div className="empty-body">Try a different rider ID</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Type</th><th>Trust Score</th><th>Decision</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>#{c.id}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontWeight: 600, textTransform: "capitalize", fontSize: "0.625rem" }}>
                        {c.claim_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <div className="progress-track" style={{ width: 60 }}>
                          <div className={`progress-fill ${c.trust_score >= 80 ? "accent" : c.trust_score >= 55 ? "" : "danger"}`}
                            style={{ width: `${c.trust_score}%` }} />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                          {c.trust_score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: DECISION_COLORS[c.decision] ?? "var(--text-secondary)", fontWeight: 600, fontSize: "0.8125rem" }}>
                      {c.decision.replace(/_/g, " ")}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: "0.625rem" }}>{c.status}</span>
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fraud signal guide */}
      <div className="section">
        <div className="section-title"><span>🔍</span> Fraud Signal Weights</div>
        <div className="card">
          <div className="stack" style={{ gap: 10 }}>
            {[
              { signal: "Environmental consistency", weight: 25 },
              { signal: "DAI-zone consistency", weight: 25 },
              { signal: "Behavioral continuity", weight: 15 },
              { signal: "Motion realism (GPS)", weight: 15 },
              { signal: "IP/network consistency", weight: 10 },
              { signal: "Peer coordination safety", weight: 10 },
            ].map(({ signal, weight }) => (
              <div key={signal}>
                <div className="row justify-between" style={{ marginBottom: 4, fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{signal}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{weight}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${weight * 3}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 12 }}>
            Weights defined in <code>FRAUD_SIGNAL_WEIGHTS</code> — configurable without logic changes.
          </div>
        </div>
      </div>
    </div>
  );
}
