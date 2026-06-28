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
function baselineBefore(checkins: CheckinPoint[], sessionDate: string): number {
  const before = checkins
    .filter((c) => {
      const o = offsetDays(sessionDate, c.date);
      return o >= 1 && o <= 3 && c.tendernessWorse != null;
    })
    .map((c) => c.tendernessWorse as number)
    .sort((a, b) => a - b);
  if (before.length === 0) return DEFAULT_BASELINE_TENDERNESS;
  return before[Math.floor(before.length / 2)];
}

/**
 * Derive the recovery response for one impact session purely from the daily
 * check-in series that follow it (no separate manual 24/48/72/96h form).
 */
export function deriveRecovery(
  session: ImpactSessionPoint,
  checkins: CheckinPoint[],
  windowDays = 6,
): RecoveryResponse {
  const baseline = baselineBefore(checkins, session.date);

  const after = checkins
    .map((c) => ({ ...c, k: offsetDays(c.date, session.date) }))
    .filter((c) => c.k >= 0 && c.k <= windowDays)
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

  let status: RecoveryStatus;
  if (daysUntilReady == null) {
    status = "ongoing";
  } else if (
    (peak ?? 0) <= THRESHOLDS.tendernessGreenMax &&
    daysUntilReady <= THRESHOLDS.readinessLagGreenMax
  ) {
    status = "green";
  } else if (
    (peak ?? 0) >= THRESHOLDS.tendernessRedMin ||
    daysUntilReady >= THRESHOLDS.readinessLagRedMin
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
): RecoveryResponse[] {
  return impactSessions
    .map((s) => deriveRecovery(s, checkins))
    .sort((a, b) => b.date.localeCompare(a.date));
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
