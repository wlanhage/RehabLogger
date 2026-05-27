export type SorenessTone = {
  label: string;
  /** Tailwind background class for dots / pills. Works in light + dark mode. */
  bg: string;
  /** Tailwind text class for matching foreground if used on light pills. */
  text: string;
};

export function sorenessTone(value: number): SorenessTone {
  if (value <= 0) return { label: "fine", bg: "bg-emerald-500/70", text: "text-emerald-50" };
  if (value <= 2) return { label: "mild", bg: "bg-emerald-500/70", text: "text-emerald-50" };
  if (value <= 4) return { label: "low", bg: "bg-yellow-500/70", text: "text-yellow-50" };
  if (value <= 6) return { label: "moderate", bg: "bg-orange-500/80", text: "text-orange-50" };
  return { label: "high", bg: "bg-red-500/80", text: "text-red-50" };
}
