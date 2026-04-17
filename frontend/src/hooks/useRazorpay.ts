/**
 * useRazorpay — dynamically loads the Razorpay checkout script and
 * provides an `openCheckout` helper that bridges the Razorpay modal
 * with our backend order creation + server-side signature verification.
 *
 * Flow:
 *   1. Caller invokes openCheckout({ amount_inr, rider_id, name, email, purpose })
 *   2. Hook POSTs to /api/v1/payments/create-order → gets order_id
 *   3. Razorpay modal opens with that order_id
 *   4. On payment success → POSTs to /api/v1/payments/verify
 *   5. Returns { success, payment_id, message }
 *
 * CDN error handling:
 *   If the Razorpay script is blocked (ad-blocker, network, India-specific CDN
 *   issues), sdkBlocked is set to true and openCheckout returns a descriptive
 *   error instead of silently hanging.
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type CheckoutOptions = {
  amount_inr: number;
  rider_id: number;
  purpose?: string;
  policy_name?: string;   // if set + purpose=="premium", backend auto-subscribes
  name?: string;
  email?: string;
  description?: string;
  notes?: Record<string, string>;
};

export type CheckoutResult =
  | { success: true;  payment_id: string; message: string }
  | { success: false; error: string };

export function useRazorpay() {
  const [scriptReady, setScriptReady] = useState(false);
  const [sdkBlocked, setSdkBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  // Load the Razorpay script once on mount
  useEffect(() => {
    // Already injected by a previous render
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      if (window.Razorpay) setScriptReady(true);
      // Script tag present but window.Razorpay not yet defined — wait for onload
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;

    script.onload = () => {
      if (window.Razorpay) {
        setScriptReady(true);
      } else {
        // Script loaded but Razorpay not defined — CDN served empty/blocked response
        setSdkBlocked(true);
        console.error("[useRazorpay] Script loaded but window.Razorpay is undefined");
      }
    };

    script.onerror = () => {
      // Network error or ad-blocker blocked the CDN request
      setSdkBlocked(true);
      console.error(
        "[useRazorpay] Failed to load Razorpay script — likely blocked by an ad-blocker or network issue. " +
        "Disable the blocker for this site and refresh."
      );
    };

    document.body.appendChild(script);
    scriptRef.current = script;
  }, []);

  const openCheckout = useCallback(
    async (opts: CheckoutOptions): Promise<CheckoutResult> => {
      // SDK blocked by ad-blocker or network — give user a clear error
      if (sdkBlocked) {
        return {
          success: false,
          error:
            "Payment SDK blocked — disable your ad-blocker for this site and refresh the page.",
        };
      }

      if (!scriptReady || !window.Razorpay) {
        return {
          success: false,
          error: "Razorpay is loading — please wait a moment and try again.",
        };
      }

      setLoading(true);

      try {
        // Step 1 — Create order on our backend
        const orderRes = await fetch(`${API_BASE}/api/v1/payments/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount_inr: opts.amount_inr,
            rider_id: opts.rider_id,
            purpose: opts.purpose ?? "premium",
            notes: opts.notes,
          }),
        });
        if (!orderRes.ok) {
          const err = await orderRes.json().catch(() => ({}));
          return { success: false, error: (err as { detail?: string }).detail ?? "Failed to create payment order." };
        }
        const order = await orderRes.json() as {
          order_id: string;
          amount_paise: number;
          currency: string;
          key_id: string;
        };

        // Step 2 — Open Razorpay modal
        return await new Promise<CheckoutResult>((resolve) => {
          const rzp = new window.Razorpay({
            key: order.key_id,
            amount: order.amount_paise,
            currency: order.currency,
            name: "HustleGuard AI",
            description: opts.description ?? "Weekly protection premium",
            order_id: order.order_id,
            prefill: {
              name: opts.name ?? "",
              email: opts.email ?? "",
            },
            theme: { color: "#5B21B6" },
            modal: {
              ondismiss: () => resolve({ success: false, error: "Payment cancelled by user." }),
            },
            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              // Step 3 — Verify signature server-side
              try {
                const verRes = await fetch(`${API_BASE}/api/v1/payments/verify`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id:   response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature:  response.razorpay_signature,
                    rider_id: opts.rider_id,
                    amount_inr: opts.amount_inr,
                    purpose: opts.purpose ?? "premium",
                    policy_name: opts.policy_name ?? null,
                  }),
                });
                if (!verRes.ok) {
                  const err = await verRes.json().catch(() => ({}));
                  resolve({ success: false, error: (err as { detail?: string }).detail ?? "Signature verification failed." });
                  return;
                }
                const verified = await verRes.json() as { success: boolean; payment_id: string; message: string };
                resolve({ success: true, payment_id: verified.payment_id, message: verified.message });
              } catch {
                resolve({ success: false, error: "Verification request failed. Contact support." });
              }
            },
          });
          rzp.open();
        });
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
      } finally {
        setLoading(false);
      }
    },
    [scriptReady, sdkBlocked],
  );

  return { scriptReady, sdkBlocked, loading, openCheckout };
}
