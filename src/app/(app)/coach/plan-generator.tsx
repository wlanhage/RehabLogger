"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateWeeklyPlan } from "./actions";

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
        <pre className="whitespace-pre-wrap text-sm font-sans">{content}</pre>
      ) : (
        <p className="text-sm text-muted-foreground">
          No plan yet for this week. Generate one from your recent training and rehab data.
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button onClick={run} disabled={pending} className="w-full" size="lg">
        {pending ? "Generating…" : content ? "Regenerate plan" : "Generate weekly plan"}
      </Button>
    </div>
  );
}
