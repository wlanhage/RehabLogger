"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile } from "@/types/db";
import { saveProfile } from "./actions";
import { TRAINING_TYPES } from "@/lib/training-types";
import { cn } from "@/lib/utils";

export function ProfileForm({ initial }: { initial: Profile | null }) {
  const [sex, setSex] = useState<string>(initial?.sex ?? "");
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(initial?.training_types ?? []),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleType(slug: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("sex", sex);
    fd.delete("training_types");
    for (const t of enabled) fd.append("training_types", t);
    start(async () => {
      try {
        await saveProfile(fd);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Personal">
        <div className="space-y-2">
          <Label htmlFor="display_name">Name</Label>
          <Input id="display_name" name="display_name" defaultValue={initial?.display_name ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Sex</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" name="age" inputMode="numeric" defaultValue={initial?.age ?? ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="weight_kg">Weight (kg)</Label>
            <Input id="weight_kg" name="weight_kg" inputMode="decimal" defaultValue={initial?.weight_kg ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height_cm">Height (cm)</Label>
            <Input id="height_cm" name="height_cm" inputMode="numeric" defaultValue={initial?.height_cm ?? ""} />
          </div>
        </div>
      </Section>

      <Section title="Rehab focus & goals">
        <div className="space-y-2">
          <Label htmlFor="rehab_focus">Current rehab focus / injury</Label>
          <Textarea
            id="rehab_focus"
            name="rehab_focus"
            rows={3}
            placeholder="What body part / issue are you rehabbing? Leave blank if you're just tracking general training."
            defaultValue={initial?.rehab_focus ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="problem_started">When did it start?</Label>
          <Input
            id="problem_started"
            name="problem_started"
            placeholder="e.g. March 2026, ~6 months ago"
            defaultValue={initial?.problem_started ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseline_tenderness">Resting shin tenderness baseline (0–10)</Label>
          <Input
            id="baseline_tenderness"
            name="baseline_tenderness"
            inputMode="numeric"
            placeholder="your normal level on a good day"
            defaultValue={initial?.baseline_tenderness ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Recovery is judged as a return to this level. Leave blank to auto-detect from your check-ins.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goals">Goals</Label>
          <Textarea
            id="goals"
            name="goals"
            rows={2}
            placeholder="e.g. Return to 4×/week running, play football pain-free, half marathon in 8 months."
            defaultValue={initial?.goals ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes for the coach</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Past injuries, sleep, time constraints, gym access, etc."
            defaultValue={initial?.notes ?? ""}
          />
        </div>
      </Section>

      <Section title="Activities I do">
        <p className="text-sm text-muted-foreground">
          Tick the activities you train. Only these will show up when logging training.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TRAINING_TYPES.map(({ slug, label, icon: Icon }) => {
            const on = enabled.has(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggleType(slug)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {on && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      </Section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-muted-foreground">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <legend className="text-lg font-semibold mb-2">{title}</legend>
      {children}
    </fieldset>
  );
}
