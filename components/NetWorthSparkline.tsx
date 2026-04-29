import type { MouseEvent } from "react";

interface SparklinePoint {
  value: number;
  label?: string;
}

interface SparklineProps {
  data: SparklinePoint[];
  color?: string;
  hoveredIndex?: number | null;
  onHover?: (i: number | null) => void;
}

function formatYLabel(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    return `${sign}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}jt`;
  }
  if (abs >= 1_000) {
    const n = abs / 1_000;
    return `${sign}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}rb`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

const GRID_LINES = 4;
const W = 320;
const H = 120;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;
const PAD_RIGHT = 8;
const PAD_LEFT = 44;

export default function NetWorthSparkline({
  data,
  color = "#10b981",
  hoveredIndex = null,
  onHover,
}: SparklineProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  const padding = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.1 || 1000;
  const domainMin = rawMin - padding;
  const domainMax = rawMax + padding;
  const range = domainMax - domainMin;

  const chartLeft = PAD_LEFT;
  const chartRight = W - PAD_RIGHT;
  const chartTop = PAD_TOP;
  const chartBottom = H - PAD_BOTTOM;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const toX = (i: number) => chartLeft + (i / (values.length - 1)) * chartW;
  const toY = (v: number) => chartTop + (1 - (v - domainMin) / range) * chartH;

  const pts = values.map((v, i) => ({ x: toX(i), y: toY(v) }));

  const pathD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x.toFixed(1)},${chartBottom.toFixed(1)}` +
    ` L ${pts[0].x.toFixed(1)},${chartBottom.toFixed(1)} Z`;

  const gridValues: number[] = [];
  for (let i = 0; i <= GRID_LINES; i++) {
    gridValues.push(domainMin + (i / GRID_LINES) * range);
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!onHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - mouseX);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    onHover(best);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[120px]"
      aria-hidden="true"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover?.(null)}
    >
      <defs>
        <linearGradient id="sparkGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <clipPath id="chartClip">
          <rect x={chartLeft} y={chartTop} width={chartW} height={chartH} />
        </clipPath>
      </defs>

      {gridValues.map((gv, i) => {
        const gy = toY(gv).toFixed(1);
        return (
          <g key={i}>
            <line
              x1={chartLeft}
              y1={gy}
              x2={chartRight}
              y2={gy}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
            <text
              x={(chartLeft - 4).toFixed(1)}
              y={gy}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="8"
              fill="currentColor"
              fillOpacity="0.45"
            >
              {formatYLabel(gv)}
            </text>
          </g>
        );
      })}

      <g clipPath="url(#chartClip)">
        <path d={areaD} fill="url(#sparkGrad2)" />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {pts.map((p, i) => {
        const isHovered = hoveredIndex === i;
        return (
          <circle
            key={i}
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={isHovered ? "5" : "3"}
            fill={color}
            stroke="white"
            strokeWidth={isHovered ? "2" : "1.5"}
            style={{ transition: "r 0.1s" }}
          />
        );
      })}

      {hoveredIndex !== null && pts[hoveredIndex] && (() => {
        const p = pts[hoveredIndex];
        const tipW = 80;
        const tipH = 28;
        const tipX = Math.min(Math.max(p.x - tipW / 2, chartLeft), chartRight - tipW);
        const tipY = p.y - tipH - 8 < chartTop ? p.y + 10 : p.y - tipH - 8;
        return (
          <g>
            <rect
              x={tipX.toFixed(1)}
              y={tipY.toFixed(1)}
              width={tipW}
              height={tipH}
              rx="4"
              fill={color}
              fillOpacity="0.92"
            />
            <text
              x={(tipX + tipW / 2).toFixed(1)}
              y={(tipY + 10).toFixed(1)}
              textAnchor="middle"
              fontSize="7.5"
              fill="white"
              fontWeight="600"
            >
              {data[hoveredIndex].label ?? ""}
            </text>
            <text
              x={(tipX + tipW / 2).toFixed(1)}
              y={(tipY + 21).toFixed(1)}
              textAnchor="middle"
              fontSize="7.5"
              fill="white"
              fillOpacity="0.9"
            >
              {formatYLabel(values[hoveredIndex])}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
