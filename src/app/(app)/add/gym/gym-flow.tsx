"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SET_FORMATS } from "@/lib/constants";
import { saveGymSet, skipGymSet, finishSession } from "./actions";
import type { GymSet } from "@/types/db";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

type Draft = {
  id: string;
  exercise: string;
  set_format: string;
  customSets: string;
  customReps: string;
  weight: string;
  notes: string;
  skipped: boolean;
};

function toDraft(s: GymSet): Draft {
  return {
    id: s.id,
    exercise: s.exercise,
    set_format: s.set_format ?? "3x10",
    customSets: s.sets?.toString() ?? "",
    customReps: s.reps?.toString() ?? "",
    weight: s.weight?.toString() ?? "",
    notes: s.notes ?? "",
    skipped: s.skipped ?? false,
  };
}

function parseFormat(fmt: string, customSets: string, customReps: string) {
  if (fmt === "custom") {
    return { sets: customSets ? Number(customSets) : null, reps: customReps ? Number(customReps) : null };
  }
  const [s, r] = fmt.split("x").map((n) => Number(n));
  return { sets: s, reps: r };
}

export function GymFlow({ sessionId, initialSets }: { sessionId: string; initialSets: GymSet[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(initialSets.map(toDraft));
  const [index, setIndex] = useState(0);
  const total = drafts.length;
  const current = drafts[index];
  const dirtyRef = useRef<Record<string, boolean>>({});
  const saveTimer = useRef<number | null>(null);

  function update(patch: Partial<Draft>) {
    setDrafts((arr) =>
      arr.map((d, i) =>
        i === index ? { ...d, ...patch, skipped: false } : d,
      ),
    );
    dirtyRef.current[current.id] = true;
  }

  async function persist(draft: Draft) {
    const { sets, reps } = parseFormat(draft.set_format, draft.customSets, draft.customReps);
    await saveGymSet({
      id: draft.id,
      set_format: draft.set_format,
      sets,
      reps,
      weight: draft.weight ? Number(draft.weight) : null,
      notes: draft.notes || null,
    });
    dirtyRef.current[draft.id] = false;
  }

  // Debounced autosave on changes
  useEffect(() => {
    if (!dirtyRef.current[current.id]) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist(current);
    }, 600);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Flush dirty draft on tab hide / pagehide (iOS backgrounding) and on unmount.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current[current.id]) {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        void persist(current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  async function goTo(i: number) {
    if (dirtyRef.current[current.id]) await persist(current);
    setIndex(Math.max(0, Math.min(total - 1, i)));
  }

  async function skip() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await skipGymSet(current.id);
    dirtyRef.current[current.id] = false;
    setDrafts((arr) =>
      arr.map((d, i) =>
        i === index
          ? {
              ...d,
              skipped: true,
              customSets: "",
              customReps: "",
              weight: "",
              notes: "",
            }
          : d,
      ),
    );
    if (index < total - 1) setIndex(index + 1);
  }

  async function finish() {
    if (dirtyRef.current[current.id]) await persist(current);
    await finishSession(sessionId);
    router.push(`/follow-up/${sessionId}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Övning {index + 1}/{total}
        </span>
        <div className="flex-1 mx-3 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">{current.exercise}</h1>
        {current.skipped && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Hoppad
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Set × reps</Label>
          <Select value={current.set_format} onValueChange={(v) => update({ set_format: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SET_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current.set_format === "custom" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Input
                inputMode="numeric"
                placeholder="Sets"
                value={current.customSets}
                onChange={(e) => update({ customSets: e.target.value })}
              />
              <Input
                inputMode="numeric"
                placeholder="Reps"
                value={current.customReps}
                onChange={(e) => update({ customReps: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Vikt (kg)</Label>
          <Input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={current.weight}
            onChange={(e) => update({ weight: e.target.value.replace(",", ".") })}
            className="text-2xl h-14"
          />
        </div>

        <div className="space-y-2">
          <Label>Kommentar</Label>
          <Textarea
            value={current.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Previous exercise"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {index < total - 1 ? (
            <Button className="flex-1" size="lg" onClick={() => goTo(index + 1)}>
              Nästa
              <ChevronRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button className="flex-1" size="lg" onClick={finish}>
              Avsluta passet
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={skip}
        >
          <SkipForward className="h-4 w-4" />
          Hoppa över övningen
        </Button>
      </div>
    </div>
  );
}
