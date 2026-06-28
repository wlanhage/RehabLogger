"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function enrichSession(formData: FormData) {
  const id = String(formData.get("session_id"));

  const numOrNull = (v: FormDataEntryValue | null) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const rpe = numOrNull(formData.get("rpe"));
  const running_minutes = numOrNull(formData.get("running_minutes"));
  const surfaceRaw = String(formData.get("surface") ?? "").trim();
  const surface = surfaceRaw || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("sessions")
    .update({ rpe, running_minutes, surface })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/insights");

  // Queue flow: jump to the next imported session still missing RPE.
  const { data: next } = await supabase
    .from("sessions")
    .select("id")
    .neq("imported_from", "manual")
    .is("rpe", null)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  redirect(next?.id ? `/session/${next.id}/edit` : "/");
}
