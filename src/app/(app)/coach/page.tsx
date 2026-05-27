import { createClient } from "@/lib/supabase/server";
import { format, startOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";
import { PlanGenerator } from "./plan-generator";
import type { WeeklyPlan } from "@/types/db";

export default async function CoachPlanPage() {
  const supabase = await createClient();
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: plans } = await supabase
    .from("weekly_plans")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(6);

  const current = (plans ?? []).find((p: WeeklyPlan) => p.week_start === thisWeekStart) ?? null;
  const history = (plans ?? []).filter((p: WeeklyPlan) => p.week_start !== thisWeekStart);

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Week of {format(new Date(thisWeekStart), "MMM d")}</h2>
          {current && (
            <span className="text-xs text-muted-foreground">
              generated {format(new Date(current.created_at), "MMM d, HH:mm")}
            </span>
          )}
        </div>
        <PlanGenerator initialContent={current?.content ?? null} />
      </Card>

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Previous weeks</h3>
          {history.map((p: WeeklyPlan) => (
            <details key={p.id} className="rounded-lg border border-border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Week of {format(new Date(p.week_start), "MMM d, yyyy")}
              </summary>
              <pre className="whitespace-pre-wrap text-sm mt-2 font-sans">{p.content}</pre>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
