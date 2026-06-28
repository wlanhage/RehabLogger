// All tunables for the Load Intelligence engine live here. Nothing magic is
// hidden in the algorithms — change behaviour by editing these.

/** Activity slugs that load the tibia through impact (drive MTSS risk). */
export const IMPACT_ACTIVITIES = ["running", "football"] as const;

/** Systemic (cardio/fatigue) impact weighting per activity — used with sRPE. */
export const SYSTEMIC_IMPACT: Record<string, number> = {
  running: 1.0,
  football: 1.0,
  cycling: 1.0,
  walking: 0.8,
  gym: 0.8,
  mobility: 0.4,
  rest: 0,
};

/**
 * Tibial (bone-stress) impact weighting per activity. Cycling/gym/mobility do
 * not meaningfully load the tibia in bending, so they are ~0. This is the axis
 * that predicts the user's delayed shin response.
 */
export const TIBIAL_IMPACT: Record<string, number> = {
  running: 1.5,
  football: 2.5,
  walking: 0.25,
  cycling: 0,
  gym: 0, // lower-body strength loads bone but not via repetitive impact; tracked separately
  mobility: 0,
  rest: 0,
};

/** Surface multiplier for tibial load. Softer surface = less peak load. */
export const SURFACE_FACTOR: Record<string, number> = {
  asphalt: 1.1,
  gravel: 1.0,
  mixed: 1.0,
  treadmill: 0.9,
  grass: 0.85,
};

/** Reference runner mass. Tibial load scales linearly above/below this. */
export const REFERENCE_BODY_KG = 75;

/** Estimated running cadence (steps/min) when only minutes are known. */
export const DEFAULT_CADENCE = 165;

/** Tenderness (0–10) at or below this counts as "recovered to baseline". */
export const RECOVERY_TOLERANCE = 1;

/** Default baseline tenderness when no pre-session history exists. */
export const DEFAULT_BASELINE_TENDERNESS = 0;

/** Minimum hours between impact sessions the engine will ever allow. */
export const MIN_HOURS_BETWEEN_IMPACT = 48;

/** Progression ceiling when green: max fraction to add to tibial budget. */
export const GREEN_PROGRESSION = 0.08; // +8%

/** Decision thresholds (worse side governs). */
export const THRESHOLDS = {
  tendernessGreenMax: 2,
  tendernessRedMin: 5,
  readinessLagGreenMax: 2, // days_until_ready ≤ 2 is good
  readinessLagRedMin: 4,
} as const;

/**
 * Cold-start run/walk template (the user's first jog after layoff).
 * 5 min walk warmup, [2 min jog / 2 min walk] × 6, 5 min walk cooldown.
 */
export const FIRST_RUN_TEMPLATE = {
  label: "Run/walk: 5 min gång, sedan 2 min jogg / 2 min gång × 6, 5 min gång",
  running_minutes: 12, // 2 × 6 jog blocks
  total_minutes: 34,
  surface: "treadmill",
} as const;
