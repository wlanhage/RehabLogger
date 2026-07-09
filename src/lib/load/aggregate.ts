import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";
import { computeSessionLoad, rollingLoad } from "./load";
import {
  deriveAllRecoveries,
  computeBaseline,
  type CheckinPoint,
  type ImpactSessionPoint,
  type RecoveryResponse,
} from "./recovery";
import { decideToday, type DailyDecision } from "./decision";
import { buildDigest, analyzeTriggers, classifyToday, type TriggerAnalysis, type TodayContext } from "./insights";
import { computeLoadResponses, type LoadResponseAnalysis } from "./response";
import { buildCoachView, type CoachView } from "./coach-view";
import { IMPACT_ACTIVITIES } from "./config";
import { startOfWeek, format as fmt, addDays } from "date-fns";
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
  /** Personal resting-tenderness baseline used by the recovery model. */
  baseline: number;
  /** Plain-language status report (decision support, not planning). */
  digest: string[];
  /** What likely triggered each flare + patterns. */
  triggers: TriggerAnalysis;
  /** Is today's reading normal for this user? */
  todayContext: TodayContext | null;
  /** Load Response: symptoms normalised against impact exposure. */
  loadResponse: LoadResponseAnalysis;
  /** Everything the coach-style Home needs. */
  coach: CoachView;
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
    supabase.from("profiles").select("weight_kg, baseline_tenderness").maybeSingle(),
  ]);

  const checkinRows = (checkins ?? []) as DailyCheckin[];
  const sessionRows = (sessions ?? []) as Session[];
  const profileRow = profile as Pick<Profile, "weight_kg" | "baseline_tenderness"> | null;
  const profileWeight = profileRow?.weight_kg ?? null;

  // Same-evening shin tenderness captured in the post-session follow-up seeds
  // the recovery model. Pull it and key by the session's date.
  const sessionDateById = new Map(sessionRows.map((s) => [s.id, s.date]));
  const { data: followups } = sessionRows.length
    ? await supabase
        .from("rehab_followups")
        .select("session_id, shin_tenderness_left, shin_tenderness_right")
        .in("session_id", sessionRows.map((s) => s.id))
    : { data: [] as { session_id: string; shin_tenderness_left: number | null; shin_tenderness_right: number | null }[] };

  // Latest known body weight: newest check-in weight, else profile.
  const latestWeighed = [...checkinRows].reverse().find((c) => c.body_weight_kg != null);
  const bodyKg = latestWeighed?.body_weight_kg ?? profileWeight;

  // Merge morning check-ins + same-evening follow-up tenderness per date
  // (worse side, worse reading governs).
  const byDate = new Map<string, { tender: number[]; safe: "yes" | "unsure" | "no" | null }>();
  for (const c of checkinRows) {
    const w = worse(c.shin_tenderness_left, c.shin_tenderness_right);
    const e = byDate.get(c.date) ?? { tender: [], safe: null };
    if (w != null) e.tender.push(w);
    e.safe = c.safe_to_run;
    byDate.set(c.date, e);
  }
  for (const f of followups ?? []) {
    const date = sessionDateById.get(f.session_id);
    if (!date) continue;
    const w = worse(f.shin_tenderness_left, f.shin_tenderness_right);
    if (w == null) continue;
    const e = byDate.get(date) ?? { tender: [], safe: null };
    e.tender.push(w);
    byDate.set(date, e);
  }
  const checkinPoints: CheckinPoint[] = [...byDate.entries()]
    .map(([date, e]) => ({
      date,
      tendernessWorse: e.tender.length ? Math.max(...e.tender) : null,
      safeToRun: e.safe,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

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

  // Personal resting baseline: explicit profile value, else a low percentile
  // of the user's own morning tenderness.
  const personalBaseline = profileRow?.baseline_tenderness ?? computeBaseline(checkinPoints);
  const recoveries = deriveAllRecoveries(impactSessions, checkinPoints, personalBaseline);

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
    sleepQuality: todayCheckin?.sleep_quality ?? null,
    fatigue: todayCheckin?.general_fatigue ?? null,
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

  // Decision-support analysis.
  const loadResponse = computeLoadResponses(recoveries, checkinPoints);
  const digest = buildDigest({
    tenderness: tendernessSeries,
    recoveries,
    loadChangePct,
    runsThisWeek,
    baseline: personalBaseline,
    latestResponse: loadResponse.latest,
  });
  const triggers = analyzeTriggers(recoveries, sessionRows);
  const recentWorse = tendernessSeries
    .slice(-14)
    .map((d) => (d.left == null && d.right == null ? null : Math.max(d.left ?? 0, d.right ?? 0)))
    .filter((v): v is number => v != null);
  const todayContext = classifyToday(todayPoint?.tendernessWorse ?? null, personalBaseline, recentWorse);

  // ---- Coach view (Home) ----------------------------------------------------
  const sessionById = new Map(sessionRows.map((s) => [s.id, s]));
  const greenRunSessions = recoveries
    .filter((r) => r.type === "running" && r.status === "green")
    .map((r) => {
      const s = sessionById.get(r.sessionId);
      return { date: r.date, minutes: s?.running_minutes ?? s?.duration_minutes ?? 0, tibial: r.tibial };
    })
    .filter((g) => g.minutes > 0);
  const bestGreenTibial = greenRunSessions.length ? Math.max(...greenRunSessions.map((g) => g.tibial)) : null;

  const monday = startOfWeek(new Date(todayISO + "T00:00:00"), { weekStartsOn: 1 });
  const weekEndsISO = [3, 2, 1, 0].map((w) =>
    fmt(addDays(subDays(monday, w * 7), 6), "yyyy-MM-dd"),
  );

  const coach = buildCoachView({
    todayISO,
    decision,
    recoveries,
    greenRunSessions,
    bestGreenTibial,
    lastImpactDate: lastImpact?.date ?? null,
    todayTenderness: todayPoint?.tendernessWorse ?? null,
    hasCheckinToday: !!todayCheckin,
    abnormalResponse: loadResponse.abnormal,
    acwrRatio: acwr.ratio,
    weekEndsISO,
  });

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
    baseline: personalBaseline,
    digest,
    triggers,
    todayContext,
    loadResponse,
    coach,
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

  if (li.loadResponse.entries.length) {
    lines.push("LOAD RESPONSE (symptoms normalised vs previous same-type impact dose — NEVER judge symptoms in isolation):");
    for (const e of li.loadResponse.entries.slice(0, 5)) {
      lines.push(
        `- ${e.date} ${e.type}: tibial ${e.tibial} AU${e.loadDeltaPct != null ? ` (${e.loadDeltaPct > 0 ? "+" : ""}${e.loadDeltaPct}%)` : ""}, ` +
          `peak tenderness ${e.peakTenderness ?? "?"}, lag ${e.lag ?? "?"} d → LRI: ${e.lri.toUpperCase()}`,
      );
    }
    if (li.loadResponse.latest) {
      lines.push(`LATEST INTERPRETATION: ${li.loadResponse.latest.interpretation}`);
    }
  }
  if (li.triggers.findings.length) {
    lines.push("FLARE PATTERNS (attribution): " + li.triggers.findings.join(" "));
  }
  if (li.todayContext) {
    lines.push("TODAY IN CONTEXT: " + li.todayContext.text);
  }

  return lines.join("\n");
}
