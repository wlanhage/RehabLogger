import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";
import { computeSessionLoad, rollingLoad } from "./load";
import {
  deriveAllRecoveries,
  type CheckinPoint,
  type ImpactSessionPoint,
  type RecoveryResponse,
} from "./recovery";
import { decideToday, type DailyDecision } from "./decision";
import { IMPACT_ACTIVITIES } from "./config";
import { startOfWeek, format as fmt } from "date-fns";
import type { DailyCheckin, Session, Profile } from "@/types/db";

export type LoadIntelligence = {
  decision: DailyDecision;
  todayCheckin: DailyCheckin | null;
  recoveries: RecoveryResponse[];
  /** Per-day tibial load for trend charts. */
  dailyTibial: { date: string; tibial: number }[];
  acwr: { acute: number; chronicWeekly: number; ratio: number | null };
  /** Tibial load change this week vs last week, percent (null if no base). */
  loadChangePct: number | null;
  /** Impact sessions logged in the current ISO week. */
  runsThisWeek: number;
  /** Worse-side tenderness per day for trend charts. */
  tendernessSeries: { date: string; left: number | null; right: number | null }[];
  /** Body weight per day for trend charts. */
  weightSeries: { date: string; kg: number }[];
  bodyKg: number | null;
};

function worse(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return Math.max(a ?? 0, b ?? 0);
}

