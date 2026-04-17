/**
 * GPSGate — mandatory GPS permission gate.
 *
 * Renders a full-screen prompt while GPS is being requested.
 * Blocks access with a clear error screen if permission is denied.
 * Only renders children when GPS is granted.
 *
 * Usage:
 *   <GPSGate riderId={rider.id} context="claim">
 *     <ClaimForm />
 *   </GPSGate>
 */
"use client";

import { ReactNode } from "react";
import { useGPS, type GpsPermission } from "@/hooks/useGPS";

function GPSRequestingScreen() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", gap: 20, padding: "24px 20px", textAlign: "center",
    }}>
      {/* Animated GPS pulse */}
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "rgba(91,33,182,0.15)",
          animation: "gps-pulse 2s ease-out infinite",
        }} />
        <div style={{
          position: "absolute", inset: 12, borderRadius: "50%",
          background: "rgba(91,33,182,0.25)",
          animation: "gps-pulse 2s ease-out infinite 0.4s",
        }} />
        <div style={{
          position: "absolute", inset: 24, borderRadius: "50%",
          background: "var(--brand)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>📍</div>
      </div>

      <style>{`
        @keyframes gps-pulse {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      <div>
        <div style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: 8 }}>
          Requesting Location Access
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, maxWidth: 300 }}>
          HustleGuard needs your GPS location to verify which zone you&apos;re in and
          protect you from fraudulent claims. Please allow access when prompted.
        </div>
      </div>

      <div style={{
        padding: "10px 16px", borderRadius: "var(--radius-md)",
        background: "rgba(91,33,182,0.1)", border: "1px solid rgba(91,33,182,0.25)",
        fontSize: "0.8125rem", color: "var(--brand-light)", lineHeight: 1.5,
        maxWidth: 320,
      }}>
        📱 <strong>Tap &quot;Allow&quot;</strong> in the permission prompt above.
        Your location is only used for zone verification — never sold or shared.
      </div>
    </div>
  );
}

function GPSDeniedScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", gap: 16, padding: "24px 20px", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28,
      }}>🚫</div>

      <div>
        <div style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: 8, color: "var(--danger)" }}>
          Location Access Required
        </div>
        <div style={{
          color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6,
          maxWidth: 320,
        }}>
          {error ?? "HustleGuard requires GPS to detect your zone and process insurance claims. The app cannot function without location access."}
        </div>
      </div>

      {/* Step-by-step fix instructions */}
      <div style={{
        background: "var(--bg-raised)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)", padding: "14px 16px", maxWidth: 340, textAlign: "left",
      }}>
        <div style={{ fontWeight: 700, fontSize: "0.8125rem", marginBottom: 10, color: "var(--text-primary)" }}>
          How to enable GPS:
        </div>
        {[
          "Tap the 🔒 lock icon in your browser address bar",
          "Find \"Location\" and set it to \"Allow\"",
          "Reload the page",
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "4px 0", alignItems: "flex-start" }}>
            <span style={{
              minWidth: 20, height: 20, borderRadius: "50%",
              background: "var(--brand-muted)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "0.625rem", fontWeight: 700,
              color: "var(--brand-light)", flexShrink: 0, marginTop: 1,
            }}>{i + 1}</span>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{step}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onRetry}
        type="button"
        className="btn btn-primary"
        style={{ width: "100%", maxWidth: 300 }}
      >
        Try Again
      </button>
    </div>
  );
}

type GPSGateProps = {
  riderId?: number;
  context?: "app_open" | "claim" | "trigger_ack";
  children: ReactNode;
};

export default function GPSGate({ riderId, context = "app_open", children }: GPSGateProps) {
  const { permission, error, retry } = useGPS({ riderId, context });

  if (permission === "requesting") return <GPSRequestingScreen />;
  if (permission === "denied") return <GPSDeniedScreen error={error} onRetry={retry} />;
  return <>{children}</>;
}
