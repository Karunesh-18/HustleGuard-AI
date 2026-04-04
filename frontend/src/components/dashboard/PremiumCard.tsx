"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import type { RiderPolicyRead } from "@/types";

type PolicyCardProps = {
  policy: RiderPolicyRead | null;
  isDisrupted: boolean;
  reliabilityScore: number;
};

export function PremiumCard({
  policy,
  isDisrupted,
  reliabilityScore,
}: PolicyCardProps) {
  const planName = policy?.policy_name ?? "No Coverage";
  const premium =
    planName.includes("Premium") ? "₹45" : planName.includes("Standard") ? "₹32" : planName !== "No Coverage" ? "₹20" : "—";
  const payout =
    planName.includes("Premium") ? "₹700" : planName.includes("Standard") ? "₹500" : planName !== "No Coverage" ? "₹300" : "—";
  const daiTrigger =
    planName.includes("Premium") ? "< 0.50" : planName.includes("Standard") ? "< 0.40" : planName !== "No Coverage" ? "< 0.35" : "—";

  return (
    <div className="premium-card">
      <div className="premium-card-header">
        <span className="premium-badge">{planName}</span>
        {policy && (
          <StatusBadge label={isDisrupted ? "Payout Eligible" : "Active"} variant={isDisrupted ? "disrupted" : "safe"} />
        )}
      </div>
      <div className="premium-amount">{premium}</div>
      <div className="premium-period">per week</div>
      <div className="premium-divider" />
      <div className="premium-row">
        <span>Payout per event</span>
        <strong>{payout}</strong>
      </div>
      <div className="premium-row">
        <span>DAI trigger</span>
        <strong>{daiTrigger}</strong>
      </div>
      <div className="premium-row">
        <span>Reliability score</span>
        <strong>{reliabilityScore}/100</strong>
      </div>
      {isDisrupted && policy && (
        <div className="premium-payout-eligible">
          ⚡ Your zone is disrupted — payout being processed
        </div>
      )}
      {!policy && (
        <div className="premium-payout-eligible" style={{ background: "rgba(255,255,255,0.08)" }}>
          ↑ Select a plan in the Coverage tab to activate protection
        </div>
      )}
    </div>
  );
}
