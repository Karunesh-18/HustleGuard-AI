"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRiderPolicy, onboardRider, subscribeRiderToPolicy } from "@/lib/api";
import type { RiderOnboardRead, RiderPolicyRead } from "@/types";

const STORAGE_KEY = "hg_rider";

/** Manages rider onboarding and active policy with sessionStorage persistence */
export function useRider() {
  const [rider, setRider] = useState<RiderOnboardRead | null>(null);
  const [policy, setPolicy] = useState<RiderPolicyRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialisedRef = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RiderOnboardRead;
        setRider(parsed);
        // Fetch their current policy
        void getRiderPolicy(parsed.id).then(setPolicy);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const onboard = useCallback(
    async (data: {
      name: string;
      email: string;
      city: string;
      home_zone: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await onboardRider({ ...data, reliability_score: 60 });
        setRider(result);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Onboarding failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const subscribe = useCallback(
    async (policyName: string) => {
      if (!rider) throw new Error("Not onboarded yet");
      setLoading(true);
      setError(null);
      try {
        const result = await subscribeRiderToPolicy(rider.id, policyName);
        setPolicy(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Subscription failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [rider]
  );

  const reset = useCallback(() => {
    setRider(null);
    setPolicy(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { rider, policy, loading, error, onboard, subscribe, reset };
}
