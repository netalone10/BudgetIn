interface SparklinePoint {
  value: number;
  label?: string;
}

interface SparklineProps {
  data: SparklinePoint[];
  color?: string;
}

export default function NetWorthSparkline({ data, color = "#10b981" }: SparklineProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 300;
  const H = 60;
  const PAD = 4;

  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return { x, y };
  });

  const pathD =
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x.toFixed(1)},${(H - PAD).toFixed(1)}` +
    ` L ${pts[0].x.toFixed(1)},${(H - PAD).toFixed(1)} Z`;

  const lastPt = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[60px]"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastPt.x.toFixed(1)} cy={lastPt.y.toFixed(1)} r="3.5" fill={color} />
    </svg>
  );
}
