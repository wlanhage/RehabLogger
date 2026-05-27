"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateWeeklyPlan } from "./actions";
import { WeeklyPlanView } from "./weekly-plan-view";

export function PlanGenerator({ initialContent }: { initialContent: string | null }) {
  const [content, setContent] = useState<string | null>(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      try {
        const res = await generateWeeklyPlan();
        setContent(res.content);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate plan");
      }
    });
  }

  return (
    <div className="space-y-3">
      {content ? (
        <WeeklyPlanView content={content} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Ingen plan för denna vecka än. Generera en baserat på senaste träningen och rehab-datan.
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button onClick={run} disabled={pending} className="w-full" size="lg">
        {pending ? "Genererar…" : content ? "Generera om" : "Generera veckoplan"}
      </Button>
    </div>
  );
}
