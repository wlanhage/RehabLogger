import {
  THRESHOLDS,
  MIN_HOURS_BETWEEN_IMPACT,
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
  | "rest";

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
};

/** How much to cut the dose after a red recovery response. */
const RED_DOSE_REDUCTION = 0.8; // repeat at 80% of the load that caused the flare

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
  const { today, recoveries, lastImpactDate, lastImpactResolved, bodyKg } = input;
  const coldStart = recoveries.length === 0;

  const tenderL = today?.tendernessWorse ?? null;
  const safe = today?.safeToRun ?? null;

  const hoursSinceImpact =
    lastImpactDate != null ? hoursSince(lastImpactDate, input.todayISO) : Infinity;
  const insideRecoveryWindow = hoursSinceImpact < MIN_HOURS_BETWEEN_IMPACT;

  const trend = lagTrend(recoveries);
  const bestGreen = bestTolerableTibial(recoveries);

  // ---- RED gates ------------------------------------------------------------
  const redReasons: string[] = [];
  if (tenderL != null && tenderL >= THRESHOLDS.tendernessRedMin)
    redReasons.push(`tryckömhet ${tenderL}/10`);
  if (safe === "no") redReasons.push("du markerade att det känns riskabelt att springa");
  if (!lastImpactResolved && lastImpactDate)
    redReasons.push("förra impact-passet har inte återhämtat sig än");
  if (trend === "worsening") redReasons.push("recovery-trenden förvärras");

  if (redReasons.length > 0) {
    const canBike = tenderL == null || tenderL < THRESHOLDS.tendernessRedMin;
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
    // Inside the bone-recovery window → no impact at all today.
    if (insideRecoveryWindow) {
      return {
        light: "yellow",
        recommendation: "bike_instead",
        tibialBudget: 0,
        prescription: null,
        coldStart,
        rationale:
          `Gult — ${yellowReasons.join("; ")}. ` +
          "Skenbenen behöver fönstret 48–96h efter impact. Cykla eller kör styrka idag, spring inte.",
      };
    }
    // Outside window but not clearly green → repeat last tolerated load, no increase.
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

  // ---- COLD START -----------------------------------------------------------
  if (coldStart) {
    return {
      light: "green",
      recommendation: "run_allowed",
      tibialBudget: tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface),
      prescription: FIRST_RUN_TEMPLATE.label,
      coldStart: true,
      rationale:
        "Grönt och inga tidigare impact-pass att jämföra med. Starta försiktigt med run/walk-mallen. " +
        "Logga tryckömheten varje morgon de kommande 4 dagarna — det är reaktionen efteråt som styr nästa pass.",
    };
  }

  // ---- DOSE RESPONSE: let the LAST impact's recovery govern progression -----
  // Morning is fine and the recovery window has cleared. Now: was the previous
  // dose tolerated? Red → reduce. Yellow → repeat. Green → allow a small bump.
  const last = recoveries[0]; // newest first

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

  // last was green (or only green history) → allow a small progression.
  const budget =
    bestGreen != null
      ? Math.round(bestGreen * (1 + GREEN_PROGRESSION) * 10) / 10
      : tibialOf(FIRST_RUN_TEMPLATE.running_minutes, bodyKg, FIRST_RUN_TEMPLATE.surface);

  return {
    light: "green",
    recommendation: "run_allowed",
    tibialBudget: budget,
    prescription: bestGreen
      ? `Du får öka upp till ~${Math.round(GREEN_PROGRESSION * 100)}% mot ditt bästa tolererade pass (tibial budget ${budget} AU).`
      : FIRST_RUN_TEMPLATE.label,
    coldStart: false,
    rationale:
      `Grönt — tryckömhet låg, ${trend === "improving" ? "recovery-trenden förbättras" : "stabil recovery"} och fönstret efter förra passet är klart. ` +
      "Du får springa och öka lite. Öka antingen tid eller frekvens denna vecka — inte båda.",
  };
}
