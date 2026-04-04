"use client";

import { useState } from "react";
import { predictDisruption } from "@/lib/api";
import type { DisruptionPredictionResponse } from "@/types";

const MODELS = [
  { name: "Model 1 — DAI Regressor", type: "RandomForestRegressor", phase: "Phase 2", features: "4 (rainfall, AQI, traffic_speed, current_dai)", r2: "0.9402", rmse: "0.0336", status: "active" },
  { name: "Model 2 — Disruption Classifier", type: "RandomForestClassifier", phase: "Phase 2", features: "2 (current_dai, rainfall)", accuracy: "97.88%", f1: "0.9783", status: "active" },
] as const;

export default function AdminMLPage() {
  const [inputs, setInputs] = useState({ rainfall: 45, AQI: 180, traffic_speed: 18, current_dai: 0.55 });
  const [result, setResult] = useState<DisruptionPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof inputs, v: string) =>
    setInputs((p) => ({ ...p, [k]: parseFloat(v) || 0 }));

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await predictDisruption(inputs);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = result?.risk_label === "high" ? "var(--danger)" : result?.risk_label === "moderate" ? "var(--warning)" : "var(--accent)";

  return (
    <div>
      <div className="admin-header">
        <div>
          <div className="display-md">ML Models</div>
          <div className="body-md" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Phase 2 model stats + live prediction tester
          </div>
        </div>
      </div>

      {/* Model cards */}
      <div className="section">
        <div className="section-title"><span>🤖</span> Trained Models</div>
        <div className="grid-2">
          {MODELS.map((m) => (
            <div key={m.name} className="card">
              <div className="row justify-between" style={{ marginBottom: 10 }}>
                <div className="badge badge-brand">{m.phase}</div>
                <div className="badge badge-accent">ACTIVE</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 4 }}>{m.name}</div>
              <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 12 }}>{m.type}</div>
              <div className="stack" style={{ gap: 6 }}>
                {"r2" in m && (
                  <>
                    <div className="row justify-between body-sm">
                      <span style={{ color: "var(--text-tertiary)" }}>CV R²</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{m.r2}</span>
                    </div>
                    <div className="row justify-between body-sm">
                      <span style={{ color: "var(--text-tertiary)" }}>MAE</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{m.rmse}</span>
                    </div>
                  </>
                )}
                {"accuracy" in m && (
                  <>
                    <div className="row justify-between body-sm">
                      <span style={{ color: "var(--text-tertiary)" }}>Accuracy</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{m.accuracy}</span>
                    </div>
                    <div className="row justify-between body-sm">
                      <span style={{ color: "var(--text-tertiary)" }}>F1 Score</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{m.f1}</span>
                    </div>
                  </>
                )}
                <div className="row justify-between body-sm">
                  <span style={{ color: "var(--text-tertiary)" }}>Features</span>
                  <span style={{ color: "var(--text-primary)" }}>{m.features}</span>
                </div>
              </div>
              <div className="body-sm" style={{ color: "var(--warning)", marginTop: 10, fontStyle: "italic" }}>
                ⚠️ Trained on synthetic data — validate before production use
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live tester */}
      <div className="section">
        <div className="section-title"><span>🎛️</span> Live Prediction Tester</div>
        <div className="card">
          <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
            {[
              { key: "rainfall", label: "Rainfall (mm)", min: 0, max: 300, step: 1 },
              { key: "AQI", label: "AQI", min: 0, max: 500, step: 5 },
              { key: "traffic_speed", label: "Traffic Speed (km/h)", min: 0, max: 80, step: 1 },
              { key: "current_dai", label: "Current DAI", min: 0, max: 1, step: 0.01 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key} className="form-group">
                <div className="row justify-between">
                  <label className="form-label">{label}</label>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--brand-light)" }}>
                    {inputs[key as keyof typeof inputs]}
                  </span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={inputs[key as keyof typeof inputs]}
                  onChange={(e) => set(key as keyof typeof inputs, e.target.value)}
                  style={{ width: "100%", accentColor: "var(--brand)", cursor: "pointer" }}
                />
                <div className="row justify-between" style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                  <span>{min}</span><span>{max}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={handlePredict} disabled={loading} type="button">
            {loading ? <><span className="spinner" /> Predicting…</> : "▶ Run Prediction"}
          </button>

          {error && <div className="form-error" style={{ marginTop: 8, textAlign: "center" }}>{error}</div>}

          {result && (
            <div style={{ marginTop: 20, padding: "var(--space-md)", background: "var(--bg-raised)", borderRadius: "var(--radius-md)", border: `1px solid ${riskColor}40` }}>
              <div className="grid-3" style={{ gap: 10 }}>
                <div className="metric-card" style={{ padding: "10px" }}>
                  <div className="metric-label" style={{ fontSize: "0.5625rem" }}>Predicted DAI</div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "1.1rem" }}>
                    {result.predicted_dai.toFixed(3)}
                  </div>
                </div>
                <div className="metric-card" style={{ padding: "10px" }}>
                  <div className="metric-label" style={{ fontSize: "0.5625rem" }}>Disruption Prob</div>
                  <div style={{ fontWeight: 700, color: riskColor, fontFamily: "var(--font-mono)", fontSize: "1.1rem" }}>
                    {Math.round(result.disruption_probability * 100)}%
                  </div>
                </div>
                <div className="metric-card" style={{ padding: "10px" }}>
                  <div className="metric-label" style={{ fontSize: "0.5625rem" }}>Risk Label</div>
                  <div style={{ fontWeight: 700, color: riskColor, textTransform: "capitalize", fontSize: "1.1rem" }}>
                    {result.risk_label}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature contracts note */}
      <div className="section">
        <div className="section-title"><span>📐</span> Feature Contracts</div>
        <div className="card">
          <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 10 }}>
            All feature names are enforced via <code style={{ color: "var(--brand-light)" }}>backend/ml/feature_contracts.py</code>.
            Previously, Model 2 dropped to 2 features due to a <code>traffic_speed</code> vs <code>average_traffic_speed</code> naming mismatch.
            This is now resolved.
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {[
              { name: "FEAT_RAINFALL", value: "rainfall" },
              { name: "FEAT_AQI", value: "aqi" },
              { name: "FEAT_TRAFFIC_SPEED", value: "average_traffic_speed (canonical)" },
              { name: "FEAT_CURRENT_DAI", value: "current_dai" },
            ].map(({ name, value }) => (
              <div key={name} className="row" style={{ gap: 8, fontSize: "0.8125rem" }}>
                <code style={{ color: "var(--brand-light)" }}>{name}</code>
                <span style={{ color: "var(--text-tertiary)" }}>→</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
