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
import { Logo } from "@/components/logo";
import { TRAINING_TYPES } from "@/lib/training-types";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { completeOnboarding, type OnboardingData } from "./actions";

type Data = {
  display_name: string;
  sex: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  rehab_focus: string;
  problem_started: string;
  baseline_tenderness: number | null;
  goals: string;
  notes: string;
  training_types: string[];
};

export function OnboardingWizard({ initial }: { initial: Data }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const steps = [
    { title: "About you", render: () => <StepProfile data={data} setData={setData} /> },
    { title: "What are you rehabbing?", render: () => <StepRehab data={data} setData={setData} /> },
    { title: "What do you train?", render: () => <StepActivities data={data} setData={setData} /> },
  ];
  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  function finish() {
    setError(null);
    start(async () => {
      try {
        await completeOnboarding(data as OnboardingData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2">
        <Logo size={64} priority />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {total}
        </p>
      </div>

      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= step ? "bg-foreground" : "bg-muted",
            )}
          />
        ))}
      </div>

      <h1 className="text-2xl font-semibold">{current.title}</h1>

      <div className="space-y-4">{current.render()}</div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStep((s) => s - 1)}
            disabled={pending}
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>
        )}
        {!isLast ? (
          <Button className="flex-1" size="lg" onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button className="flex-1" size="lg" onClick={finish} disabled={pending}>
            {pending ? "Saving…" : "Finish"}
          </Button>
        )}
      </div>
    </div>
  );
}

function num(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function StepProfile({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Just the basics. Used to personalise plans and chat with the AI coach.
      </p>
      <div className="space-y-2">
        <Label htmlFor="display_name">Name</Label>
        <Input
          id="display_name"
          value={data.display_name}
          onChange={(e) => setData({ ...data, display_name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Sex</Label>
          <Select value={data.sex} onValueChange={(v) => setData({ ...data, sex: v })}>
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
          <Input
            id="age"
            inputMode="numeric"
            value={data.age ?? ""}
            onChange={(e) => setData({ ...data, age: num(e.target.value) })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input
            id="weight"
            inputMode="decimal"
            value={data.weight_kg ?? ""}
            onChange={(e) => setData({ ...data, weight_kg: num(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Height (cm)</Label>
          <Input
            id="height"
            inputMode="numeric"
            value={data.height_cm ?? ""}
            onChange={(e) => setData({ ...data, height_cm: num(e.target.value) })}
          />
        </div>
      </div>
    </>
  );
}

function StepRehab({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        If you&apos;re rehabbing an injury or working around an issue, tell the coach about it. Leave blank if you&apos;re just tracking general training.
      </p>
      <div className="space-y-2">
        <Label htmlFor="rehab_focus">Current focus / injury</Label>
        <Textarea
          id="rehab_focus"
          rows={3}
          placeholder="e.g. Shin splints both legs, worse on the left. Or: Achilles tendinopathy. Or: returning from a knee surgery."
          value={data.rehab_focus}
          onChange={(e) => setData({ ...data, rehab_focus: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="problem_started">When did it start?</Label>
        <Input
          id="problem_started"
          placeholder="e.g. March 2026, ~6 months ago"
          value={data.problem_started}
          onChange={(e) => setData({ ...data, problem_started: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="baseline_tenderness">Resting shin tenderness (0–10)</Label>
        <Input
          id="baseline_tenderness"
          inputMode="numeric"
          placeholder="your normal level on a good day — usually 0"
          value={data.baseline_tenderness ?? ""}
          onChange={(e) => setData({ ...data, baseline_tenderness: num(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goals">Goals</Label>
        <Textarea
          id="goals"
          rows={2}
          placeholder="e.g. Return to 4×/week running, play football pain-free, half marathon in 8 months."
          value={data.goals}
          onChange={(e) => setData({ ...data, goals: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Anything else?</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Past injuries, sleep, time constraints, gym access, etc."
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
        />
      </div>
    </>
  );
}

function StepActivities({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const enabled = new Set(data.training_types);
  function toggle(slug: string) {
    const next = new Set(enabled);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setData({ ...data, training_types: Array.from(next) });
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Tick the activities you train. Only these will show up when logging training. You can change this any time on your Profile.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TRAINING_TYPES.map(({ slug, label, icon: Icon }) => {
          const on = enabled.has(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm transition-colors text-left",
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
      {data.training_types.length === 0 && (
        <p className="text-xs text-muted-foreground">Pick at least one to continue.</p>
      )}
    </>
  );
}
