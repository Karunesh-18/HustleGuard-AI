"use client";

import { fmtInr, fmtTime, probColor } from "@/lib/formatters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProgressBar } from "@/components/shared/ProgressBar";
import type { ZoneLiveData, TriggerResponse } from "@/types";

export function MLForecastBars({
  zones,
  forecasts,
  loading,
}: {
  zones: ZoneLiveData[];
  forecasts: TriggerResponse[];
  loading: boolean;
}) {
  const items = forecasts.map((f, i) => ({ zone: zones[i]?.zone_name ?? `Zone ${i + 1}`, prob: f.disruption_probability, label: f.risk_label }));

  return (
    <div className="ml-forecast">
      {loading ? (
        [1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: 26, borderRadius: 6, margin: "4px 0" }} />
        ))
      ) : items.length === 0 ? (
        <EmptyState icon="🤖" title="No forecasts" description="Backend API unavailable" />
      ) : (
        items.map((item) => {
          const color = probColor(item.prob);
          const textColor = item.prob >= 0.5 ? "#A32D2D" : item.prob >= 0.4 ? "#854F0B" : "#1D9E75";
          const variant = item.prob >= 0.5 ? "disrupted" as const : item.prob >= 0.4 ? "warning" as const : "safe" as const;
          return (
            <div key={item.zone} className="ml-forecast-row">
              <div className="ml-forecast-zone">{item.zone}</div>
              <ProgressBar value={item.prob * 100} max={100} color={color} animated />
              <div className="ml-forecast-pct" style={{ color: textColor }}>
                {(item.prob * 100).toFixed(0)}%
              </div>
              <StatusBadge label={item.label} variant={variant} />
            </div>
          );
        })
      )}
    </div>
  );
}


// ── Admin-facing tables ───────────────────────────────────────────────────────

import type { PayoutEventRead } from "@/types";

export function ClaimsAdminTable({ payouts }: { payouts: PayoutEventRead[] }) {
  if (payouts.length === 0)
    return <EmptyState icon="📋" title="No claims data" description="Ensure backend is running" />;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>#</th><th>Time</th><th>Zone</th><th>Trigger Reason</th><th>Amount</th><th>Riders</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {payouts.map((p) => (
          <tr key={p.id}>
            <td className="td-muted">#{p.id}</td>
            <td>{fmtTime(p.event_time)}</td>
            <td className="td-bold">{p.zone_name}</td>
            <td className="td-truncate">{p.trigger_reason}</td>
            <td className="td-green">{fmtInr(p.payout_amount_inr)}</td>
            <td><StatusBadge label={`${p.eligible_riders} riders`} variant="safe" /></td>
            <td><StatusBadge label="Paid" variant="safe" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type FraudCase = {
  id: string;
  score: number;
  flag: string;
  signal: string;
  decision: string;
};

export function FraudQueue({ cases = [] }: { cases?: FraudCase[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Rider ID</th>
          <th>Trust Score</th>
          <th>Flag</th>
          <th>Signal</th>
          <th>Decision</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((r) => {
          const scoreVariant = r.score >= 70 ? "safe" as const : r.score >= 40 ? "warning" as const : "disrupted" as const;
          const decVariant = r.decision === "Pay now" ? "safe" as const
            : r.decision === "Reject" || r.decision === "Hold" ? "disrupted" as const
            : "warning" as const;
          return (
            <tr key={r.id}>
              <td className="td-muted">{r.id}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProgressBar value={r.score} color={r.score >= 70 ? "#1D9E75" : r.score >= 40 ? "#EF9F27" : "#E24B4A"} />
                  <span style={{ fontSize: 11, fontWeight: 500, width: 24, flexShrink: 0 }}>{r.score}</span>
                </div>
              </td>
              <td><StatusBadge label={r.flag} variant={scoreVariant} /></td>
              <td className="td-muted">{r.signal}</td>
              <td><StatusBadge label={r.decision} variant={decVariant} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ZoneAdminTable({ zones }: { zones: ZoneLiveData[] }) {
  const displayZones = zones;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Zone</th><th>DAI</th><th>Workability</th><th>Rain</th><th>AQI</th><th>Traffic</th><th>Updated</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {displayZones.map((z) => {
          const st = z.dai < 0.4 ? "disrupted" as const : z.dai < 0.65 ? "warning" as const : "safe" as const;
          const daiCol = z.dai < 0.4 ? "#E24B4A" : z.dai < 0.65 ? "#EF9F27" : "#1D9E75";
          return (
            <tr key={z.zone_name}>
              <td className="td-bold">{z.zone_name}</td>
              <td style={{ fontWeight: 700, color: daiCol }}>{z.dai.toFixed(2)}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ProgressBar value={z.workability_score} color={z.workability_score < 50 ? "#E24B4A" : "#1D9E75"} />
                  <span style={{ fontSize: 11 }}>{z.workability_score}</span>
                </div>
              </td>
              <td>{z.rainfall_mm.toFixed(0)}mm</td>
              <td style={{ color: z.aqi > 300 ? "#E24B4A" : z.aqi > 150 ? "#EF9F27" : "inherit" }}>{z.aqi}</td>
              <td>{z.traffic_index}</td>
              <td className="td-muted">{fmtTime(z.updated_at)}</td>
              <td><StatusBadge label={st === "disrupted" ? "Disrupted" : st === "warning" ? "Moderate" : "Normal"} variant={st} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

