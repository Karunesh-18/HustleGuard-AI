export function ProgressBar({
  value,
  max = 100,
  color = "#1D9E75",
  height = 4,
  animated = false,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  animated?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      style={{
        flex: 1,
        height,
        background: "var(--color-border-tertiary)",
        borderRadius: height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: height,
          transition: animated ? "width 0.5s cubic-bezier(0.4,0,0.2,1)" : undefined,
        }}
      />
    </div>
  );
}
