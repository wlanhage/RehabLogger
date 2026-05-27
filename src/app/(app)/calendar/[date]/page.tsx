import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Session, GymSet, RehabFollowup } from "@/types/db";
import type { TrainingType } from "@/lib/constants";

const typeLabel: Record<TrainingType, string> = {
  gym: "Gym",
  cycling: "Cycling",
  walking: "Walking",
  football: "Football",
};

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("date", date)
    .order("created_at", { ascending: true });

  const ids = (sessions ?? []).map((s: Session) => s.id);
  const [{ data: sets }, { data: followups }] = await Promise.all([
    ids.length
      ? supabase.from("gym_sets").select("*").in("session_id", ids).order("position")
      : Promise.resolve({ data: [] as GymSet[] }),
    ids.length
      ? supabase.from("rehab_followups").select("*").in("session_id", ids)
      : Promise.resolve({ data: [] as RehabFollowup[] }),
  ]);

  const setsBySession = new Map<string, GymSet[]>();
  ((sets ?? []) as GymSet[]).forEach((s) => {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  });
  const followupBySession = new Map<string, RehabFollowup>();
  ((followups ?? []) as RehabFollowup[]).forEach((f) => followupBySession.set(f.session_id, f));

  return (
    <div className="space-y-5">
      <Link href="/calendar" className="inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Calendar
      </Link>
      <h1 className="text-2xl font-semibold">{format(parseISO(date), "EEEE, MMM d")}</h1>

      {(!sessions || sessions.length === 0) && (
        <p className="text-sm text-muted-foreground">No training that day.</p>
      )}

      {(sessions ?? []).map((s: Session) => {
        const f = followupBySession.get(s.id);
        const gs = setsBySession.get(s.id) ?? [];
        return (
          <Card key={s.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{typeLabel[s.type as TrainingType]}</h2>
              {s.duration_minutes && (
                <span className="text-sm text-muted-foreground">{s.duration_minutes} min</span>
              )}
            </div>

            {s.distance_km != null && (
              <p className="text-sm">{s.distance_km} km</p>
            )}

            {gs.length > 0 && (
              <div className="text-sm space-y-1">
                {gs.filter((g) => g.weight || g.sets || g.reps).map((g) => (
                  <div key={g.id} className="flex justify-between">
                    <span>{g.exercise}</span>
                    <span className="text-muted-foreground">
                      {g.sets && g.reps ? `${g.sets}×${g.reps}` : ""}
                      {g.weight ? ` @ ${g.weight}kg` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}

            {f && (
              <div className="border-t border-border pt-3 text-sm grid grid-cols-2 gap-y-1">
                <span className="text-muted-foreground">Pain</span>
                <span>{f.pain_score}/10 {f.pain_location ? `· ${f.pain_location}` : ""}</span>
                <span className="text-muted-foreground">Reaction</span>
                <span>{f.reaction}</span>
                <span className="text-muted-foreground">RPE</span>
                <span>{f.rpe}/10</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
