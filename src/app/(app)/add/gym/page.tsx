import { createGymSession } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GymFlow } from "./gym-flow";
import type { GymSet } from "@/types/db";

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const sp = await searchParams;
  let sessionId = sp.s;

  if (!sessionId) {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    // Re-use today's gym session if it exists and isn't yet "finished"
    // (i.e. no rehab_followup row yet). RLS already scopes to the current user.
    const { data: candidates } = await supabase
      .from("sessions")
      .select("id, rehab_followups(session_id)")
      .eq("type", "gym")
      .eq("date", today)
      .order("created_at", { ascending: false })
      .limit(5);

    const open = (candidates ?? []).find(
      (s: { id: string; rehab_followups: unknown[] }) =>
        !s.rehab_followups || s.rehab_followups.length === 0,
    );

    if (open) {
      redirect(`/add/gym?s=${open.id}`);
    }

    const res = await createGymSession();
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
