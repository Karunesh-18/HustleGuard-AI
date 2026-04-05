// ─── All shared TypeScript types for HustleGuard AI frontend ─────────────────

export type ZoneRead = {
  id: number;
  name: string;
  city: string;
  baseline_dai?: number | null;
};

export type ZoneLiveData = {
  zone_name: string;
  rainfall_mm: number;
  aqi: number;
  traffic_index: number;
  dai: number;
  workability_score: number;
  updated_at: string;
};

export type PayoutEventRead = {
  id: number;
  zone_name: string;
  trigger_reason: string;
  payout_amount_inr: number;
  eligible_riders: number;
  event_time: string;
};

export type TriggerResponse = {
  triggered: boolean;
  disruption_probability: number;
  predicted_dai: number;
  risk_label: string;
  trigger_reason?: string;
  payout_event_id?: number | null;
  policy_name?: string;
  dai_threshold_used?: number;
};

export type HealthResponse = {
  status: string;
  database_ready: boolean;
  database_backend?: string;
};

export type RiderOnboardRead = {
  id: number;
  name: string;
  email: string;
  city: string;
  home_zone: string;
  reliability_score: number;
  created_at: string;
};

export type PolicyRead = {
  id: number;
  name: string;
  weekly_premium_inr: number;
  payout_per_disruption_inr: number;
  dai_trigger_threshold: number;
  rainfall_trigger_mm: number;
  aqi_trigger_threshold: number;
  max_claims_per_week: number;
  supports_partial_disruption: boolean;
  supports_community_claims: boolean;
  appeal_window_hours: number;
  waiting_period_days: number;
  is_active: boolean;
};

export type RiderPolicyRead = {
  id: number;
  rider_id: number;
  policy_id: number;
  policy_name: string;
  active: boolean;
  enrolled_at: string;
  eligible_from?: string;
};

export type ZoneStatus = "disrupted" | "warning" | "safe";

export type ApiStatus = "ok" | "db-offline" | "unreachable";

export type ClaimType =
  | "parametric_auto"
  | "manual_distress"
  | "partial_disruption"
  | "community"
  | "appeal";

export type Toast = {
  id: string;
  type: "disruption" | "payout" | "error" | "info";
  message: string;
  zone?: string;
};

// ── ML Premium Quoting ────────────────────────────────────────────────────────

export type ZoneConditionsSnapshot = {
  rainfall_mm: number;
  aqi: number;
  traffic_index: number;
  dai: number;
};

export type PolicyQuotedPlan = {
  policy_id: number;
  policy_name: string;
  base_premium_inr: number;
  quoted_premium_inr: number;
  risk_multiplier: number;
  payout_per_disruption_inr: number;
  dai_trigger_threshold: number;
  max_claims_per_week: number;
  supports_partial_disruption: boolean;
  supports_community_claims: boolean;
  waiting_period_days: number;
};

export type PolicyQuoteResponse = {
  zone_name: string;
  risk_label: "normal" | "moderate" | "high";
  disruption_probability: number;
  predicted_dai: number;
  risk_multiplier: number;
  zone_conditions: ZoneConditionsSnapshot;
  plans: PolicyQuotedPlan[];
};

// ── Claims ────────────────────────────────────────────────────────────────────

export type ClaimRead = {
  id: number;
  rider_id: number;
  zone_id: number;
  status: string;
  trust_score: number;
  decision: string;
  reasons: string;
  claim_type: ClaimType;
  distress_reason?: string;
  base_payout_inr?: number;
  partial_payout_ratio?: number;
  current_dai_at_claim?: number;
  community_trigger_count?: number;
  appeal_of_claim_id?: number;
  appeal_status?: string;
  created_at: string;
};

// ── ML Prediction ─────────────────────────────────────────────────────────────

export type DisruptionPredictionResponse = {
  predicted_dai: number;
  disruption_probability: number;
  risk_label: "normal" | "moderate" | "high";
};

// ── Policy Recommendation ─────────────────────────────────────────────────────

export type PolicyRecommendation = {
  recommended_plan: PolicyQuotedPlan;
  reason: string;
  risk_label: "normal" | "moderate" | "high";
  disruption_probability: number;
  claim_count_30d: number;
  reliability_score: number;
  zone_name: string;
  quote: PolicyQuoteResponse;
};
