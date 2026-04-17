/**
 * useGPS — Mandatory GPS hook for HustleGuard.
 *
 * GPS is required to use the app. This hook:
 *   - Requests location on mount using the native Geolocation API
 *   - Stores the granted position in state
 *   - Logs each position to the backend /api/v1/mobility/log
 *   - Exposes permission state: 'requesting' | 'granted' | 'denied'
 *
 * Consumers block their UI until state === 'granted'.
 * On mobile this uses the device GPS; on desktop it falls back to
 * network-based geolocation (still sufficiently accurate for zone matching).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export type GpsPermission = "requesting" | "granted" | "denied";

export type GpsPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type UseGpsOptions = {
  riderId?: number;
  context?: "app_open" | "claim" | "trigger_ack";
  /** If true, keep watching position as the rider moves. Default: false (single fix). */
  watch?: boolean;
};

type UseGpsReturn = {
  permission: GpsPermission;
  position: GpsPosition | null;
  error: string | null;
  /** Call this to re-request permission after a denial (opens browser settings guidance). */
  retry: () => void;
};

async function logToBackend(
  riderId: number,
  pos: GpsPosition,
  context: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/mobility/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rider_id: riderId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy_metres: pos.accuracy,
        source: "gps",
        context,
      }),
    });
  } catch {
    // Non-fatal — mobility log failure should never block the UI
  }
}

export function useGPS({
  riderId,
  context = "app_open",
  watch = false,
}: UseGpsOptions = {}): UseGpsReturn {
  const [permission, setPermission] = useState<GpsPermission>("requesting");
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleSuccess = useCallback(
    (geo: GeolocationPosition) => {
      const pos: GpsPosition = {
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        accuracy: geo.coords.accuracy,
      };
      setPosition(pos);
      setPermission("granted");
      setError(null);
      // Log to backend if riderId is known
      if (riderId) {
        void logToBackend(riderId, pos, context);
      }
    },
    [riderId, context],
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    setPermission("denied");
    const messages: Record<number, string> = {
      1: "Location access denied. HustleGuard requires GPS to detect disruptions in your zone. Please enable location in your browser/device settings and reload.",
      2: "Location unavailable. Make sure GPS is enabled on your device.",
      3: "Location request timed out. Please try again.",
    };
    setError(messages[err.code] ?? "Location error. Please check your device settings.");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPermission("denied");
      setError("Geolocation is not supported by your browser. Please use a modern mobile browser.");
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,   // use GPS chip, not network-only
      timeout: 15000,             // 15s — generous for cold GPS start
      maximumAge: 60000,          // accept cached fix up to 1 min old
    };

    let watchId: number | undefined;
    if (watch) {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [handleSuccess, handleError, watch, attempt]);

  const retry = useCallback(() => {
    setPermission("requesting");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { permission, position, error, retry };
}
