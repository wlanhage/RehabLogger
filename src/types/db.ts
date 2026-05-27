import type { TrainingType } from "@/lib/constants";

export type Session = {
  id: string;
  user_id: string;
  date: string;
  type: TrainingType;
  duration_minutes: number | null;
  distance_km: number | null;
  notes: string | null;
  created_at: string;
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
  goals: string | null;
  notes: string | null;
  updated_at: string;
};

export type WeeklyPlan = {
  id: string;
  user_id: string;
  week_start: string;
  content: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
