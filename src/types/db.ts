export type Session = {
  id: string;
  user_id: string;
  date: string;
  /** Free-form training-type slug (see src/lib/training-types.ts). */
  type: string;
  duration_minutes: number | null;
  distance_km: number | null;
  notes: string | null;
  created_at: string;
  // Load Intelligence additions
  rpe: number | null;
  running_minutes: number | null;
  surface: string | null;
  shoes: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  pace_seconds_per_km: number | null;
  body_kg: number | null;
  imported_from: string;
  external_id: string | null;
};

export type GymSet = {
  id: string;
  session_id: string;
  user_id: string;
  position: number;
  exercise: string;
  set_format: string | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  notes: string | null;
  skipped: boolean;
};

export type RehabFollowup = {
  id: string;
  session_id: string;
  user_id: string;
  pain_score: number | null;
  pain_location: string | null;
  reaction: string | null;
  rpe: number | null;
  created_at: string;
};

export type Profile = {
  user_id: string;
  display_name: string | null;
  sex: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  rehab_focus: string | null;
  /** When the rehab issue started (free-form, e.g. "March 2026"). */
  problem_started: string | null;
  goals: string | null;
  notes: string | null;
  /** Slugs of training types the user does. */
  training_types: string[] | null;
  /** Set once the user finishes onboarding. */
  onboarded_at: string | null;
  updated_at: string;
};

export type WeeklyPlan = {
  id: string;
  user_id: string;
  week_start: string;
  content: string;
  created_at: string;
};

export type DailyCheckin = {
  id: string;
  user_id: string;
  date: string;
  soreness: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Load Intelligence additions
  shin_tenderness_left: number | null;
  shin_tenderness_right: number | null;
  safe_to_run: "yes" | "unsure" | "no" | null;
  sleep_quality: number | null;
  body_weight_kg: number | null;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
