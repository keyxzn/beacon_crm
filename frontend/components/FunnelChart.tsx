"use client";

export default function FunnelChart({
  stages,
}: {
  stages: { label: string; count: number; color: string; opacity?: number }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const w = 600;      // skala pixel asli — HARUS sepadan sama skala tinggi di bawah, jangan pake "persen"
  const rowH = 62;
  const gap = 10;
  const h = stages.length * rowH + (stages.length - 1) * gap;
  const minWidthPct = 0.22; // biar stage yang kecil banget tetep keliatan bentuk trapesium-nya

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {stages.map((s, i) => {
        const wThis = Math.max(minWidthPct, s.count / max) * w;
        const wNext = i < stages.length - 1
          ? Math.max(minWidthPct, stages[i + 1].count / max) * w
          : wThis * 0.86;
        const yTop = i * (rowH + gap);
        const xTopL = (w - wThis) / 2, xTopR = w - xTopL;
        const xBotL = (w - wNext) / 2, xBotR = w - xBotL;
        return (
          <g key={s.label}>
            <polygon
              points={`${xTopL},${yTop} ${xTopR},${yTop} ${xBotR},${yTop + rowH} ${xBotL},${yTop + rowH}`}
              fill={s.color} opacity={s.opacity ?? 0.88}
            />
            <text x={w / 2} y={yTop + rowH / 2 - 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0A0E16">
              {s.label}
            </text>
            <text x={w / 2} y={yTop + rowH / 2 + 15} textAnchor="middle" fontSize="12.5" fill="#0A0E16" opacity="0.75">
              {s.count} deal
            </text>
          </g>
        );
      })}
    </svg>
  );
}