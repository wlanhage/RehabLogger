"use client";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { saveFollowup } from "./actions";

export function FollowupForm({ sessionId, needsRpe }: { sessionId: string; needsRpe: boolean }) {
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [rpe, setRpe] = useState(5);

  return (
    <form action={saveFollowup} className="space-y-6">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="shin_left" value={left} />
      <input type="hidden" name="shin_right" value={right} />
      {needsRpe && <input type="hidden" name="rpe" value={rpe} />}

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Tryckömhet vänster skenben nu</Label>
          <span className="text-sm font-medium">{left}/10</span>
        </div>
        <Slider value={[left]} onValueChange={([v]) => setLeft(v)} min={0} max={10} step={1} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Tryckömhet höger skenben nu</Label>
          <span className="text-sm font-medium">{right}/10</span>
        </div>
        <Slider value={[right]} onValueChange={([v]) => setRight(v)} min={0} max={10} step={1} />
      </div>

      {needsRpe && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Ansträngning (RPE)</Label>
            <span className="text-sm font-medium">{rpe}/10</span>
          </div>
          <Slider value={[rpe]} onValueChange={([v]) => setRpe(v)} min={1} max={10} step={1} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Fortsätt logga morgon-check-in de kommande dagarna — det är där recovery-lagget mäts.
      </p>

      <SubmitButton size="lg" className="w-full" pendingText="Sparar…">Spara</SubmitButton>
    </form>
  );
}
