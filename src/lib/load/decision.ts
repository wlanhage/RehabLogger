import {
  THRESHOLDS,
  MIN_HOURS_BETWEEN_IMPACT,
  RECOVERED_REST_DAYS,
  GREEN_PROGRESSION,
  FIRST_RUN_TEMPLATE,
  TIBIAL_IMPACT,
  SURFACE_FACTOR,
  REFERENCE_BODY_KG,
  DEFAULT_CADENCE,
} from "./config";
import {
  type RecoveryResponse,
  type CheckinPoint,
  bestTolerableTibial,
  lagTrend,
} from "./recovery";

export type Light = "green" | "yellow" | "red";

export type Recommendation =
  | "run_allowed"
  | "repeat_previous_run"
  | "reduce_run_load"
  | "bike_instead"
  | "strength_only"
  | "rest"
  | "log_checkin";

export type DailyDecision = {
  light: Light;
  recommendation: Recommendation;
  /** Suggested max tibial load today (AU). 0 = no impact today. */
  tibialBudget: number;
  /** Concrete run/walk prescription when running is on the table. */
  prescription: string | null;
  /** Natural-language motivation in Swedish. */
  rationale: string;
  /** True before any impact history exists. */
  coldStart: boolean;
};

export type DecisionInput = {
  todayISO: string;
  /** Today's check-in (may be missing). */
  today: CheckinPoint | null;
  /** All derived recovery responses, newest first. */
  recoveries: RecoveryResponse[];
  /** Date of the most recent impact session, if any. */
  lastImpactDate: string | null;
  /** Whether that last impact session has fully recovered (green/yellow resolved). */
  lastImpactResolved: boolean;
  /** Body weight for prescription load math. */
  bodyKg: number | null;
  /** Impact sessions already logged in the current ISO week (Mon–today). */
  runsThisWeek: number;
  /** Today's sleep quality 1–10 (optional). */
  sleepQuality?: number | null;
  /** Today's general fatigue 1–10 (optional). */
  fatigue?: number | null;
};

/** How much to cut the dose after a red recovery response. */
const RED_DOSE_REDUCTION = 0.8; // repeat at 80% of the load that caused the flare

const IMPACT_RECS: Recommendation[] = ["run_allowed", "repeat_previous_run", "reduce_run_load"];

const dayMs = 86_400_000;
const hoursSince = (fromISO: string, todayISO: string) =>
  ((new Date(todayISO + "T00:00:00").getTime() -
    new Date(fromISO + "T00:00:00").getTime()) /
    dayMs) *
  24;

/** Tibial load of a hypothetical run on a given surface for this user. */
export function tibialOf(runningMinutes: number, bodyKg: number | null, surface: string): number {
  const bodyFactor = (bodyKg ?? REFERENCE_BODY_KG) / REFERENCE_BODY_KG;
  const surf = SURFACE_FACTOR[surface] ?? 1.0;
  const steps = (runningMinutes * DEFAULT_CADENCE) / 100;
  return Math.round(steps * bodyFactor * surf * TIBIAL_IMPACT.running * 10) / 10;
}

export function decideToday(input: DecisionInput): DailyDecision {
  const d = rawDecision(input);

  // #1 — Never clear impact training without today's morning check-in.
  if (input.today == null && IMPACT_RECS.includes(d.recommendation)) {
    return {
      light: "yellow",
      recommendation: "log_checkin",
      tibialBudget: 0,
      prescription: null,
      coldStart: d.coldStart,
      rationale:
        "Logga morgonens check-in (tryckömhet vänster/höger) innan jag kan frige impact — " +
        "det är dagsformen som avgör. Tills dess: cykel eller styrka går alltid bra.",
    };
  }
  return d;
}

