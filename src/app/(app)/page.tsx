import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, endOfWeek } from "date-fns";
import Link from "next/link";
import { HeartPulse, ChevronRight } from "lucide-react";
import type { Session, DailyCheckin, Profile } from "@/types/db";
import { sorenessTone } from "@/lib/checkin-ui";
import { Logo } from "@/components/logo";
import { iconFor, labelFor } from "@/lib/training-types";
import { loadIntelligence } from "@/lib/load/aggregate";
import { TodayDecision } from "@/components/today-decision";

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [{ data: weekSessions }, { data: recent }, { data: todayCheckin }, { data: profile }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("daily_checkins").select("*").eq("date", todayISO).maybeSingle(),
    supabase.from("profiles").select("training_types").maybeSingle(),
  ]);

  const intelligence = await loadIntelligence();

  // Imported sessions still missing RPE/surface/jog-split.
  const { data: needEnrich, count: enrichCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact" })
    .neq("imported_from", "manual")
    .is("rpe", null)
    .order("date", { ascending: true })
    .limit(1);
  const enrichOldestId = needEnrich?.[0]?.id ?? null;

  const enabled = ((profile as Pick<Profile, "training_types"> | null)?.training_types ?? []) as string[];

  // Counts only for enabled types so the dashboard reflects the user's setup.
  const counts: Record<string, number> = {};
  enabled.forEach((t) => (counts[t] = 0));
  (weekSessions ?? []).forEach((s: Session) => {
    if (enabled.includes(s.type)) counts[s.type] = (counts[s.type] ?? 0) + 1;
    else counts[s.type] = (counts[s.type] ?? 0) + 1; // still show types user has logged before
  });

  const latest = recent?.[0];
  const checkin = (todayCheckin as DailyCheckin | null) ?? null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <p className="text-sm text-muted-foreground leading-none">{format(today, "EEEE")}</p>
            <h1 className="text-2xl font-semibold leading-tight">{format(today, "MMMM d")}</h1>
          </div>
        </div>
      </header>

      <TodayDecision decision={intelligence.decision} hasCheckin={!!checkin} />

      {enrichCount && enrichCount > 0 && enrichOldestId && (
        <Link
          href={`/session/${enrichOldestId}/edit`}
          className="flex items-center justify-between rounded-2xl border border-yellow-500/40 bg-card px-4 py-3 text-sm hover:bg-muted"
        >
          <span>
            <span className="font-medium">{enrichCount} importerade pass</span> behöver RPE/underlag
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <Link
        href="/insights"
        className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
      >
        <span>Insikter & trender</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <Link href="/checkin">
        <Card className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              checkin ? sorenessTone(checkin.soreness ?? 0).bg : "bg-muted"
            }`}
          >
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Dagens check-in</p>
            {checkin ? (
              <p className="text-sm text-muted-foreground">
                Ömhet {Math.max(checkin.shin_tenderness_left ?? 0, checkin.shin_tenderness_right ?? 0)}/10
                <span className="ml-1 underline">ändra</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Hur känns kroppen idag?</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Card>
      </Link>

      <Card>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Latest activity</p>
        {latest ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{labelFor(latest.type)}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(latest.date), "MMM d")}</p>
            </div>
            {(() => { const I = iconFor(latest.type); return <I className="h-6 w-6" />; })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
      </Card>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">This week</h2>
        {Object.keys(counts).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activities configured. Pick some on{" "}
            <Link href="/profile" className="underline">Profile</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(counts).map((slug) => {
              const Icon = iconFor(slug);
              return (
                <Card key={slug} className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="text-2xl font-semibold leading-none">{counts[slug]}</p>
                    <p className="text-xs text-muted-foreground mt-1">{labelFor(slug)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Recent</h2>
        <div className="space-y-2">
          {(recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}
          {(recent ?? []).map((s: Session) => {
            const Icon = iconFor(s.type);
            return (
              <Link key={s.id} href={`/calendar/${s.date}`}>
                <Card className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{labelFor(s.type)}</p>
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
