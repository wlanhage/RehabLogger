import { createGymSession } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GymFlow } from "./gym-flow";
import type { GymSet } from "@/types/db";

function safeDate(raw?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
}

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; date?: string }>;
}) {
  const sp = await searchParams;
  let sessionId = sp.s;
  const date = safeDate(sp.date);

  if (!sessionId) {
    const supabase = await createClient();

    // Re-use an unfinished gym session for this date (no rehab_followup yet).
    const { data: candidates } = await supabase
      .from("sessions")
      .select("id, rehab_followups(session_id)")
      .eq("type", "gym")
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(5);

    const open = (candidates ?? []).find(
      (s: { id: string; rehab_followups: unknown[] }) =>
        !s.rehab_followups || s.rehab_followups.length === 0,
    );

    if (open) {
      redirect(`/add/gym?s=${open.id}`);
    }

    const res = await createGymSession(date);
    redirect(`/add/gym?s=${res.sessionId}`);
  }

  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("gym_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });

  return <GymFlow sessionId={sessionId!} initialSets={(sets ?? []) as GymSet[]} />;
}
