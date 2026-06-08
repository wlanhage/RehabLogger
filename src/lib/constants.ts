// NOTE: Training types are now user-configurable. See src/lib/training-types.ts
// for the master list. Anything in this file is global and not type-specific.

export const GYM_EXERCISES = [
  "Back Squat",
  "Bulgarian Split Squat",
  "Romanian Deadlift",
  "Leg Press",
  "Hip Thrust",
  "Walking Lunge",
  "Leg Extension",
  "Leg Curl",
  "Standing Calf Raise",
  "Seated Calf Raise",
  "Tibialis Raise",
  "Plank",
] as const;

export const SET_FORMATS = ["2x8", "3x8", "3x10", "3x12", "3x15", "custom"] as const;
