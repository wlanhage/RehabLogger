// The coach view: everything Home needs to answer "what can my body do today,
// what should I train, and why" — without exposing raw history/stats.

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { FIRST_RUN_TEMPLATE } from "./config";
import { lagTrend, type RecoveryResponse } from "./recovery";
import type { DailyDecision } from "./decision";

export type CoachStatus = "ready" | "in_progress" | "delayed";
export type Trend = "up" | "flat" | "down";

export type CoachView = {
  // 1. Current capacity
  capacityMinutes: number | null;
  capacityLabel: string;
  capacityTrend: Trend;
  capacityTrendWord: string;
  progressionLabel: string;
  confidence: number;

  // 2. Today's recommendation
  recommendation: {
    kind: "run" | "cycle" | "strength" | "recovery" | "checkin";
    label: string;
    emoji: string;
    why: string;
    confidence: number;
  };

  // 3. Recovery status
  status: CoachStatus;
  statusLabel: string;
  expectedReadyLabel: string;
  statusTrend: "normal" | "improving" | "worsening";
  statusTrendWord: string;
  statusConfidence: number;

  // 4. Next impact session
  nextImpact: {
    whenLabel: string;
    suggestion: string;
    successProbability: number;
  };

  // 5. Capacity trend (weekly minutes)
  capacitySeries: { week: string; minutes: number | null }[];

  // 6. Decision reasoning
  reasoning: { ok: boolean; text: string }[];
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export type CoachInput = {
  todayISO: string;
  decision: DailyDecision;
  recoveries: RecoveryResponse[]; // newest first
  greenRunSessions: { date: string; minutes: number; tibial: number }[];
  bestGreenTibial: number | null;
  lastImpactDate: string | null;
  todayTenderness: number | null;
  hasCheckinToday: boolean;
  /** Latest running load-response is elevated/concerning (exposure-normalised — never raw day-over-day). */
  abnormalResponse: boolean;
  acwrRatio: number | null;
  weekEndsISO: string[]; // 4, oldest → newest
};

function dayLabel(fromISO: string, todayISO: string): string {
  const diff = differenceInCalendarDays(parseISO(fromISO), parseISO(todayISO));
  if (diff <= 0) return "Idag";
  if (diff === 1) return "Imorgon";
  if (diff <= 6) {
    const w = format(parseISO(fromISO), "EEEE", { locale: sv });
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return format(parseISO(fromISO), "d MMM", { locale: sv });
}

export function buildCoachView(inp: CoachInput): CoachView {
  const { decision, recoveries, greenRunSessions, bestGreenTibial } = inp;

  const greenCount = greenRunSessions.length;
  const totalRec = recoveries.length;
  const trend = lagTrend(recoveries);
  const lags = recoveries.map((r) => r.daysUntilReady).filter((v): v is number => v != null);
  const avgLag = avg(lags);

  // ---- Confidence base ------------------------------------------------------
  let base = 58 + greenCount * 7 + Math.min(totalRec, 4) * 3;
  if (inp.abnormalResponse) base -= 15;
  if (!inp.hasCheckinToday) base -= 8;
  base = clamp(Math.round(base), 45, 95);

  // ---- 1. Capacity ----------------------------------------------------------
  const capacityMinutes = greenCount ? Math.max(...greenRunSessions.map((g) => g.minutes)) : null;
  const capacityLabel = capacityMinutes != null ? `${capacityMinutes} min` : "Ej testad";

  let progressionLabel: string;
  if (capacityMinutes != null && bestGreenTibial && decision.tibialBudget > 0) {
    const mins = Math.round(capacityMinutes * (decision.tibialBudget / bestGreenTibial));
    progressionLabel = `${mins} min`;
  } else {
    progressionLabel = FIRST_RUN_TEMPLATE.label;
  }

  // Weekly capacity series (cumulative best tolerated minutes as of each week).
  const capacitySeries = inp.weekEndsISO.map((end, i) => {
    const upto = greenRunSessions.filter((g) => g.date <= end).map((g) => g.minutes);
    return { week: `V${i + 1}`, minutes: upto.length ? Math.max(...upto) : null };
  });
  const nn = capacitySeries.map((s) => s.minutes).filter((v): v is number => v != null);
  let capacityTrend: Trend = "flat";
  if (nn.length >= 2) {
    if (nn[nn.length - 1] > nn[0] + 1) capacityTrend = "up";
    else if (nn[nn.length - 1] < nn[0] - 1) capacityTrend = "down";
  }
  const capacityTrendWord = capacityTrend === "up" ? "Ökande" : capacityTrend === "down" ? "Minskande" : "Stabil";

  // ---- 3. Recovery status ---------------------------------------------------
  const hoursSinceImpact =
    inp.lastImpactDate != null
      ? ((parseISO(inp.todayISO).getTime() - parseISO(inp.lastImpactDate).getTime()) / 86_400_000) * 24
      : Infinity;
  const last = recoveries[0];
  // Tenderness ≥7 is the hard safety floor (always delayed). 5–6 alone means
  // recovery is still in progress — not delayed — per the exposure-normalised rules.
  const hardTenderness = inp.todayTenderness != null && inp.todayTenderness >= 7;
  const elevatedTenderness = inp.todayTenderness != null && inp.todayTenderness >= 5 && !hardTenderness;

  let status: CoachStatus;
  if ((last && (last.status === "red" || last.status === "ongoing")) || trend === "worsening" || hardTenderness) {
    status = "delayed";
  } else if (hoursSinceImpact < 48 || (last && last.status === "yellow") || elevatedTenderness) {
    status = "in_progress";
  } else {
    status = "ready";
  }
  const statusLabel =
    status === "ready" ? "Ready for Impact" : status === "in_progress" ? "Recovery in Progress" : "Recovery Delayed";

  // Expected-ready date.
  let expectedReadyLabel = "Idag";
  if (status !== "ready" && inp.lastImpactDate) {
    const lagDays = last?.daysUntilReady ?? (avgLag != null ? Math.ceil(avgLag) : status === "delayed" ? 4 : 2);
    const windowDays = Math.max(2, lagDays);
    const readyISO = format(addDays(parseISO(inp.lastImpactDate), windowDays), "yyyy-MM-dd");
    expectedReadyLabel = readyISO <= inp.todayISO ? "Idag" : dayLabel(readyISO, inp.todayISO);
  }
  const statusTrend = trend === "improving" ? "improving" : trend === "worsening" ? "worsening" : "normal";
  const statusTrendWord =
    statusTrend === "improving" ? "Förbättras" : statusTrend === "worsening" ? "Försämras" : "Normal";
  const statusConfidence = clamp(base + (status === "ready" ? 5 : status === "delayed" ? -6 : 0), 45, 96);

  // ---- 2. Recommendation ----------------------------------------------------
  const rec = decision.recommendation;
  let kind: CoachView["recommendation"]["kind"];
  let label: string;
  let emoji: string;
  if (!inp.hasCheckinToday && rec === "log_checkin") {
    kind = "checkin"; label = "Logga check-in"; emoji = "📝";
  } else if (rec === "run_allowed" || rec === "repeat_previous_run" || rec === "reduce_run_load") {
    kind = "run"; label = "Löpning"; emoji = "🏃";
  } else if (rec === "bike_instead") {
    kind = "cycle"; label = "Zon 2-cykling"; emoji = "🚴";
  } else if (rec === "strength_only") {
    kind = "strength"; label = "Styrka"; emoji = "🏋️";
  } else {
    kind = "recovery"; label = "Återhämtning"; emoji = "😴";
  }

  const why =
    kind === "checkin"
      ? "Logga morgonens tryckömhet så vet jag exakt vad kroppen tål idag."
      : kind === "run" && rec === "run_allowed"
        ? "Skenbenen är redo och senaste passet tolererades. Ett löppass idag ger bra adaptation utan att överbelasta."
        : kind === "run" && rec === "repeat_previous_run"
          ? "Du är redo för impact, men förra dosen låg på gränsen. Upprepa samma pass och bekräfta att det landar bra."
          : kind === "run"
            ? "Morgonen är bra men förra passet gav lång återhämtning. En kortare löprunda idag håller nere risken."
            : kind === "cycle"
              ? elevatedTenderness
                ? "Ömheten är förhöjd idag (utan andra varningssignaler). Cykel eller styrka håller konditionen utan skenbensbelastning — kör du impact ändå: max samma dos som senast."
                : "Du sprang nyligen och skenbenen återhämtar sig. Cykel behåller konditionen med minimal belastning på benhinnorna."
              : kind === "strength"
                ? "Impact är inte läge idag. Underkroppsstyrka bygger kapacitet utan repetitiv stöt mot skenbenen."
                : "Ömheten är förhöjd. Vila benen idag så att nästa impact-pass landar bättre.";

  const recConfidence = clamp(base + (kind === "run" ? 4 : kind === "recovery" || kind === "cycle" ? 2 : 0), 45, 96);

  // ---- 4. Next impact session ----------------------------------------------
  const nextWhen = status === "ready" && (kind === "run") ? "Idag" : expectedReadyLabel;
  const suggestion = decision.prescription ?? (capacityMinutes != null ? `~${progressionLabel} löpning` : FIRST_RUN_TEMPLATE.label);
  const successProbability = clamp(base + (status === "ready" ? 6 : status === "delayed" ? -12 : -3), 40, 95);

  // ---- 6. Decision reasoning ------------------------------------------------
  const lagOk = trend !== "worsening" && (avgLag == null || avgLag <= 3);
  const loadOk = inp.acwrRatio == null || inp.acwrRatio <= 1.3;
  // trailing consecutive green running recoveries
  let consec = 0;
  for (const r of recoveries) {
    if (r.type !== "running") continue;
    if (r.status === "green") consec++;
    else break;
  }
  const reasoning = [
    { ok: lagOk, text: lagOk ? "Stabil recovery lag" : "Recovery lag förhöjd" },
    {
      ok: !inp.abnormalResponse,
      text: !inp.abnormalResponse
        ? "Respons i nivå med belastningen"
        : "Respons över förväntan efter senaste passet",
    },
    { ok: loadOk, text: loadOk ? "Load inom målzon" : "Load-topp upptäckt" },
    {
      ok: consec >= 2,
      text: consec >= 2 ? `${consec} löppass i rad tolererade` : consec === 1 ? "Ett tolererat löppass" : "Inga tolererade löppass än",
    },
  ];

  return {
    capacityMinutes,
    capacityLabel,
    capacityTrend,
    capacityTrendWord,
    progressionLabel,
    confidence: base,
    recommendation: { kind, label, emoji, why, confidence: recConfidence },
    status,
    statusLabel,
    expectedReadyLabel,
    statusTrend,
    statusTrendWord,
    statusConfidence,
    nextImpact: { whenLabel: nextWhen, suggestion, successProbability },
    capacitySeries,
    reasoning,
  };
}
