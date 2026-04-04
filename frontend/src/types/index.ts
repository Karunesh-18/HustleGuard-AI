// ─── All shared TypeScript types for HustleGuard AI frontend ─────────────────

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
