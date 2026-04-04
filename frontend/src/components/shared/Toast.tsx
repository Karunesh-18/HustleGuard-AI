"use client";

import type { Toast } from "@/types";

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === "disruption" ? "⚡" : t.type === "payout" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
          </span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} type="button">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
