export default function RadialGauge({
  pct,
  size = 132,
  stroke = 12,
  color = "var(--signal)",
  trackColor = "var(--surface2)",
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Arc dari -125deg ke +125deg (250deg total) biar bentuknya gauge, bukan donut penuh
  const arcDeg = 250;
  const arcLen = (arcDeg / 360) * c;
  const offset = arcLen - (clamped / 100) * arcLen;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(145deg)" }}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={trackColor} strokeWidth={stroke}
        strokeDasharray={`${arcLen} ${c}`} strokeLinecap="round"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${arcLen} ${c}`} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
    </svg>
  );
}
