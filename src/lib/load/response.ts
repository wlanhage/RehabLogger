// Load Response Index (LRI): how the body responded to an impact dose,
// judged ONLY against previous impact sessions of the same type — never
// against rest weeks. Weighting: recovery lag > readiness > tenderness.

import { LRI } from "./config";
import type { RecoveryResponse, CheckinPoint } from "./recovery";

export type LriClass = "better_than_expected" | "expected" | "slightly_elevated" | "concerning";

export type LoadResponseEntry = {
  sessionId: string;
  date: string;
  type: string;
  tibial: number;
  /** % change vs previous impact session of same type. Null for the first. */
  loadDeltaPct: number | null;
  peakTenderness: number | null;
  lag: number | null;
  /** True if any check-in in the recovery window answered "no" to safe-to-run. */
  readinessIssue: boolean;
  lri: LriClass;
};

export type LoadResponseAnalysis = {
  /** All impact entries, newest first. */
  entries: LoadResponseEntry[];
  /** Comparison of the two most recent same-type impact sessions. */
  latest: {
    type: string;
    loadDeltaPct: number | null;
    tendernessDelta: number | null;
    lagDelta: number | null;
    readinessWord: "oförändrad" | "försämrad" | "förbättrad";
    interpretation: string;
    lri: LriClass;
  } | null;
  /** True when the newest running response is elevated/concerning. */
  abnormal: boolean;
};

const dayMs = 86_400_000;
const ms = (d: string) => new Date(d + "T00:00:00").getTime();

function readinessIssueAfter(sessionDate: string, checkins: CheckinPoint[], windowDays = 4): boolean {
  return checkins.some((c) => {
    const k = (ms(c.date) - ms(sessionDate)) / dayMs;
    return k >= 1 && k <= windowDays && c.safeToRun === "no";
  });
}

/** Tenderness rise allowed for a given load change before it counts as excessive. */
function allowedTendernessDelta(loadDeltaPct: number | null): number {
  const pct = Math.max(0, loadDeltaPct ?? 0);
  return LRI.allowedTendernessBase + (pct / 25) * LRI.allowedTendernessPer25pct;
}

function classify(
  cur: { tibial: number; peak: number | null; lag: number | null; readinessIssue: boolean },
  prev: { tibial: number; peak: number | null; lag: number | null } | null,
): { lri: LriClass; loadDeltaPct: number | null } {
  const loadDeltaPct =
    prev && prev.tibial > 0 ? Math.round(((cur.tibial - prev.tibial) / prev.tibial) * 100) : null;

  // 1. Lag governs (heaviest weight).
  if (cur.lag != null) {
    if (cur.lag >= LRI.lagConcerningAbs) return { lri: "concerning", loadDeltaPct };
    if (prev?.lag != null && cur.lag - prev.lag >= LRI.lagConcerningDelta)
      return { lri: "concerning", loadDeltaPct };
  }

  // 2. Readiness second.
  if (cur.readinessIssue) {
    const lagWorse = prev?.lag != null && cur.lag != null && cur.lag > prev.lag;
    return { lri: lagWorse ? "concerning" : "slightly_elevated", loadDeltaPct };
  }

  if (prev?.lag != null && cur.lag != null && cur.lag - prev.lag >= LRI.lagSlightlyDelta)
    return { lri: "slightly_elevated", loadDeltaPct };

  // 3. Tenderness last — normalised against load change.
  if (prev && cur.peak != null && prev.peak != null) {
    const tendernessDelta = cur.peak - prev.peak;
    if (tendernessDelta > allowedTendernessDelta(loadDeltaPct))
      return { lri: "slightly_elevated", loadDeltaPct };
    if (
      loadDeltaPct != null &&
      loadDeltaPct >= LRI.betterLoadDeltaMin &&
      tendernessDelta <= 0 &&
      (prev.lag == null || cur.lag == null || cur.lag <= prev.lag)
    )
      return { lri: "better_than_expected", loadDeltaPct };
  }

  // First session ever: judge on absolutes only.
  if (!prev && cur.lag != null && cur.lag >= LRI.lagConcerningAbs)
    return { lri: "concerning", loadDeltaPct };

  return { lri: "expected", loadDeltaPct };
}

const INTERPRETATION: Record<LriClass, string> = {
  better_than_expected:
    "Bättre än förväntat — högre belastning utan ökad ömhet eller längre återhämtning. Kapaciteten byggs.",
  expected:
    "Förväntad adaptation. Responsen står i proportion till belastningen — inget tyder på onormal reaktion.",
  slightly_elevated:
    "Något förhöjd respons i förhållande till belastningen. Ingen fara, men öka inte dosen förrän responsen normaliserats.",
  concerning:
    "Onormalt hög respons för dosen. Backa belastningen och låt skenbenen komma ikapp innan nästa impact-pass.",
};

/**
 * Compute load responses for all impact sessions (recoveries chronological or
 * not — sorted internally). Comparison is always vs the previous session of
 * the SAME type, so football never licenses or condemns running.
 */
export function computeLoadResponses(
  recoveries: RecoveryResponse[],
  checkins: CheckinPoint[],
): LoadResponseAnalysis {
  const chrono = [...recoveries].sort((a, b) => a.date.localeCompare(b.date));
  const prevByType = new Map<string, { tibial: number; peak: number | null; lag: number | null }>();
  const entries: LoadResponseEntry[] = [];

  for (const r of chrono) {
    const cur = {
      tibial: r.tibial,
      peak: r.peakTenderness,
      lag: r.daysUntilReady,
      readinessIssue: readinessIssueAfter(r.date, checkins),
    };
    const prev = prevByType.get(r.type) ?? null;
    const { lri, loadDeltaPct } = classify(cur, prev);
    entries.push({
      sessionId: r.sessionId,
      date: r.date,
      type: r.type,
      tibial: r.tibial,
      loadDeltaPct,
      peakTenderness: r.peakTenderness,
      lag: r.daysUntilReady,
      readinessIssue: cur.readinessIssue,
      lri,
    });
    // Only resolved sessions become the new reference dose.
    if (r.status !== "ongoing") prevByType.set(r.type, cur);
  }

  entries.reverse(); // newest first

  // Latest analysis: two most recent same-type entries (prefer running).
  let latest: LoadResponseAnalysis["latest"] = null;
  for (const type of ["running", "football"]) {
    const ofType = entries.filter((e) => e.type === type);
    if (ofType.length >= 1) {
      const cur = ofType[0];
      const prev = ofType[1] ?? null;
      const readinessWord =
        prev == null || cur.readinessIssue === prev.readinessIssue
          ? "oförändrad"
          : cur.readinessIssue
            ? "försämrad"
            : "förbättrad";
      latest = {
        type,
        loadDeltaPct: cur.loadDeltaPct,
        tendernessDelta:
          prev && cur.peakTenderness != null && prev.peakTenderness != null
            ? cur.peakTenderness - prev.peakTenderness
            : null,
        lagDelta: prev && cur.lag != null && prev.lag != null ? cur.lag - prev.lag : null,
        readinessWord,
        interpretation: INTERPRETATION[cur.lri],
        lri: cur.lri,
      };
      break;
    }
  }

  const newestRun = entries.find((e) => e.type === "running");
  const abnormal = !!newestRun && (newestRun.lri === "slightly_elevated" || newestRun.lri === "concerning");

  return { entries, latest, abnormal };
}
