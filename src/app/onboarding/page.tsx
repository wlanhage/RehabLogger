import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./wizard";
import type { Profile } from "@/types/db";
import { DEFAULT_ENABLED } from "@/lib/training-types";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").maybeSingle();
  if (profile?.onboarded_at) redirect("/");

  const initial: Partial<Profile> = (profile as Profile | null) ?? {};

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-4 pt-8 pb-12">
      <OnboardingWizard
        initial={{
          display_name: initial.display_name ?? "",
          sex: initial.sex ?? "",
          age: initial.age ?? null,
          weight_kg: initial.weight_kg ?? null,
          height_cm: initial.height_cm ?? null,
          rehab_focus: initial.rehab_focus ?? "",
          problem_started: initial.problem_started ?? "",
          baseline_tenderness: initial.baseline_tenderness ?? null,
          goals: initial.goals ?? "",
          notes: initial.notes ?? "",
          training_types: initial.training_types ?? DEFAULT_ENABLED,
        }}
      />
    </main>
  );
}
