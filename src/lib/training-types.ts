import {
  Dumbbell,
  Bike,
  Footprints,
  Volleyball,
  Waves,
  Activity,
  Mountain,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";

export type TrainingFlow = "gym" | "cardio";

export type TrainingTypeDef = {
  /** Persisted in the DB (sessions.type, profiles.training_types[]). */
  slug: string;
  /** Shown to the user. */
  label: string;
  icon: LucideIcon;
  /** Which logging flow to use. "gym" → multi-exercise. "cardio" → duration/distance. */
  flow: TrainingFlow;
};

export const TRAINING_TYPES: TrainingTypeDef[] = [
  { slug: "gym",        label: "Styrketräning",   icon: Dumbbell,       flow: "gym"    },
  { slug: "running",    label: "Löpning",         icon: Footprints,     flow: "cardio" },
  { slug: "cycling",    label: "Cykling",         icon: Bike,           flow: "cardio" },
  { slug: "walking",    label: "Promenad",        icon: PersonStanding, flow: "cardio" },
  { slug: "football",   label: "Fotboll",         icon: Volleyball,     flow: "cardio" },
  { slug: "swimming",   label: "Simning",         icon: Waves,          flow: "cardio" },
  { slug: "basketball", label: "Basket",          icon: Activity,       flow: "cardio" },
  { slug: "tennis",     label: "Tennis",          icon: Activity,       flow: "cardio" },
  { slug: "yoga",       label: "Yoga / Rörlighet", icon: Activity,      flow: "cardio" },
  { slug: "climbing",   label: "Klättring",       icon: Mountain,       flow: "cardio" },
  { slug: "other",      label: "Annat",           icon: Activity,       flow: "cardio" },
];

const BY_SLUG = new Map(TRAINING_TYPES.map((t) => [t.slug, t]));

export function getType(slug: string): TrainingTypeDef | undefined {
  return BY_SLUG.get(slug);
}

export function labelFor(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

export function iconFor(slug: string): LucideIcon {
  return BY_SLUG.get(slug)?.icon ?? Activity;
}

export function flowFor(slug: string): TrainingFlow {
  return BY_SLUG.get(slug)?.flow ?? "cardio";
}

export const DEFAULT_ENABLED = ["gym", "cycling", "walking", "football"];
