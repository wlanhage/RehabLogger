"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function safeDate(raw: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
}

export async function saveCheckin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const date = safeDate(formData.get("date") ? String(formData.get("date")) : null);
  const soreness = Number(formData.get("soreness") ?? 0);
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      date,
      soreness,
      location,
      notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${date}`);
  revalidatePath("/checkin");
  redirect("/");
}
