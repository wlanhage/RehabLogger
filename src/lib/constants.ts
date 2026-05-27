export const TRAINING_TYPES = ["gym", "cycling", "walking", "football"] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const GYM_EXERCISES = [
  "Bulgarian Split Squat",
  "Romanian Deadlift",
  "Leg Press",
  "Standing Calf Raise",
  "Seated Calf Raise",
  "Tibialis Raise",
  "Plank",
] as const;

export const SET_FORMATS = ["2x8", "3x8", "3x10", "3x12", "3x15", "custom"] as const;

export const PAIN_LOCATIONS = [
  "Left shin inside",
  "Left shin front",
  "Left shin outside",
  "Right shin inside",
  "Right shin front",
  "Right shin outside",
  "Diffuse",
  "Other",
] as const;

export const REACTIONS = [
  "No reaction",
  "Sore 1 day",
  "Sore 2 days",
  "Sore 3–5 days",
  "Worse than usual",
] as const;
