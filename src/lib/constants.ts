// NOTE: Training types are now user-configurable. See src/lib/training-types.ts
// for the master list. Anything in this file is global and not type-specific.

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

// Legacy — only used by the old training-day follow-up form. Kept to avoid
// breaking imports; new daily check-ins skip location entirely.
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
