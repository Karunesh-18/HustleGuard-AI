export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 6,
}: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
}) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius }}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton height={14} width="40%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${70 + (i % 3) * 10}%`} />
      ))}
    </div>
  );
}
