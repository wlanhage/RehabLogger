// Tiny dependency-free SVG charts. Mobile-first, theme-aware via currentColor.

type Pt = { x: number; y: number | null };

function path(points: Pt[], w: number, h: number, min: number, max: number, n: number) {
  const span = max - min || 1;
  const stepX = n > 1 ? w / (n - 1) : 0;
  let d = "";
  let started = false;
  points.forEach((p) => {
    if (p.y == null) {
      started = false;
      return;
    }
    const x = p.x * stepX;
    const y = h - ((p.y - min) / span) * h;
    d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    started = true;
  });
  return d.trim();
}

export function LineChart({
  series,
  height = 90,
  min = 0,
  max,
  unit = "",
}: {
  series: { label: string; color: string; values: (number | null)[] }[];
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const n = Math.max(...series.map((s) => s.values.length), 0);
  if (n === 0) return <Empty />;
  const computedMax =
    max ??
    Math.max(
      1,
      ...series.flatMap((s) => s.values.filter((v): v is number => v != null)),
    );
  const w = 320;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={
              path(
                s.values.map((y, x) => ({ x, y })),
                w,
                height,
                min,
                computedMax,
                n,
              )
                .replace(/[ML]/g, " ")
                .trim()
            }
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto">
          max {Math.round(computedMax)}
          {unit}
        </span>
      </div>
    </div>
  );
}

export function BarChart({
  bars,
  height = 90,
  unit = "",
  colorFor,
}: {
  bars: { label: string; value: number }[];
  height?: number;
  unit?: string;
  colorFor?: (b: { label: string; value: number }, i: number) => string;
}) {
  if (bars.length === 0) return <Empty />;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1" style={{ height }}>
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end" title={`${b.label}: ${b.value}${unit}`}>
            <div
              className="rounded-t"
              style={{
                height: `${(b.value / max) * 100}%`,
                minHeight: b.value > 0 ? 2 : 0,
                background: colorFor ? colorFor(b, i) : "var(--color-foreground)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{bars[0]?.label}</span>
        <span>
          max {Math.round(max)}
          {unit}
        </span>
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Tibial-load bars with a tenderness line overlaid — the load-vs-symptom view. */
export function ComboChart({
  points,
  height = 110,
  lineMax = 10,
}: {
  points: { label: string; load: number; tenderness: number | null }[];
  height?: number;
  lineMax?: number;
}) {
  if (points.length === 0) return <Empty />;
  const w = 320;
  const loadMax = Math.max(1, ...points.map((p) => p.load));
  const n = points.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const barW = Math.max(2, (w / n) * 0.6);

  const linePts = points
    .map((p, i) => (p.tenderness == null ? null : { x: i * stepX, y: height - (p.tenderness / lineMax) * height }))
    .filter((v): v is { x: number; y: number } => v != null);
  const d = linePts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
        {points.map((p, i) => {
          const h = (p.load / loadMax) * height;
          return (
            <rect
              key={i}
              x={i * stepX - barW / 2}
              y={height - h}
              width={barW}
              height={h}
              rx={1}
              fill="var(--color-muted-foreground)"
              opacity={0.35}
            />
          );
        })}
        {d && <path d={d} fill="none" stroke="#ef4444" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/50" /> Tibial load
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} /> Tryckömhet
        </span>
        <span className="ml-auto">{points[0]?.label} → {points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-4 text-center">Ingen data än.</p>;
}
