import {
  SYSTEMIC_IMPACT,
  TIBIAL_IMPACT,
  SURFACE_FACTOR,
  REFERENCE_BODY_KG,
  DEFAULT_CADENCE,
} from "./config";

export type SessionLoadInput = {
  type: string;
  duration_minutes: number | null;
  running_minutes: number | null;
  rpe: number | null;
  surface: string | null;
  body_kg: number | null;
  /** Falls back to this when a session has no body_kg snapshot. */
  fallbackBodyKg?: number | null;
};

export type SessionLoad = {
  systemic: number; // AU — cardio / general fatigue (Foster sRPE style)
  tibial: number; // AU — bone-stress load on the shins
};

/**
 * Impact minutes that actually load the tibia:
 *  - running: the jog portion (running_minutes), else full duration
 *  - football: full duration (constant cutting/impact)
 *  - walking: full duration (low weight, see TIBIAL_IMPACT)
 *  - everything else: 0
 */
function impactMinutes(input: SessionLoadInput): number {
  const dur = input.duration_minutes ?? 0;
  if (input.type === "running") return input.running_minutes ?? dur;
  if (input.type === "football" || input.type === "walking") return dur;
  return 0;
}

export function computeSessionLoad(input: SessionLoadInput): SessionLoad {
  const dur = input.duration_minutes ?? 0;
  const rpe = input.rpe ?? 0;

  // Systemic = session-RPE × activity weighting.
  const systemic = dur * rpe * (SYSTEMIC_IMPACT[input.type] ?? 0.5);

  // Tibial = impact step-count × force-per-step × surface, where
  // force-per-step scales with body mass relative to the reference runner.
  const tImpact = TIBIAL_IMPACT[input.type] ?? 0;
  let tibial = 0;
  if (tImpact > 0) {
    const minutes = impactMinutes(input);
    const bodyKg = input.body_kg ?? input.fallbackBodyKg ?? REFERENCE_BODY_KG;
    const bodyFactor = bodyKg / REFERENCE_BODY_KG;
    const surface = SURFACE_FACTOR[input.surface ?? ""] ?? 1.0;
    const steps = (minutes * DEFAULT_CADENCE) / 100; // /100 keeps AU human-scaled
    tibial = steps * bodyFactor * surface * tImpact;
  }

  return {
    systemic: Math.round(systemic),
    tibial: Math.round(tibial * 10) / 10,
  };
}

/** Rolling sums for acute (7d) / chronic (28d) with the ACWR caveat. */
export function rollingLoad(
  dailyTibial: { date: string; tibial: number }[],
  todayISO: string,
) {
  const ms = (d: string) => new Date(d + "T00:00:00").getTime();
  const today = ms(todayISO);
  const day = 86_400_000;
  let acute = 0;
  let chronic = 0;
  for (const d of dailyTibial) {
    const age = (today - ms(d.date)) / day;
    if (age >= 0 && age < 7) acute += d.tibial;
    if (age >= 0 && age < 28) chronic += d.tibial;
  }
  const chronicWeekly = chronic / 4;
  // Guard the divide-by-near-zero artefact during rebuild.
  const ratio = chronicWeekly >= 1 ? acute / chronicWeekly : null;
  return { acute, chronicWeekly, ratio };
}
