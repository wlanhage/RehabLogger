import {
  RECOVERY_TOLERANCE,
  DEFAULT_BASELINE_TENDERNESS,
  THRESHOLDS,
} from "./config";

export type CheckinPoint = {
  date: string;
  tendernessWorse: number | null; // max(left,right) for that day
  safeToRun: "yes" | "unsure" | "no" | null;
};

export type ImpactSessionPoint = {
  sessionId: string;
  date: string;
  type: string;
  tibial: number;
};

export type RecoveryStatus = "green" | "yellow" | "red" | "ongoing";

export type RecoveryResponse = {
  sessionId: string;
  date: string;
  type: string;
  tibial: number;
  baseline: number;
  peakTenderness: number | null;
  daysUntilReady: number | null; // null = not yet recovered within window
  status: RecoveryStatus;
  worsened: boolean;
};

const dayMs = 86_400_000;
const ms = (d: string) => new Date(d + "T00:00:00").getTime();
const offsetDays = (a: string, b: string) => Math.round((ms(a) - ms(b)) / dayMs);

/** Median worse-side tenderness in the 3 days before an impact session. */
function baselineBefore(
  checkins: CheckinPoint[],
  sessionDate: string,
  fallbackBaseline: number,
): number {
  const before = checkins
    .filter((c) => {
      const o = offsetDays(sessionDate, c.date);
      return o >= 1 && o <= 3 && c.tendernessWorse != null;
    })
    .map((c) => c.tendernessWorse as number)
    .sort((a, b) => a - b);
  if (before.length === 0) return fallbackBaseline;
  return before[Math.floor(before.length / 2)];
}

/**
 * Derive the recovery response for one impact session purely from the daily
 * check-in series that follow it (no separate manual 24/48/72/96h form).
 *
 * fallbackBaseline is the user's personal resting tenderness, used when there
 * is no pre-session check-in data (avoids treating a chronic 1–2 as "never
 * recovered").
 */
export function deriveRecovery(
  session: ImpactSessionPoint,
  checkins: CheckinPoint[],
  fallbackBaseline = DEFAULT_BASELINE_TENDERNESS,
  windowDays = 6,
  nextImpactISO: string | null = null,
): RecoveryResponse {
  const baseline = baselineBefore(checkins, session.date, fallbackBaseline);

  // Cap the window at the next impact session: tenderness after the NEXT run
  // must not be attributed to THIS one (exposure attribution).
  const endOffset =
    nextImpactISO != null
      ? Math.min(windowDays, Math.max(0, offsetDays(nextImpactISO, session.date) - 1))
      : windowDays;

  const after = checkins
    .map((c) => ({ ...c, k: offsetDays(c.date, session.date) }))
    .filter((c) => c.k >= 0 && c.k <= endOffset)
    .sort((a, b) => a.k - b.k);

  const tenderVals = after
    .filter((c) => c.tendernessWorse != null)
    .map((c) => c.tendernessWorse as number);
  const peak = tenderVals.length ? Math.max(...tenderVals) : null;

  // First day (k≥1) back at/under baseline AND not flagged unsafe.
  let daysUntilReady: number | null = null;
  for (const c of after) {
    if (c.k < 1) continue;
    const tender = c.tendernessWorse;
    if (tender == null) continue;
    if (tender <= baseline + RECOVERY_TOLERANCE && c.safeToRun !== "no") {
      daysUntilReady = c.k;
      break;
    }
  }

  const worsened = peak != null && peak > baseline + 1;

  // Lag-primary classification: fast recovery = green even with a moderate
  // (≤4) peak; red is driven by a long lag or a strong (≥6) peak.
  let status: RecoveryStatus;
  if (daysUntilReady == null) {
    status = "ongoing";
  } else if (
    daysUntilReady <= THRESHOLDS.readinessLagGreenMax &&
    (peak ?? 0) <= THRESHOLDS.responseGreenPeakMax
  ) {
    status = "green";
  } else if (
    daysUntilReady >= THRESHOLDS.readinessLagRedMin ||
    (peak ?? 0) >= THRESHOLDS.responseRedPeakMin
  ) {
    status = "red";
  } else {
    status = "yellow";
  }

  return {
    sessionId: session.sessionId,
    date: session.date,
    type: session.type,
    tibial: session.tibial,
    baseline,
    peakTenderness: peak,
    daysUntilReady,
    status,
    worsened,
  };
}

/** Recovery responses for every impact session, newest first. */
export function deriveAllRecoveries(
  impactSessions: ImpactSessionPoint[],
  checkins: CheckinPoint[],
  fallbackBaseline = DEFAULT_BASELINE_TENDERNESS,
): RecoveryResponse[] {
  // Sort ascending so each session knows the date of the next impact session,
  // which caps its recovery window (no cross-run contamination).
  const asc = [...impactSessions].sort((a, b) => a.date.localeCompare(b.date));
  return asc
    .map((s, i) => deriveRecovery(s, checkins, fallbackBaseline, 6, asc[i + 1]?.date ?? null))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Personal resting baseline from data: a low percentile (≈25th) of worse-side
 * morning tenderness over the window. Used when the profile doesn't specify one.
 */
export function computeBaseline(checkins: CheckinPoint[]): number {
  const vals = checkins
    .map((c) => c.tendernessWorse)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (vals.length === 0) return DEFAULT_BASELINE_TENDERNESS;
  return vals[Math.floor(vals.length * 0.25)];
}

/** Best tibial load from a recent session that came back green (newest wins). */
export function bestTolerableTibial(recoveries: RecoveryResponse[]): number | null {
  const green = recoveries.filter((r) => r.status === "green");
  if (green.length === 0) return null;
  return Math.max(...green.map((r) => r.tibial));
}

/** Is the lag trend improving, flat, or worsening across recent sessions? */
export function lagTrend(recoveries: RecoveryResponse[]): "improving" | "flat" | "worsening" | "unknown" {
  const withLag = recoveries
    .filter((r) => r.daysUntilReady != null)
    .slice(0, 3); // newest 3
  if (withLag.length < 2) return "unknown";
  const newest = withLag[0].daysUntilReady as number;
  const prev = withLag[1].daysUntilReady as number;
  if (newest < prev) return "improving";
  if (newest > prev) return "worsening";
  return "flat";
}
