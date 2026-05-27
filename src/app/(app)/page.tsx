import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, endOfWeek } from "date-fns";
import Link from "next/link";
import { Dumbbell, Bike, Footprints, Volleyball } from "lucide-react";
import { signOut } from "@/app/login/actions";
import type { Session } from "@/types/db";
import type { TrainingType } from "@/lib/constants";

const typeMeta: Record<TrainingType, { label: string; Icon: typeof Dumbbell }> = {
  gym: { label: "Gym", Icon: Dumbbell },
  cycling: { label: "Cycling", Icon: Bike },
  walking: { label: "Walking", Icon: Footprints },
  football: { label: "Football", Icon: Volleyball },
};

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data: weekSessions } = await supabase
    .from("sessions")
    .select("*")
    .gte("date", format(weekStart, "yyyy-MM-dd"))
    .lte("date", format(weekEnd, "yyyy-MM-dd"))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: recent } = await supabase
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const counts: Record<TrainingType, number> = { gym: 0, cycling: 0, walking: 0, football: 0 };
  (weekSessions ?? []).forEach((s: Session) => {
    counts[s.type] = (counts[s.type] ?? 0) + 1;
  });

  const latest = recent?.[0];

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{format(today, "EEEE")}</p>
          <h1 className="text-2xl font-semibold">{format(today, "MMMM d")}</h1>
        </div>
        <form action={signOut}>
          <button className="text-xs text-muted-foreground">Sign out</button>
        </form>
      </header>

      <Card>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Latest activity</p>
        {latest ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{typeMeta[latest.type as TrainingType].label}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(latest.date), "MMM d")}</p>
            </div>
            {(() => { const I = typeMeta[latest.type as TrainingType].Icon; return <I className="h-6 w-6" />; })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
      </Card>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">This week</h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(typeMeta) as TrainingType[]).map((t) => {
            const { label, Icon } = typeMeta[t];
            return (
              <Card key={t} className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-2xl font-semibold leading-none">{counts[t]}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Recent</h2>
        <div className="space-y-2">
          {(recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}
          {(recent ?? []).map((s: Session) => {
            const { label, Icon } = typeMeta[s.type as TrainingType];
            return (
              <Link key={s.id} href={`/calendar/${s.date}`}>
                <Card className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(s.date), "EEE, MMM d")}</p>
                    </div>
                  </div>
                  {s.duration_minutes && (
                    <span className="text-sm text-muted-foreground">{s.duration_minutes} min</span>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
