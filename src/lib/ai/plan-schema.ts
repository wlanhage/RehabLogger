// Structured weekly plan document returned by the AI coach.
// Stored as JSON-stringified text in `weekly_plans.content`.

export const SESSION_TYPES = ["gym", "cycling", "walking", "football", "rest", "other"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type PlanExercise = {
  /** Must match one of GYM_EXERCISES if possible. */
  exercise: string;
  sets?: number;
  reps?: number;
  /** Free-form to allow "bodyweight", "60kg", "progressiv 50→55kg" */
  weight?: string;
  /** Tempo, tips, fokuspunkter */
  notes?: string;
};

export type WeeklyPlanDay = {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** "Mån"–"Sön" */
  weekday: string;
  /** True if this day is already logged (in the past with a session). */
  completed?: boolean;
  /** Short purpose, e.g. "Aktiv återhämtning" */
  intent: string;
  /** One of SESSION_TYPES */
  session_type: SessionType;
  /** Free-text like "30–40 min", "60 min löpning" */
  duration?: string;
  /** Free-text like "RPE 4–5/10" or "samtalstempo" */
  intensity?: string;
  /** Free-text: övningar, fokuspunkter, format */
  focus?: string;
  /** Symptom-koppling: vad ska användaren känna efter / akta sig för */
  watch_for?: string;
  /** Required when session_type === "gym" — concrete exercises to perform. */
  exercises?: PlanExercise[];
};

export type WeeklyPlanDoc = {
  /** ISO date of the week's Monday */
  week_start: string;
  /** 1–3 sentences: load assessment + week strategy */
  summary: string;
  /** Optional headline takeaway */
  key_focus?: string;
  /** Exactly 7 entries Mon–Sun */
  days: WeeklyPlanDay[];
};

export function isWeeklyPlanDoc(v: unknown): v is WeeklyPlanDoc {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.summary !== "string") return false;
  if (!Array.isArray(o.days) || o.days.length === 0) return false;
  return o.days.every((d) => {
    if (!d || typeof d !== "object") return false;
    const r = d as Record<string, unknown>;
    return typeof r.date === "string" && typeof r.weekday === "string" && typeof r.intent === "string" && typeof r.session_type === "string";
  });
}

/** Try to parse the stored content. Returns null if it's legacy markdown. */
export function tryParsePlan(content: string): WeeklyPlanDoc | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isWeeklyPlanDoc(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
