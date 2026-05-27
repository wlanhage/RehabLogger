"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteSession(sessionId: string, date: string) {
  const supabase = await createClient();
  // RLS scopes to the current user; cascades remove gym_sets + rehab_followups.
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${date}`);
}
