// ─── All API calls in one place ───────────────────────────────────────────────

import type {
  ClaimRead,
  DisruptionPredictionResponse,
  HealthResponse,
  PayoutEventRead,
  PolicyQuoteResponse,
  PolicyRead,
  PolicyRecommendation,
  RiderOnboardRead,
  RiderPolicyRead,
  TriggerResponse,
  ZoneLiveData,
  ZoneRead,
} from "@/types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://127.0.0.1:8000")
).replace(/\/+$/, "");

function readTimeoutEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const DEFAULT_API_TIMEOUT_MS = process.env.NODE_ENV === "production" ? 45_000 : 12_000;
const API_TIMEOUT_MS = readTimeoutEnv(process.env.NEXT_PUBLIC_API_TIMEOUT_MS, DEFAULT_API_TIMEOUT_MS);
const API_QUOTE_TIMEOUT_MS = readTimeoutEnv(
  process.env.NEXT_PUBLIC_API_QUOTE_TIMEOUT_MS,
  Math.max(API_TIMEOUT_MS, 60_000)
);
const API_ONBOARD_TIMEOUT_MS = readTimeoutEnv(
  process.env.NEXT_PUBLIC_API_ONBOARD_TIMEOUT_MS,
  Math.max(API_TIMEOUT_MS, 90_000)
);

type ApiFetchOptions = {
  timeoutMs?: number;
  retries?: number;
};

function isRetryableNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(path: string, init?: RequestInit, options?: ApiFetchOptions): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS;
  const retries = options?.retries ?? 0;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        cache: "no-store",
        ...init,
        signal: controller.signal,
      });
    } catch (err) {
      if (attempt < retries && isRetryableNetworkError(err)) {
        attempt += 1;
        await wait(500 * attempt);
        continue;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms — ${path}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      // Retry once for transient upstream errors during cold starts.
      if (attempt < retries && [502, 503, 504].includes(res.status)) {
        attempt += 1;
        await wait(500 * attempt);
        continue;
      }

      // Try to parse the backend's JSON error detail for better error messages
      let detail: string = res.statusText;
      try {
        const body = await res.json() as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch { /* ignore parse errors */ }
      throw new Error(`${res.status}: ${detail}`);
    }

    return res.json() as Promise<T>;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

// ─── Zone live data & payouts ─────────────────────────────────────────────────

export async function getZoneLiveData(): Promise<ZoneLiveData[]> {
  return apiFetch<ZoneLiveData[]>("/zones/live-data");
}

export async function getZones(): Promise<ZoneRead[]> {
  return apiFetch<ZoneRead[]>("/api/v1/zones");
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
  // traffic_index is 0–100 (congestion level); backend expects km/h speed.
  // Inversion: index 0 = free flow (~80 km/h), index 100 = gridlock (~5 km/h).
  const trafficSpeedKmh = Math.max(5, 80 - zone.traffic_index);
  return apiFetch<TriggerResponse>("/api/v1/triggers/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zone_id: zoneId,
      rainfall: zone.rainfall_mm,
      AQI: zone.aqi,
      traffic_speed: trafficSpeedKmh,
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
  policyName: string,
  waiveWaitingPeriod = false,
): Promise<RiderPolicyRead> {
  return apiFetch<RiderPolicyRead>("/api/v1/policies/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rider_id: riderId,
      policy_name: policyName,
      waive_waiting_period: waiveWaitingPeriod,
    }),
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

/** Fetch a dynamically computed single-plan recommendation for a rider.
 *  The backend runs the ML risk quote + selection matrix and returns exactly
 *  one plan with a human-readable reason — no rider choice required.
 */
export async function getRecommendation(riderId: number): Promise<PolicyRecommendation> {
  return apiFetch<PolicyRecommendation>(`/api/v1/policies/recommend/${riderId}`);
}

// ─── Rider onboarding ────────────────────────────────────────────────────────

export async function onboardRider(data: {
  name: string;
  email: string;
  city: string;
  home_zone: string;
  reliability_score: number;
}): Promise<RiderOnboardRead> {
  return apiFetch<RiderOnboardRead>("/api/v1/riders/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }, {
    timeoutMs: API_ONBOARD_TIMEOUT_MS,
    retries: 1,
  });
}

export async function signinRider(phone: string): Promise<RiderOnboardRead> {
  return apiFetch<RiderOnboardRead>("/api/v1/riders/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
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

// ─── ML Premium Quoting ───────────────────────────────────────────────────────

/** Fetch ML risk-adjusted premium quotes for a rider's home zone.
 *  Returns all 3 plan tiers with both base and quoted premiums,
 *  plus the zone conditions and ML risk label that drove the pricing.
 */
export async function quotePolicy(
  zone_name: string,
  reliability_score = 60
): Promise<PolicyQuoteResponse> {
  return apiFetch<PolicyQuoteResponse>("/api/v1/policies/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_name, reliability_score }),
  }, {
    timeoutMs: API_QUOTE_TIMEOUT_MS,
    retries: 1,
  });
}

// ─── Admin utilities ──────────────────────────────────────────────────────────

export async function adminRefreshZones(): Promise<unknown> {
  return apiFetch("/api/v1/admin/refresh-zones", { method: "POST" });
}

export async function adminSimulateDisruption(zone_name: string): Promise<unknown> {
  return apiFetch("/api/v1/admin/simulate-disruption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_name }),
  });
}

export async function getZoneStatus(): Promise<unknown[]> {
  return apiFetch<unknown[]>("/api/v1/admin/zone-status");
}

// ─── Claims ───────────────────────────────────────────────────────────────────

export async function getRiderClaims(riderId: number): Promise<ClaimRead[]> {
  return apiFetch<ClaimRead[]>(`/api/v1/claims/rider/${riderId}`);
}

// ─── ML Prediction ────────────────────────────────────────────────────────────

export async function predictDisruption(data: {
  rainfall: number;
  AQI: number;
  traffic_speed: number;
  current_dai: number;
}): Promise<DisruptionPredictionResponse> {
  return apiFetch<DisruptionPredictionResponse>("/predict-disruption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function simulateDisruption(zoneName: string): Promise<void> {
  return apiFetch(`/api/v1/admin/simulate-disruption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_name: zoneName })
  });
}
