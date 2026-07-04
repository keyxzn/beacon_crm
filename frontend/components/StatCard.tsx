export default function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card">
      <div className="t-micro">{label}</div>
      <div className="t-h1" style={{ fontSize: 26, marginTop: 6, color: color || "var(--text)" }}>
        {value}
      </div>
      {sub && <div className="t-small">{sub}</div>}
    </div>
  );
}
