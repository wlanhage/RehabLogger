import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { format, parseISO, isToday, isFuture } from "date-fns";
import Link from "next/link";
import { ChevronLeft, Plus, HeartPulse } from "lucide-react";
import type { Session, GymSet, RehabFollowup, DailyCheckin } from "@/types/db";
import { DeleteSessionButton } from "./session-actions";
import { sorenessTone } from "@/lib/checkin-ui";
import { cn } from "@/lib/utils";
import { labelFor, flowFor } from "@/lib/training-types";


export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const dateObj = parseISO(date);
  const supabase = await createClient();

  const [{ data: sessions }, { data: checkin }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("date", date)
      .order("created_at", { ascending: true }),
    supabase.from("daily_checkins").select("*").eq("date", date).maybeSingle(),
  ]);

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

  const canAdd = !isFuture(dateObj);

  return (
    <div className="space-y-5">
      <Link href="/calendar" className="inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Calendar
      </Link>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {format(dateObj, "EEEE, MMM d")}
          {isToday(dateObj) && <span className="text-sm font-normal text-muted-foreground"> · today</span>}
        </h1>
      </div>

      {canAdd && (
        <>
          {(() => {
            const c = (checkin as DailyCheckin | null) ?? null;
            return (
              <Link href={`/checkin?date=${date}`}>
                <Card className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center",
                      c ? sorenessTone(c.soreness ?? 0).bg : "bg-muted",
                    )}
                  >
                    <HeartPulse className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-sm">
                    {c ? (
                      <>
                        <p className="font-medium">Daily check-in</p>
                        <p className="text-muted-foreground">
                          Soreness {c.soreness}/10
                          {c.location ? ` · ${c.location}` : ""}
                          <span className="ml-1 underline">edit</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">No check-in for this day</p>
                        <p className="text-muted-foreground">Add one</p>
                      </>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })()}

          <Link
            href={`/add?date=${date}`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-3 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            Log training for this day
          </Link>
        </>
      )}

      {(!sessions || sessions.length === 0) && (
        <p className="text-sm text-muted-foreground">No training that day.</p>
      )}

      {(sessions ?? []).map((s: Session) => {
        const f = followupBySession.get(s.id);
        const gs = setsBySession.get(s.id) ?? [];
        const isGymOpen = flowFor(s.type) === "gym" && !f;
        return (
          <Card key={s.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{labelFor(s.type)}</h2>
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
                <span>{f.pain_score}/10</span>
                <span className="text-muted-foreground">RPE</span>
                <span>{f.rpe}/10</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3 -mb-1">
              {isGymOpen ? (
                <Link
                  href={`/add/gym?s=${s.id}`}
                  className="text-xs text-foreground underline"
                >
                  Continue gym session
                </Link>
              ) : !f ? (
                <Link
                  href={`/follow-up/${s.id}`}
                  className="text-xs text-foreground underline"
                >
                  Add follow-up
                </Link>
              ) : (
                <span />
              )}
              <DeleteSessionButton sessionId={s.id} date={date} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
