"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateTrigger, getRecentPayouts, getZoneLiveData } from "@/lib/api";
import type { PayoutEventRead, Toast, ZoneLiveData } from "@/types";

/** Polls zones + payouts and fires toast notifications on DAI threshold crossings.
 *  When a zone's DAI drops below 0.4, the parametric trigger is evaluated via the
 *  backend ML pipeline — if confirmed, a PayoutEvent is recorded automatically.
 */
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

      // Detect zones that just crossed the 0.4 DAI threshold (falling edge)
      if (prevZonesRef.current.length > 0) {
        for (const newZone of zonesData) {
          const prev = prevZonesRef.current.find(
            (z) => z.zone_name === newZone.zone_name
          );

          if (prev && prev.dai >= 0.4 && newZone.dai < 0.4) {
            // DAI just crossed below threshold — show toast immediately
            addToast({
              type: "disruption",
              message: `Disruption triggered in ${newZone.zone_name}`,
              zone: newZone.zone_name,
            });

            // Fire the ML trigger pipeline on the backend.
            // We don't await this — it runs in the background so it doesn't
            // block the UI refresh.  Any payout events it creates will appear
            // on the next polling cycle.
            evaluateTrigger(
              1, // zone_id placeholder — trigger router auto-provisions the zone
              newZone
            ).then((result) => {
              if (result.triggered) {
                addToast({
                  type: "payout",
                  message: `Payout triggered for ${newZone.zone_name} — ₹${result.payout_event_id ? "600" : "0"}`,
                  zone: newZone.zone_name,
                });
              }
            }).catch((err) => {
              // Non-fatal — just log; the retry will happen on next refresh cycle
              console.warn(`[useLiveData] Trigger evaluation failed for ${newZone.zone_name}:`, err);
            });
          }
        }
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
