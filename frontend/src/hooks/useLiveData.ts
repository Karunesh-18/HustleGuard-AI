"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRecentPayouts, getZoneLiveData } from "@/lib/api";
import type { PayoutEventRead, Toast, ZoneLiveData } from "@/types";

/** Polls zones + payouts and fires toast notifications on DAI threshold crossings */
export function useLiveData(refreshInterval = 60_000) {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [payouts, setPayouts] = useState<PayoutEventRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevZonesRef = useRef<ZoneLiveData[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]); // max 4 toasts
    setTimeout(() => dismissToast(id), 6000);
  }, [dismissToast]);

  const refresh = useCallback(async () => {
    try {
      const [zonesData, payoutsData] = await Promise.all([
        getZoneLiveData(),
        getRecentPayouts(),
      ]);

      // Detect zones that just crossed the 0.4 DAI threshold
      if (prevZonesRef.current.length > 0) {
        zonesData.forEach((newZone) => {
          const prev = prevZonesRef.current.find(
            (z) => z.zone_name === newZone.zone_name
          );
          if (prev && prev.dai >= 0.4 && newZone.dai < 0.4) {
            addToast({
              type: "disruption",
              message: `Disruption triggered in ${newZone.zone_name}`,
              zone: newZone.zone_name,
            });
          }
        });
      }

      prevZonesRef.current = zonesData;
      if (zonesData.length > 0) setZones(zonesData);
      setPayouts(payoutsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch live data");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), refreshInterval);
    return () => clearInterval(timer);
  }, [refresh, refreshInterval]);

  const bottomZone = useMemo(
    () => (zones.length ? [...zones].sort((a, b) => a.dai - b.dai)[0] : null),
    [zones]
  );

  const disruptedCount = useMemo(
    () => zones.filter((z) => z.dai < 0.4).length,
    [zones]
  );

  const totalPayout = useMemo(
    () => payouts.reduce((s, p) => s + p.payout_amount_inr, 0),
    [payouts]
  );

  return {
    zones,
    payouts,
    loading,
    error,
    refresh,
    bottomZone,
    disruptedCount,
    totalPayout,
    toasts,
    dismissToast,
  };
}
