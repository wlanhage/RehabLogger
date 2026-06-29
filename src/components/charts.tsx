// Tiny dependency-free charts. Mobile-first, theme-aware.
// SVG for the plot, HTML for axis labels so values/dates are always readable.

const W = 320;

function xTicks(labels: string[]): { i: number; label: string }[] {
  const n = labels.length;
  if (n === 0) return [];
  if (n <= 3) return labels.map((label, i) => ({ i, label }));
  const mid = Math.floor((n - 1) / 2);
  return [
    { i: 0, label: labels[0] },
    { i: mid, label: labels[mid] },
    { i: n - 1, label: labels[n - 1] },
  ];
}

/** Split a value series into runs of consecutive non-null points (honor gaps). */
function segments(values: (number | null)[]): { i: number; v: number }[][] {
  const segs: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push({ i, v });
  });
  if (cur.length) segs.push(cur);
  return segs;
}

export function LineChart({
  series,
  labels = [],
  height = 100,
  min = 0,
  max,
  unit = "",
}: {
  series: { label: string; color: string; values: (number | null)[] }[];
  labels?: string[];
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const n = Math.max(...series.map((s) => s.values.length), 0);
  if (n === 0) return <Empty />;
  const computedMax =
    max ?? Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v != null)));
  const span = computedMax - min || 1;
  const stepX = n > 1 ? W / (n - 1) : 0;
  const yOf = (v: number) => height - ((v - min) / span) * height;
  const mid = Math.round((min + computedMax) / 2);

  return (
    <div className="space-y-1">
      <div className="flex" style={{ height }}>
        <YAxis top={`${computedMax}${unit}`} mid={`${mid}${unit}`} bottom={`${min}${unit}`} height={height} />
        <svg viewBox={`0 0 ${W} ${height}`} className="flex-1 h-full" preserveAspectRatio="none">
          <line x1={0} y1={yOf(mid)} x2={W} y2={yOf(mid)} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {series.map((s) =>
            segments(s.values).map((seg, si) => (
              <polyline
                key={`${s.label}-${si}`}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={seg.map((p) => `${(p.i * stepX).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            )),
          )}
        </svg>
      </div>
      <XAxis labels={labels} />
      <Legend items={series} />
    </div>
  );
}

export function BarChart({
  bars,
  height = 100,
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
  const showValues = bars.length <= 14;

  return (
    <div className="space-y-1">
      <div className="flex" style={{ height }}>
        <YAxis top={`${Math.round(max)}${unit}`} mid="" bottom="0" height={height} />
        <div className="flex-1 flex items-end gap-1">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end items-center gap-0.5">
              {showValues && b.value > 0 && (
                <span className="text-[9px] leading-none text-muted-foreground">{b.value}</span>
              )}
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(b.value / max) * (height - 12)}px`,
                  minHeight: b.value > 0 ? 2 : 0,
                  background: colorFor ? colorFor(b, i) : "var(--color-foreground)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <XAxis labels={bars.map((b) => b.label)} />
    </div>
  );
}

/** Tibial-load bars with a tenderness line (0–10) overlaid. */
export function ComboChart({
  points,
  height = 120,
}: {
  points: { label: string; load: number; tenderness: number | null }[];
  height?: number;
}) {
  if (points.length === 0) return <Empty />;
  const loadMax = Math.max(1, ...points.map((p) => p.load));
  const n = points.length;
  const stepX = n > 1 ? W / (n - 1) : 0;
  const barW = Math.max(2, (W / n) * 0.55);
  const yT = (t: number) => height - (t / 10) * height;

  return (
    <div className="space-y-1">
      <div className="flex" style={{ height }}>
        <YAxis top="10" mid="5" bottom="0" height={height} />
        <svg viewBox={`0 0 ${W} ${height}`} className="flex-1 h-full" preserveAspectRatio="none">
          <line x1={0} y1={yT(5)} x2={W} y2={yT(5)} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => {
            const h = (p.load / loadMax) * height;
            return (
              <rect key={i} x={i * stepX - barW / 2} y={height - h} width={barW} height={h} rx={1} fill="var(--color-muted-foreground)" opacity={0.3} />
            );
          })}
          {segments(points.map((p) => p.tenderness)).map((seg, si) => (
            <polyline
              key={si}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              points={seg.map((p) => `${(p.i * stepX).toFixed(1)},${yT(p.v).toFixed(1)}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <XAxis labels={points.map((p) => p.label)} />
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pl-7">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/40" /> Tibial load (relativ)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} /> Tryckömhet (0–10)
        </span>
      </div>
    </div>
  );
}

function YAxis({ top, mid, bottom, height }: { top: string; mid: string; bottom: string; height: number }) {
  return (
    <div
      className="w-7 shrink-0 flex flex-col justify-between text-[9px] text-muted-foreground text-right pr-1"
      style={{ height }}
    >
      <span>{top}</span>
      <span>{mid}</span>
      <span>{bottom}</span>
    </div>
  );
}

function XAxis({ labels }: { labels: string[] }) {
  const ticks = xTicks(labels);
  if (ticks.length === 0) return null;
  return (
    <div className="relative h-4 ml-7 text-[9px] text-muted-foreground">
      {ticks.map((t) => (
        <span
          key={t.i}
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{
            left: `${labels.length > 1 ? (t.i / (labels.length - 1)) * 100 : 0}%`,
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pl-7">
      {items.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-4 text-center">Ingen data än.</p>;
}
