export function Skeleton({ width = "100%", height = 14, radius = 8, style = {} }: {
  width?: string | number; height?: number; radius?: number; style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="card">
      <Skeleton width={90} height={11} style={{ marginBottom: 12 }} />
      <Skeleton width={70} height={26} style={{ marginBottom: 8 }} />
      <Skeleton width={120} height={11} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px" }}>
      <Skeleton width={36} height={36} radius={100} />
      <div style={{ flex: 1 }}>
        <Skeleton width="40%" height={12} style={{ marginBottom: 7 }} />
        <Skeleton width="25%" height={10} />
      </div>
      <Skeleton width={70} height={20} radius={100} />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: "6px 20px 12px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}