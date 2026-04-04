// ─── All API calls in one place ───────────────────────────────────────────────

import type {
  HealthResponse,
  PayoutEventRead,
  PolicyRead,
  RiderOnboardRead,
  RiderPolicyRead,
  TriggerResponse,
  ZoneLiveData,
} from "@/types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

// ─── Zone live data & payouts ─────────────────────────────────────────────────

export async function getZoneLiveData(): Promise<ZoneLiveData[]> {
  return apiFetch<ZoneLiveData[]>("/zones/live-data");
}

export async function getRecentPayouts(): Promise<PayoutEventRead[]> {
  return apiFetch<PayoutEventRead[]>("/payouts/recent");
}

// ─── Trigger evaluation ───────────────────────────────────────────────────────

export async function evaluateTrigger(
  zoneId: number,
  zone: ZoneLiveData,
  riderId?: number
): Promise<TriggerResponse> {
  return apiFetch<TriggerResponse>("/api/v1/triggers/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zone_id: zoneId,
      rainfall: zone.rainfall_mm,
      AQI: zone.aqi,
      traffic_speed: zone.traffic_index,
      current_dai: zone.dai,
      ...(riderId ? { rider_id: riderId } : {}),
    }),
  });
}

// ─── Policies ────────────────────────────────────────────────────────────────

export async function getPolicies(): Promise<PolicyRead[]> {
  return apiFetch<PolicyRead[]>("/api/v1/policies");
}

export async function subscribeRiderToPolicy(
  riderId: number,
  policyName: string
): Promise<RiderPolicyRead> {
  return apiFetch<RiderPolicyRead>("/api/v1/policies/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rider_id: riderId, policy_name: policyName }),
  });
}

export async function getRiderPolicy(
  riderId: number
): Promise<RiderPolicyRead | null> {
  try {
    return await apiFetch<RiderPolicyRead>(
      `/api/v1/policies/rider/${riderId}`
    );
  } catch {
    return null;
  }
}

// ─── Rider onboarding ────────────────────────────────────────────────────────

export async function onboardRider(data: {
  name: string;
  email: string;
  city: string;
  home_zone: string;
  reliability_score: number;
}): Promise<RiderOnboardRead> {
  return apiFetch<RiderOnboardRead>("/api/v1/domain/riders/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ─── Manual distress claim ────────────────────────────────────────────────────

export async function submitManualDistressClaim(data: {
  rider_id: number;
  zone_id: number;
  reason: "Rain" | "Traffic" | "Curfew" | "Other";
  zone_dai: number;
  rainfall: number;
  AQI: number;
  traffic_speed: number;
}): Promise<{ decision: string; estimated_payout_seconds: number; trust_score: number }> {
  return apiFetch("/api/v1/claims/manual-distress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
