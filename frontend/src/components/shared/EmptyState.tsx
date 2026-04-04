export function EmptyState({
  icon = "📭",
  title,
  description,
}: {
  icon?: string;
  title: string;
  description?: string;
}) {
  return (
    <div
      style={{
        padding: "36px 24px",
        textAlign: "center",
        color: "var(--color-text-tertiary)",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12 }}>{description}</div>
      )}
    </div>
  );
}
