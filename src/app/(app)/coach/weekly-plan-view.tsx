"use client";
import { Dumbbell, Bike, Footprints, Volleyball, Bed, Sparkles, Check } from "lucide-react";
import type { SessionType, WeeklyPlanDoc } from "@/lib/ai/plan-schema";
import { tryParsePlan } from "@/lib/ai/plan-schema";
import { cn } from "@/lib/utils";

const ICONS: Record<SessionType, typeof Dumbbell> = {
  gym: Dumbbell,
  cycling: Bike,
  walking: Footprints,
  football: Volleyball,
  rest: Bed,
  other: Sparkles,
};

const TYPE_LABEL: Record<SessionType, string> = {
  gym: "Gym",
  cycling: "Cykel",
  walking: "Promenad",
  football: "Fotboll",
  rest: "Vila",
  other: "Annat",
};

export function WeeklyPlanView({ content }: { content: string }) {
  const doc = tryParsePlan(content);

  if (!doc) {
    // Legacy (markdown) plan — render as-is.
    return <pre className="whitespace-pre-wrap text-sm font-sans">{content}</pre>;
  }

  return <StructuredPlan doc={doc} />;
}

function StructuredPlan({ doc }: { doc: WeeklyPlanDoc }) {
  return (
    <div className="space-y-4">
      {doc.key_focus && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Fokus: </span>
          {doc.key_focus}
        </div>
      )}

      {doc.summary && (
        <p className="text-sm text-muted-foreground">{doc.summary}</p>
      )}

      <ol className="space-y-2">
        {doc.days.map((d) => {
          const t = (d.session_type as SessionType) || "other";
          const Icon = ICONS[t] ?? Sparkles;
          const isRest = t === "rest";
          return (
            <li
              key={d.date}
              className={cn(
                "rounded-xl border border-border bg-card p-3 space-y-2",
                d.completed && "opacity-70",
                isRest && "bg-muted/40",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold leading-tight">
                      {d.weekday} · {TYPE_LABEL[t]}
                      {d.completed && (
                        <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                          <Check className="h-3 w-3 mr-0.5" /> Klar
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.date}</div>
                  </div>
                </div>
                {(d.duration || d.intensity) && (
                  <div className="text-right text-xs text-muted-foreground">
                    {d.duration && <div>{d.duration}</div>}
                    {d.intensity && <div>{d.intensity}</div>}
                  </div>
                )}
              </div>

              {d.intent && <p className="text-sm">{d.intent}</p>}

              {d.focus && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Fokus: </span>
                  {d.focus}
                </p>
              )}

              {d.exercises && d.exercises.length > 0 && (
                <ul className="rounded-lg bg-muted/50 divide-y divide-border/60 text-xs mt-1">
                  {d.exercises.map((e, i) => (
                    <li key={i} className="px-2.5 py-1.5 flex items-baseline justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{e.exercise}</div>
                        {e.notes && <div className="text-muted-foreground">{e.notes}</div>}
                      </div>
                      <div className="text-right text-muted-foreground whitespace-nowrap">
                        {e.sets && e.reps ? `${e.sets}×${e.reps}` : ""}
                        {e.weight ? <span className="ml-1 text-foreground">@ {e.weight}</span> : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {d.watch_for && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Var uppmärksam på: </span>
                  {d.watch_for}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
