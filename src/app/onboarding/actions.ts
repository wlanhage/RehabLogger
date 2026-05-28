"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type OnboardingData = {
  display_name: string;
  sex: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  rehab_focus: string;
  problem_started: string;
  goals: string;
  notes: string;
  training_types: string[];
};

export async function completeOnboarding(data: OnboardingData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const row = {
    user_id: user.id,
    display_name: data.display_name || null,
    sex: data.sex || null,
    age: data.age,
    weight_kg: data.weight_kg,
    height_cm: data.height_cm,
    rehab_focus: data.rehab_focus || null,
    problem_started: data.problem_started || null,
    goals: data.goals || null,
    notes: data.notes || null,
    training_types: data.training_types,
    onboarded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/");
}