export async function loadIntelligence(days = 60): Promise<LoadIntelligence> {
  const supabase = await createClient();
  const todayISO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
  const since = format(subDays(new Date(todayISO + "T00:00:00"), days), "yyyy-MM-dd");

  const [{ data: checkins }, { data: sessions }, { data: profile }] = await Promise.all([
    supabase.from("daily_checkins").select("*").gte("date", since).order("date", { ascending: true }),
    supabase.from("sessions").select("*").gte("date", since).order("date", { ascending: true }),
    supabase.from("profiles").select("weight_kg").maybeSingle(),
  ]);

  const checkinRows = (checkins ?? []) as DailyCheckin[];
  const sessionRows = (sessions ?? []) as Session[];
  const profileWeight = (profile as Pick<Profile, "weight_kg"> | null)?.weight_kg ?? null;

  // Latest known body weight: newest check-in weight, else profile.
  const latestWeighed = [...checkinRows].reverse().find((c) => c.body_weight_kg != null);
  const bodyKg = latestWeighed?.body_weight_kg ?? profileWeight;

  // Check-in points (worse side governs).
  const checkinPoints: CheckinPoint[] = checkinRows.map((c) => ({
    date: c.date,
    tendernessWorse: worse(c.shin_tenderness_left, c.shin_tenderness_right),
    safeToRun: c.safe_to_run,
  }));

  // Per-session load + per-day tibial aggregation.
  const dailyTibialMap = new Map<string, number>();
  const impactSessions: ImpactSessionPoint[] = [];
  for (const s of sessionRows) {
    const load = computeSessionLoad({
      type: s.type,
      duration_minutes: s.duration_minutes,
      running_minutes: s.running_minutes,
      rpe: s.rpe,
      surface: s.surface,
      body_kg: s.body_kg,
      fallbackBodyKg: bodyKg,
    });
    dailyTibialMap.set(s.date, (dailyTibialMap.get(s.date) ?? 0) + load.tibial);
    if ((IMPACT_ACTIVITIES as readonly string[]).includes(s.type)) {
      impactSessions.push({ sessionId: s.id, date: s.date, type: s.type, tibial: load.tibial });
    }
  }
  const dailyTibial = [...dailyTibialMap.entries()]
    .map(([date, tibial]) => ({ date, tibial: Math.round(tibial * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recoveries = deriveAllRecoveries(impactSessions, checkinPoints);

  // Last impact session + whether it has resolved.
  const lastImpact = impactSessions[impactSessions.length - 1] ?? null;
  const lastRecovery = recoveries[0] ?? null;
  const lastImpactResolved = lastRecovery ? lastRecovery.status !== "ongoing" : true;

  const todayCheckin = checkinRows.find((c) => c.date === todayISO) ?? null;
  const todayPoint = checkinPoints.find((c) => c.date === todayISO) ?? null;

  // Impact sessions in the current ISO week (Mon start) up to today.
  const weekStartISO = fmt(startOfWeek(new Date(todayISO + "T00:00:00"), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const runsThisWeek = impactSessions.filter((s) => s.date >= weekStartISO && s.date <= todayISO).length;

  const decision = decideToday({
    todayISO,
    today: todayPoint,
    recoveries,
    lastImpactDate: lastImpact?.date ?? null,
    lastImpactResolved,
    bodyKg,
    runsThisWeek,
  });

  const acwr = rollingLoad(dailyTibial, todayISO);

  // Tibial load this week vs the previous week.
  const prevWeekStartISO = fmt(subDays(new Date(weekStartISO + "T00:00:00"), 7), "yyyy-MM-dd");
  let thisWeekLoad = 0;
  let prevWeekLoad = 0;
  for (const d of dailyTibial) {
    if (d.date >= weekStartISO && d.date <= todayISO) thisWeekLoad += d.tibial;
    else if (d.date >= prevWeekStartISO && d.date < weekStartISO) prevWeekLoad += d.tibial;
  }
  const loadChangePct =
    prevWeekLoad > 0 ? Math.round(((thisWeekLoad - prevWeekLoad) / prevWeekLoad) * 100) : null;

  const weightSeries = checkinRows
    .filter((c) => c.body_weight_kg != null)
    .map((c) => ({ date: c.date, kg: c.body_weight_kg as number }));

  const tendernessSeries = checkinRows.map((c) => ({
    date: c.date,
    left: c.shin_tenderness_left,
    right: c.shin_tenderness_right,
  }));

  return {
    decision,
    todayCheckin,
    recoveries,
    dailyTibial,
    acwr,
    loadChangePct,
    runsThisWeek,
    tendernessSeries,
    weightSeries,
    bodyKg,
  };
}

/** Compact text block for the AI coach prompt. */
export function formatLoadForPrompt(li: LoadIntelligence): string {
  const d = li.decision;
  const lines: string[] = [];
  lines.push(
    `TODAY'S DECISION: ${d.light.toUpperCase()} — ${d.recommendation}${
      d.tibialBudget > 0 ? `, tibial budget ${d.tibialBudget} AU` : ""
    }`,
  );
  lines.push(`Engine rationale: ${d.rationale}`);
  lines.push(
    `Impact sessions this week: ${li.runsThisWeek}.` +
      (li.loadChangePct != null
        ? ` Tibial load this week vs last: ${li.loadChangePct > 0 ? "+" : ""}${li.loadChangePct}%.`
        : ""),
  );
  if (li.acwr.ratio != null) {
    lines.push(
      `Tibial load — acute(7d) ${Math.round(li.acwr.acute)} AU, chronic weekly ${Math.round(li.acwr.chronicWeekly)} AU, ratio ${li.acwr.ratio.toFixed(2)}.`,
    );
  } else {
    lines.push("Tibial load — chronic base too low for a meaningful acute:chronic ratio (rebuild phase).");
  }

  if (li.recoveries.length) {
    lines.push("RECOVERY RESPONSES per impact session (newest first):");
    for (const r of li.recoveries.slice(0, 6)) {
      lines.push(
        `- ${r.date} ${r.type}: tibial ${r.tibial} AU → peak tenderness ${r.peakTenderness ?? "?"}/10, ` +
          `${r.daysUntilReady != null ? `${r.daysUntilReady} days until ready` : "not yet recovered"} (${r.status}).`,
      );
    }
  } else {
    lines.push("RECOVERY RESPONSES: none yet — no impact sessions logged.");
  }

  return lines.join("\n");
}
