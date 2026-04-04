"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root route — redirect guard only.
 * Checks localStorage for a saved rider session and routes accordingly.
 * This page renders a loader briefly while the check happens.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("hg_rider");
    if (raw) {
      try {
        JSON.parse(raw);
        router.replace("/home");
      } catch {
        localStorage.removeItem("hg_rider");
        router.replace("/onboard");
      }
    } else {
      router.replace("/onboard");
    }
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page)",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 48 }}>🛡️</div>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}
