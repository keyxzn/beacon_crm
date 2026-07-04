"use client";

import { useId } from "react";

// Catmull-Rom -> cubic bezier, biar garisnya melengkung mulus (gak nusuk kayak tenda pas datanya naik-turun tajam)
function smoothPath(points: readonly (readonly [number, number])[]) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function RevenueChart({
  data,
  formatValue,
}: {
  data: { month: string; total: number }[];
  formatValue: (n: number) => string;
}) {
  const gradId = useId();
  const w = 720, h = 240;
  const padL = 10, padR = 10, padT = 34, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.total));
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => padL + (n === 0 ? innerW / 2 : (i / n) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const points = data.map((d, i) => [x(i), y(d.total)] as const);
  const linePath = smoothPath(points);
  const areaPath = data.length
    ? `${linePath} L${points[points.length - 1][0]},${padT + innerH} L${points[0][0]},${padT + innerH} Z`
    : "";

  const latestIdx = data.length - 1;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g) => (
        <line
          key={g}
          x1={padL} x2={w - padR}
          y1={padT + innerH * (1 - g)} y2={padT + innerH * (1 - g)}
          stroke="var(--border)" strokeWidth="1"
        />
      ))}

      {data.length > 0 && (
        <>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path d={linePath} fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map(([px, py], i) => (
            <circle
              key={i} cx={px} cy={py}
              r={i === latestIdx ? 4.5 : 3}
              fill={i === latestIdx ? "var(--signal)" : "var(--bg2)"}
              stroke="var(--signal)" strokeWidth="2"
            />
          ))}
          {points.map(([px, py], i) => {
            if (data[i].total <= 0) return null;
            const nearTop = py - padT < 18;
            const labelY = nearTop ? py + 18 : py - 12;
            return (
              <text
                key={`v${i}`} x={px} y={labelY}
                textAnchor="middle" fontSize="11.5" fontWeight="800"
                fill="var(--text)" fontFamily="Sora, sans-serif"
              >
                {formatValue(data[i].total)}
              </text>
            );
          })}
          {data.map((d, i) => (
            <text key={`l${i}`} x={x(i)} y={h - 6} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
              {d.month}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}