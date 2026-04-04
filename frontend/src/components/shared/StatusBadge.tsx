import type { ZoneStatus } from "@/types";
import { zoneStatusColors } from "@/lib/formatters";

type Variant = ZoneStatus | "blue" | "purple" | "gray" | "beta" | "prod";

const VARIANT_STYLES: Record<Variant, { bg: string; text: string }> = {
  disrupted: { bg: "#FCEBEB", text: "#A32D2D" },
  warning: { bg: "#FAEEDA", text: "#854F0B" },
  safe: { bg: "#EAF3DE", text: "#27500A" },
  blue: { bg: "#E3EEFB", text: "#1A4F8A" },
  purple: { bg: "#F0EAFD", text: "#5A2E9C" },
  gray: { bg: "var(--color-background-elevated)", text: "var(--color-text-secondary)" },
  beta: { bg: "#FAEEDA", text: "#854F0B" },
  prod: { bg: "#EAF3DE", text: "#27500A" },
};

export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: Variant;
}) {
  const { bg, text } = VARIANT_STYLES[variant] ?? VARIANT_STYLES.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 10,
        background: bg,
        color: text,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

/** Convenience wrapper that derives variant from dai */
export function ZoneStatusBadge({ dai }: { dai: number }) {
  const status: ZoneStatus = dai < 0.4 ? "disrupted" : dai < 0.65 ? "warning" : "safe";
  const { label } = zoneStatusColors(status);
  return <StatusBadge label={label} variant={status} />;
}
