"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function num(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function str(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const row = {
    user_id: user.id,
    display_name: str(formData.get("display_name")),
    sex: str(formData.get("sex")),
    age: num(formData.get("age")),
    weight_kg: num(formData.get("weight_kg")),
    height_cm: num(formData.get("height_cm")),
    rehab_focus: str(formData.get("rehab_focus")),
    goals: str(formData.get("goals")),
    notes: str(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/coach");
  revalidatePath("/coach/profile");
  return { ok: true };
}