function rawDecision(input: DecisionInput): DailyDecision {
  const { today, recoveries, lastImpactDate, lastImpactResolved, bodyKg, runsThisWeek } = input;
  const coldStart = recoveries.length === 0;

  const tenderL = today?.tendernessWorse ?? null;
  const safe = today?.safeToRun ?? null;

  const hoursSinceImpact =
    lastImpactDate != null ? hoursSince(lastImpactDate, input.todayISO) : Infinity;
  const insideRecoveryWindow = hoursSinceImpact < MIN_HOURS_BETWEEN_IMPACT;
  const daysSinceImpact = hoursSinceImpact / 24;

  const trend = lagTrend(recoveries);
  const bestGreen = bestTolerableTibial(recoveries);

  // Recovered by current state: a long, calm gap since the last impact means
  // stale "unresolved" / "worsening" signals no longer apply. This is the fix
  // for "green + rested a week, but the engine still says recovery delayed".
  const recoveredByRest =
    daysSinceImpact >= RECOVERED_REST_DAYS &&
    (tenderL == null || tenderL < THRESHOLDS.tendernessRedMin);

  // #4 — poor systemic recovery blocks progression (not a red gate on its own).
  const poorRecovery =
    (input.sleepQuality != null && input.sleepQuality <= 3) ||
    (input.fatigue != null && input.fatigue >= 8);

  // ---- RED gates ------------------------------------------------------------
  // Weighting: recovery lag > readiness > tenderness. Tenderness alone forces
  // red only at the hard safety floor (>=7); at 5–6 it needs a second signal.
  const hardTender = tenderL != null && tenderL >= THRESHOLDS.tendernessHardRedMin;
  const elevatedTender = tenderL != null && tenderL >= THRESHOLDS.tendernessRedMin && !hardTender;

  const redReasons: string[] = [];
  if (hardTender)
    redReasons.push(`tryckömhet ${tenderL}/10 (≥${THRESHOLDS.tendernessHardRedMin} är en hård säkerhetsgräns)`);
  if (safe === "no") redReasons.push("du markerade att det känns riskabelt att springa");
  // Stale signals below only count if you haven't already rested off the last
  // impact — an old, resolved-by-time run must not force red.
  if (!lastImpactResolved && lastImpactDate && !recoveredByRest)
    redReasons.push("förra impact-passet har inte återhämtat sig än");
  if (trend === "worsening" && !recoveredByRest) redReasons.push("recovery-trenden förvärras");
  // 5–6 tenderness reds only in combination with one of the signals above.
  if (elevatedTender && redReasons.length > 0)
    redReasons.push(`tryckömhet ${tenderL}/10 i kombination med ovanstående`);

  if (redReasons.length > 0) {
    const canBike = !hardTender;
    return {
      light: "red",
      recommendation: canBike ? "bike_instead" : "rest",
      tibialBudget: 0,
      prescription: null,
      coldStart,
      rationale:
        `Rött idag — ${redReasons.join("; ")}. ` +
        (canBike
          ? "Kör ingen impact. Cykel eller överkroppsstyrka går bra och belastar inte skenbenen."
          : "Vila benen helt idag. Ingen löpning, fotboll eller tung underkroppsstyrka."),
    };
  }

  // ---- ELEVATED TENDERNESS (5–6), no other warning signal → YELLOW ----------
  // Never a progression day. Prefer non-impact; impact capped at repeat/reduce.
  if (elevatedTender) {
    const repeatBudget =
      bestGreen ?? tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface);
    return {
      light: "yellow",
      recommendation: "bike_instead",
      tibialBudget: repeatBudget,
      prescription:
        "Helst cykel eller styrka idag. Kör du ändå impact: max upprepa förra tolererade passet — öka inte.",
      coldStart,
      rationale:
        `Gult — tryckömhet ${tenderL}/10 är förhöjd, men recovery lag och din egen bedömning är stabila, så ömhet ensam ger inte rött. ` +
        "Progression är låst idag: välj helst cykel/styrka, annars max samma dos som senast.",
    };
  }

  // ---- YELLOW gates ---------------------------------------------------------
  const yellowReasons: string[] = [];
  if (tenderL != null && tenderL >= 3) yellowReasons.push(`tryckömhet ${tenderL}/10`);
  if (safe === "unsure") yellowReasons.push("du är osäker på om det är säkert att springa");
  if (insideRecoveryWindow)
    yellowReasons.push(
      `bara ${Math.round(hoursSinceImpact)}h sedan senaste impact-pass (minst ${MIN_HOURS_BETWEEN_IMPACT}h behövs)`,
    );
  if (trend === "flat") yellowReasons.push("recovery-lagget förbättras inte ännu");

  if (yellowReasons.length > 0) {
    if (insideRecoveryWindow) {
      const nextDate = lastImpactDate
        ? new Date(new Date(lastImpactDate + "T00:00:00").getTime() + MIN_HOURS_BETWEEN_IMPACT * 3_600_000)
            .toISOString()
            .slice(0, 10)
        : null;
      const ranToday = hoursSinceImpact < 20;
      return {
        light: "yellow",
        recommendation: "bike_instead",
        tibialBudget: 0,
        prescription: null,
        coldStart,
        rationale: ranToday
          ? `Du körde impact idag — nästa löp/fotbollspass tidigast ${nextDate}. ` +
            "Skenbenen behöver 48–96h. Vill du röra på dig idag: cykel eller styrka."
          : `Gult — ${yellowReasons.join("; ")}. ` +
            `Skenbenen behöver 48–96h efter impact${nextDate ? ` (tidigast ${nextDate})` : ""}. Cykla eller kör styrka idag.`,
      };
    }
    const repeatBudget = bestGreen ?? tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface);
    return {
      light: "yellow",
      recommendation: "repeat_previous_run",
      tibialBudget: repeatBudget,
      prescription: bestGreen
        ? "Upprepa exakt ditt senaste tolererade löp/gång-pass. Öka ingenting."
        : FIRST_RUN_TEMPLATE.label,
      coldStart,
      rationale:
        `Gult — ${yellowReasons.join("; ")}. ` +
        "Du kan testa impact men håll dig till exakt samma belastning som sist — öka inte.",
    };
  }

  // Running progression is tracked separately from football: a tolerated
  // football dose does not license a running dose, and vice versa.
  const runningRecoveries = recoveries.filter((r) => r.type === "running");
  const coldStartRun = runningRecoveries.length === 0;
  const last = runningRecoveries[0];
  const bestGreenRun = bestTolerableTibial(runningRecoveries);
  const runTrend = lagTrend(runningRecoveries);

  // ---- RUNNING COLD START (no running history, even if football exists) ------
  if (coldStartRun) {
    return {
      light: "green",
      recommendation: "run_allowed",
      tibialBudget: tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface),
      prescription: FIRST_RUN_TEMPLATE.label,
      coldStart: true,
      rationale:
        "Grönt och inga tidigare löppass att jämföra med. Starta försiktigt med run/walk-mallen. " +
        "Logga tryckömheten varje morgon de kommande 4 dagarna — det är reaktionen efteråt som styr nästa pass.",
    };
  }

  // ---- DOSE RESPONSE: the last RUNNING recovery governs progression ---------
  if (last && last.status === "red") {
    const reduced = Math.round(last.tibial * RED_DOSE_REDUCTION * 10) / 10;
    return {
      light: "yellow",
      recommendation: "reduce_run_load",
      tibialBudget: reduced,
      prescription: `Minska — kör ~${Math.round(RED_DOSE_REDUCTION * 100)}% av förra passet (tibial budget ${reduced} AU, var ${last.tibial}).`,
      coldStart: false,
      rationale:
        `Morgonen är bra, men ditt senaste löp/fotbollspass gav ${last.daysUntilReady ?? "4+"} dagars recovery lag (rött). ` +
        "Det var en för hög dos. Backa till en mindre belastning den här gången innan du försöker öka igen.",
    };
  }

  if (last && last.status === "yellow") {
    return {
      light: "green",
      recommendation: "repeat_previous_run",
      tibialBudget: last.tibial,
      prescription: `Upprepa exakt förra passet (tibial budget ${last.tibial} AU). Öka inte.`,
      coldStart: false,
      rationale:
        "Morgonen är grön och fönstret är klart, men förra passet låg på gränsen (gult). " +
        "Upprepa samma belastning och bekräfta att den blir grön innan du ökar.",
    };
  }

  // Last run never cleanly resolved within its window (ongoing) but you've since
  // rested and are green now → allow a run, but hold the dose (don't progress).
  if (last && last.status === "ongoing") {
    const holdLoad = bestGreenRun ?? tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface);
    return {
      light: "green",
      recommendation: "repeat_previous_run",
      tibialBudget: holdLoad,
      prescription: bestGreenRun
        ? `Håll samma dos som ditt senaste tolererade pass (tibial budget ${holdLoad} AU) — öka inte.`
        : FIRST_RUN_TEMPLATE.label,
      coldStart: false,
      rationale:
        "Du är grön och utvilad, men förra löppasset tog lite längre att lugna ner sig. " +
        "Kör gärna, men håll samma belastning som senast tills responsen är snabb och tydlig igen.",
    };
  }

  // last was green. Enforce "never add frequency AND load in the same week".
  const repeatLoad =
    bestGreenRun ?? tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface);

  if (runsThisWeek >= 2) {
    return {
      light: "yellow",
      recommendation: "bike_instead",
      tibialBudget: 0,
      prescription: null,
      coldStart: false,
      rationale:
        `Morgonen är grön, men du har redan kört ${runsThisWeek} impact-pass denna vecka. ` +
        "Under uppbyggnad räcker det — lägg dagens pass på cykel eller styrka och spara ett tredje löppass till en stabil vecka framåt.",
    };
  }

  if (runsThisWeek === 1) {
    return {
      light: "green",
      recommendation: "repeat_previous_run",
      tibialBudget: repeatLoad,
      prescription: `Lägg till ett andra löppass denna vecka på SAMMA belastning (tibial budget ${repeatLoad} AU). Öka inte dosen.`,
      coldStart: false,
      rationale:
        "Grönt och fönstret är klart. Det här blir veckans andra löppass — det är i sig en progression (frekvens). " +
        "Öka därför inte distansen samma vecka: håll exakt samma dos som det tolererade passet.",
    };
  }

  // 0 runs this week → week's run. Allow a bump unless systemic recovery is poor (#4).
  if (poorRecovery) {
    return {
      light: "green",
      recommendation: "repeat_previous_run",
      tibialBudget: repeatLoad,
      prescription: bestGreenRun
        ? `Håll samma dos som senast (tibial budget ${repeatLoad} AU) — öka inte idag.`
        : FIRST_RUN_TEMPLATE.label,
      coldStart: false,
      rationale:
        `Skenbenen är grönt, men ${input.sleepQuality != null && input.sleepQuality <= 3 ? "sömnen är låg" : "tröttheten är hög"} idag. ` +
        "Spring gärna, men öka inte belastningen när återhämtningen är nedsatt — upprepa förra passet.",
    };
  }

  const budget =
    bestGreenRun != null ? Math.round(bestGreenRun * (1 + GREEN_PROGRESSION) * 10) / 10 : repeatLoad;

  return {
    light: "green",
    recommendation: "run_allowed",
    tibialBudget: budget,
    prescription: bestGreenRun
      ? `Du får öka upp till ~${Math.round(GREEN_PROGRESSION * 100)}% mot ditt bästa tolererade löppass (tibial budget ${budget} AU).`
      : FIRST_RUN_TEMPLATE.label,
    coldStart: false,
    rationale:
      `Grönt — tryckömhet låg, ${runTrend === "improving" ? "recovery-trenden förbättras" : "stabil recovery"} och fönstret efter förra passet är klart. ` +
      "Veckans första löppass: du får öka lite. Ökar du distansen nu, lägg inte till ett extra löppass samma vecka.",
  };
}
