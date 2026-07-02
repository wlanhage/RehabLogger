"use server";
import { createClient } from "@/lib/supabase/server";
import { loadIntelligence } from "@/lib/load/aggregate";
import { computeSessionLoad, rollingLoad } from "@/lib/load/load";
import { tryParsePlan } from "@/lib/ai/plan-schema";
import { GREEN_PROGRESSION } from "@/lib/load/config";
import { labelFor } from "@/lib/training-types";
import { format, parseISO, subDays, getISOWeek, startOfWeek, addDays } from "date-fns";
import type { Session, GymSet, RehabFollowup, DailyCheckin, Profile } from "@/types/db";

const worse = (a: number | null, b: number | null) =>
  a == null && b == null ? null : Math.max(a ?? 0, b ?? 0);

function paceStr(durMin: number | null, distKm: number | null, paceSec: number | null): string {
  const secPerKm = paceSec ?? (durMin && distKm ? (durMin * 60) / distKm : null);
  if (!secPerKm) return "–";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r1 = (n: number | null) => (n == null ? "–" : Math.round(n * 10) / 10);

export async function buildAiContext(): Promise<string> {
  const supabase = await createClient();
  const li = await loadIntelligence(60);

  const todayISO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
  const since = format(subDays(new Date(todayISO + "T00:00:00"), 42), "yyyy-MM-dd");

  const [{ data: profileRow }, { data: sessionsRaw }, { data: checkinsRaw }] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("sessions").select("*").gte("date", since).order("date", { ascending: true }),
    supabase.from("daily_checkins").select("*").gte("date", since).order("date", { ascending: true }),
  ]);
  const profile = (profileRow as Profile | null) ?? null;
  const sessions = (sessionsRaw ?? []) as Session[];
  const checkins = (checkinsRaw ?? []) as DailyCheckin[];

  const ids = sessions.map((s) => s.id);
  const [{ data: setsRaw }, { data: fuRaw }] = await Promise.all([
    ids.length
      ? supabase.from("gym_sets").select("*").in("session_id", ids)
      : Promise.resolve({ data: [] as GymSet[] }),
    ids.length
      ? supabase.from("rehab_followups").select("*").in("session_id", ids)
      : Promise.resolve({ data: [] as RehabFollowup[] }),
  ]);
  const gymSets = (setsRaw ?? []) as GymSet[];
  const followups = (fuRaw ?? []) as RehabFollowup[];

  const bodyKg = li.bodyKg;
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const recoveryBySession = new Map(li.recoveries.map((r) => [r.sessionId, r]));
  const fuBySession = new Map(followups.map((f) => [f.session_id, f]));
  const checkinByDate = new Map(checkins.map((c) => [c.date, c]));
  const tenderByDate = (d: string) => {
    const c = checkinByDate.get(d);
    return c ? worse(c.shin_tenderness_left, c.shin_tenderness_right) : null;
  };

  const md: string[] = [];
  md.push(`# AI Context — Rehab Logger`);
  md.push(`_Generated ${todayISO}. A compact briefing so an AI can advise as if it had followed this rehab for months._`);

  // ---- User Profile ---------------------------------------------------------
  md.push(`\n# User Profile`);
  const p: string[] = [];
  if (profile?.display_name) p.push(`Name: ${profile.display_name}`);
  if (profile?.sex) p.push(`Sex: ${profile.sex}`);
  if (profile?.age) p.push(`Age: ${profile.age}`);
  if (profile?.height_cm) p.push(`Height: ${profile.height_cm} cm`);
  if (bodyKg) p.push(`Weight: ${bodyKg} kg`);
  if (profile?.goals) p.push(`Goals: ${profile.goals}`);
  if (profile?.rehab_focus) p.push(`Current focus / injury: ${profile.rehab_focus}`);
  if (profile?.problem_started) p.push(`Problem started: ${profile.problem_started}`);
  if (profile?.baseline_tenderness != null) p.push(`Resting shin-tenderness baseline: ${profile.baseline_tenderness}/10`);
  if (profile?.training_types?.length) p.push(`Activities: ${profile.training_types.map(labelFor).join(", ")}`);
  p.push(`Symptom pattern: shin tenderness is delayed (24–96h after impact), rarely present during activity.`);
  md.push(p.join("\n") || "_No profile filled in._");

  // ---- Current Weekly Plan --------------------------------------------------
  md.push(`\n# Current Weekly Plan`);
  const monday = startOfWeek(new Date(todayISO + "T00:00:00"), { weekStartsOn: 1 });
  const weekStartISO = format(monday, "yyyy-MM-dd");
  const { data: planRow } = await supabase
    .from("weekly_plans")
    .select("content")
    .eq("week_start", weekStartISO)
    .maybeSingle();
  const plan = planRow ? tryParsePlan(planRow.content) : null;
  if (plan) {
    const lines = plan.days
      .filter((d) => d.session_type !== "rest")
      .map((d) => `- ${d.weekday}: ${labelForType(d.session_type)}${d.intent ? ` — ${d.intent}` : ""}`);
    md.push(lines.length ? lines.join("\n") : "_Rest week — no impact sessions planned._");
  } else {
    md.push("_No plan generated for this week._");
  }

  // ---- Last 4 Weeks Summary -------------------------------------------------
  md.push(`\n# Last 4 Weeks Summary`);
  const weekBlocks: string[] = [];
  const weekAvgWeight: (number | null)[] = [];
  for (let w = 3; w >= 0; w--) {
    const wStart = subDays(monday, w * 7);
    const wStartISO = format(wStart, "yyyy-MM-dd");
    const wEndISO = format(addDays(wStart, 6), "yyyy-MM-dd");
    const inWeek = (d: string) => d >= wStartISO && d <= wEndISO;

    const wSessions = sessions.filter((s) => inWeek(s.date));
    const wCheckins = checkins.filter((c) => inWeek(c.date));
    const wWeights = wCheckins.map((c) => c.body_weight_kg).filter((v): v is number => v != null);
    const wAvgWeight = avg(wWeights);
    weekAvgWeight[3 - w] = wAvgWeight;
    const prevAvg = weekAvgWeight[3 - w - 1] ?? null;
    const wChange = wAvgWeight != null && prevAvg != null ? wAvgWeight - prevAvg : null;

    // Per-type training.
    const byType = new Map<string, { count: number; dist: number; dur: number }>();
    for (const s of wSessions) {
      const e = byType.get(s.type) ?? { count: 0, dist: 0, dur: 0 };
      e.count++;
      e.dist += s.distance_km ?? 0;
      e.dur += s.duration_minutes ?? 0;
      byType.set(s.type, e);
    }

    // Load as of week end.
    const load = rollingLoad(li.dailyTibial, wEndISO);

    // Recovery in-week.
    const wRecoveries = li.recoveries.filter((r) => inWeek(r.date));
    const g = wRecoveries.filter((r) => r.status === "green").length;
    const y = wRecoveries.filter((r) => r.status === "yellow").length;
    const rd = wRecoveries.filter((r) => r.status === "red").length;
    const greenMinutes = wRecoveries
      .filter((r) => r.status === "green")
      .map((r) => sessionById.get(r.sessionId)?.running_minutes ?? sessionById.get(r.sessionId)?.duration_minutes ?? 0);
    const longestGreen = greenMinutes.length ? Math.max(...greenMinutes) : null;
    const lags = wRecoveries.map((r) => r.daysUntilReady).filter((v): v is number => v != null);

    const trainingLines = [...byType.entries()].map(([t, e]) => {
      const bits = [`sessions ${e.count}`];
      if (e.dist > 0) bits.push(`${Math.round(e.dist * 10) / 10} km`);
      if (e.dur > 0) bits.push(`${e.dur} min`);
      return `  - ${labelFor(t)}: ${bits.join(", ")}`;
    });

    weekBlocks.push(
      [
        `## Week ${getISOWeek(wStart)} (${wStartISO})`,
        `Weight: ${wAvgWeight != null ? `${r1(wAvgWeight)} kg${wChange != null ? ` (${wChange > 0 ? "+" : ""}${r1(wChange)})` : ""}` : "–"}`,
        `Training:`,
        trainingLines.length ? trainingLines.join("\n") : "  - none logged",
        `Load: acute(7d) ${Math.round(load.acute)} · chronic/wk ${Math.round(load.chronicWeekly)} · ratio ${load.ratio != null ? load.ratio.toFixed(2) : "n/a (rebuild)"}`,
        `Recovery: green ${g} · yellow ${y} · red ${rd} · longest green ${longestGreen != null ? `${longestGreen} min` : "–"} · avg lag ${avg(lags) != null ? `${r1(avg(lags))} d` : "–"}`,
      ].join("\n"),
    );
  }
  md.push(weekBlocks.join("\n\n"));

  // ---- Running Sessions (detailed) ------------------------------------------
  md.push(`\n# Running Sessions`);
  md.push(`_Detailed because impact response is the crux. Most recent first._`);
  const runs = sessions.filter((s) => s.type === "running").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (runs.length === 0) {
    md.push("_No running sessions logged yet._");
  } else {
    for (const s of runs) {
      const load = computeSessionLoad({
        type: s.type,
        duration_minutes: s.duration_minutes,
        running_minutes: s.running_minutes,
        rpe: s.rpe,
        surface: s.surface,
        body_kg: s.body_kg,
        fallbackBodyKg: bodyKg,
      });
      const rec = recoveryBySession.get(s.id);
      const fu = fuBySession.get(s.id);
      const evening = fu ? worse(fu.shin_tenderness_left, fu.shin_tenderness_right) : null;
      const t24 = tenderByDate(format(addDays(parseISO(s.date), 1), "yyyy-MM-dd"));
      const t48 = tenderByDate(format(addDays(parseISO(s.date), 2), "yyyy-MM-dd"));
      const t72 = tenderByDate(format(addDays(parseISO(s.date), 3), "yyyy-MM-dd"));
      md.push(
        [
          `## ${s.date}`,
          `Duration ${s.duration_minutes ?? "–"} min${s.running_minutes ? ` (${s.running_minutes} min jogging)` : ""} · Distance ${s.distance_km ?? "–"} km · Pace ${paceStr(s.duration_minutes, s.distance_km, s.pace_seconds_per_km)}`,
          `RPE ${s.rpe ?? "–"}/10 · Avg HR ${s.avg_hr ?? "–"} · Surface ${s.surface ?? "–"}${s.shoes ? ` · Shoes ${s.shoes}` : ""}`,
          `Load: mechanical(sRPE) ${load.systemic} AU · tibial ${load.tibial} AU`,
          `Tenderness — evening ${evening ?? "–"} · 24h ${t24 ?? "–"} · 48h ${t48 ?? "–"} · 72h ${t72 ?? "–"} (worse side)`,
          `Recovery: ${rec ? `${rec.daysUntilReady != null ? `ready after ${rec.daysUntilReady} d` : "not recovered"} — **${rec.status.toUpperCase()}**` : "pending"}`,
        ].join("\n"),
      );
    }
  }

  // ---- Recovery Trends ------------------------------------------------------
  md.push(`\n# Recovery Trends`);
  const allLags = li.recoveries.map((r) => r.daysUntilReady).filter((v): v is number => v != null);
  const allTender = checkins
    .map((c) => worse(c.shin_tenderness_left, c.shin_tenderness_right))
    .filter((v): v is number => v != null);
  const trend = lagTrendWord(allLags);
  md.push(
    [
      `- Average tenderness: ${avg(allTender) != null ? `${r1(avg(allTender))}/10` : "–"}`,
      `- Average recovery lag: ${avg(allLags) != null ? `${r1(avg(allLags))} days` : "–"}`,
      `- Longest symptom duration: ${allLags.length ? `${Math.max(...allLags)} days` : "–"}`,
      `- Shortest symptom duration: ${allLags.length ? `${Math.min(...allLags)} days` : "–"}`,
      `- Trend: ${trend}`,
    ].join("\n"),
  );

  // ---- Weight Trend ---------------------------------------------------------
  md.push(`\n# Weight Trend`);
  const weights = checkins.map((c) => c.body_weight_kg).filter((v): v is number => v != null);
  const monthChange = weights.length >= 2 ? weights[weights.length - 1] - weights[0] : null;
  md.push(
    [
      `- Current: ${bodyKg != null ? `${bodyKg} kg` : "–"}`,
      `- ~Weekly average: ${avg(weights.slice(-7)) != null ? `${r1(avg(weights.slice(-7)))} kg` : "–"}`,
      `- Change over window: ${monthChange != null ? `${monthChange > 0 ? "+" : ""}${r1(monthChange)} kg` : "–"}`,
    ].join("\n"),
  );

  // ---- Gym Summary ----------------------------------------------------------
  md.push(`\n# Gym Summary`);
  const gymSessions = sessions.filter((s) => s.type === "gym");
  const setsBySession = new Map<string, GymSet[]>();
  for (const g of gymSets) {
    const arr = setsBySession.get(g.session_id) ?? [];
    arr.push(g);
    setsBySession.set(g.session_id, arr);
  }
  const lowerBody = ["Back Squat", "Bulgarian Split Squat", "Romanian Deadlift", "Leg Press", "Hip Thrust", "Walking Lunge", "Leg Extension", "Leg Curl", "Standing Calf Raise", "Seated Calf Raise"];
  let volume = 0;
  for (const g of gymSets) {
    if (lowerBody.includes(g.exercise) && g.weight && g.sets && g.reps) volume += g.sets * g.reps * g.weight;
  }
  const progression = (name: string) => {
    const entries = gymSets
      .filter((g) => g.exercise === name && g.weight != null)
      .map((g) => ({ date: sessionById.get(g.session_id)?.date ?? "", weight: g.weight as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length === 0) return "no data";
    if (entries.length === 1) return `${entries[0].weight} kg`;
    return `${entries[0].weight} → ${entries[entries.length - 1].weight} kg`;
  };
  const weeksSpan = 6;
  md.push(
    [
      `- Training frequency: ${(gymSessions.length / weeksSpan).toFixed(1)} sessions/week (${gymSessions.length} in window)`,
      `- Lower-body volume (window): ${Math.round(volume)} kg total (sets×reps×weight)`,
      `- Back Squat: ${progression("Back Squat")}`,
      `- Romanian Deadlift: ${progression("Romanian Deadlift")}`,
      `- Standing Calf Raise: ${progression("Standing Calf Raise")}`,
    ].join("\n"),
  );

  // ---- Cycling Summary ------------------------------------------------------
  md.push(`\n# Cycling Summary`);
  const cyc = sessions.filter((s) => s.type === "cycling");
  const cycHr = cyc.map((s) => s.avg_hr).filter((v): v is number => v != null);
  md.push(
    [
      `- Sessions: ${cyc.length}`,
      `- Average duration: ${avg(cyc.map((s) => s.duration_minutes ?? 0)) != null ? `${Math.round(avg(cyc.map((s) => s.duration_minutes ?? 0)) as number)} min` : "–"}`,
      `- Average HR: ${avg(cycHr) != null ? `${Math.round(avg(cycHr) as number)} bpm` : "–"}`,
      `- Zone 2 time: n/a (no HR-zone data captured)`,
    ].join("\n"),
  );

  // ---- AI Observations ------------------------------------------------------
  md.push(`\n# AI Observations`);
  const obs = [...li.digest, ...li.triggers.findings];
  md.push(obs.length ? obs.map((o) => `- ${o.replace(/^⚠️ ?/, "")}`).join("\n") : "- Not enough data yet.");

  // ---- Current Status -------------------------------------------------------
  md.push(`\n# Current Status`);
  const light = { green: "Green", yellow: "Yellow", red: "Red" }[li.decision.light];
  const confidence = li.recoveries.length >= 6 ? "High" : li.recoveries.length >= 2 ? "Medium" : "Low";
  md.push(`- Traffic light: **${light}**\n- Confidence: ${confidence} (based on ${li.recoveries.length} logged recovery responses)`);

  // ---- Current Recommendations ----------------------------------------------
  md.push(`\n# Current Recommendations`);
  md.push(
    [
      `- Recommended running frequency: ${li.runsThisWeek >= 2 ? "hold at 2/week" : "up to 2/week (rebuild)"}`,
      `- Recommended next run: ${li.decision.prescription ?? recLabel(li.decision.recommendation)}`,
      `- Maximum suggested increase: ${li.decision.light === "green" && li.decision.recommendation === "run_allowed" ? `${Math.round(GREEN_PROGRESSION * 100)}%` : "0% (hold or reduce)"}`,
      `- Cycling: 60–75 min Zone 2 (non-impact, does not load the shins)`,
      `- Strength: 1–2 lower-body sessions/week`,
      `- Warnings: ${li.triggers.findings.length && li.decision.light !== "green" ? li.triggers.findings.join(" ") : "none"}`,
    ].join("\n"),
  );

  // ---- Questions for AI -----------------------------------------------------
  md.push(`\n# Questions for AI`);
  md.push(
    [
      `Based on the month of training above:`,
      ``,
      `- Should I increase running frequency or running duration?`,
      `- Do you see any warning signs?`,
      `- Should I modify my weekly structure?`,
      `- Is my recovery lag improving?`,
      `- Is my gym training interfering with my running?`,
      `- What should my next two weeks look like?`,
    ].join("\n"),
  );

  return md.join("\n");
}

function labelForType(t: string): string {
  const map: Record<string, string> = {
    gym: "Gym / strength",
    running: "Run",
    cycling: "Cycling",
    walking: "Walk",
    football: "Football",
    rest: "Rest",
    other: "Other",
  };
  return map[t] ?? labelFor(t);
}

function recLabel(rec: string): string {
  const map: Record<string, string> = {
    run_allowed: "Run allowed, small increase OK",
    repeat_previous_run: "Repeat previous session, no increase",
    reduce_run_load: "Reduce load vs last run",
    bike_instead: "Cycle instead — no impact",
    strength_only: "Strength only",
    rest: "Rest",
    log_checkin: "Log today's check-in first",
  };
  return map[rec] ?? rec;
}

function lagTrendWord(lags: number[]): string {
  if (lags.length < 3) return "not enough data";
  const last = lags.slice(-3);
  const prev = lags.slice(-6, -3);
  const a = last.reduce((s, v) => s + v, 0) / last.length;
  const b = prev.length ? prev.reduce((s, v) => s + v, 0) / prev.length : a;
  if (a < b - 0.3) return "Improving (recovery lag shortening)";
  if (a > b + 0.3) return "Declining (recovery lag lengthening)";
  return "Stable";
}
