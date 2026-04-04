"use client";

import type { ZoneLiveData } from "@/types";
import { daiColor } from "@/lib/formatters";

/**
 * SVG DAI chart — shows all zones as horizontal lines with their current DAI.
 * A threshold line at 0.4 provides immediate visual context.
 * No recharts dependency needed — custom SVG is faster and more controllable.
 */
export function DAIChart({ zones }: { zones: ZoneLiveData[] }) {
  const W = 400;
  const H = 110;
  const PAD = { top: 10, right: 12, bottom: 22, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Y axis: 0 (top) = 1.0 DAI, bottom = 0.0 DAI
  const y = (dai: number) => PAD.top + chartH * (1 - dai);
  const THRESHOLD = 0.4;

  const displayZones = zones.slice(0, 6);

  // Build sparkline points: evenly spread across X
  const xPerZone = chartW / Math.max(displayZones.length - 1, 1);

  const points = displayZones
    .map((z, i) => `${PAD.left + i * xPerZone},${y(z.dai)}`)
    .join(" ");

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.4, 0.65, 1.0];

  return (
    <div className="dai-chart-wrap" aria-label="DAI across zones chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "100%", display: "block" }}
        role="img"
      >
        <defs>
          <linearGradient id="dai-fill-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y grid lines */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + chartW}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-border-tertiary)"
              strokeWidth={0.5}
              strokeDasharray={t === THRESHOLD ? "3 3" : undefined}
            />
            <text
              x={PAD.left - 4}
              y={y(t) + 4}
              fontSize={8}
              textAnchor="end"
              fill="var(--color-text-tertiary)"
            >
              {t.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Threshold label */}
        <text
          x={PAD.left + chartW + 4}
          y={y(THRESHOLD) - 2}
          fontSize={7}
          fill="#EF9F27"
          fontWeight={500}
        >
          Threshold
        </text>

        {/* Area fill */}
        <polygon
          points={`${PAD.left},${y(0)} ${points} ${PAD.left + (displayZones.length - 1) * xPerZone},${y(0)}`}
          fill="url(#dai-fill-gradient)"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#1D9E75"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {displayZones.map((z, i) => (
          <g key={z.zone_name}>
            <circle
              cx={PAD.left + i * xPerZone}
              cy={y(z.dai)}
              r={3}
              fill={daiColor(z.dai)}
              stroke="var(--color-background-primary)"
              strokeWidth={1}
            />
            <text
              x={PAD.left + i * xPerZone}
              y={H - 4}
              textAnchor="middle"
              fontSize={8}
              fill="var(--color-text-tertiary)"
            >
              {z.zone_name.split(" ")[0]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

