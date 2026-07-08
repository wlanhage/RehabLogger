import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import Link from "next/link";
import { ChevronRight, Check, AlertTriangle, TrendingUp, TrendingDown, Minus, HeartPulse } from "lucide-react";
import { Logo } from "@/components/logo";
import { LineChart } from "@/components/charts";
import { loadIntelligence } from "@/lib/load/aggregate";
import { FIRST_RUN_TEMPLATE } from "@/lib/load/config";
import type { CoachStatus, Trend } from "@/lib/load/coach-view";
import { cn } from "@/lib/utils";

const STATUS_ACCENT: Record<CoachStatus, { dot: string; ring: string }> = {
  ready: { dot: "bg-emerald-500", ring: "border-emerald-500/30" },
  in_progress: { dot: "bg-amber-500", ring: "border-amber-500/30" },
  delayed: { dot: "bg-rose-500", ring: "border-rose-500/30" },
};

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const { data: todayCheckin } = await supabase
    .from("daily_checkins")
    .select("id")
    .eq("date", todayISO)
    .maybeSingle();

  const { coach } = await loadIntelligence();
  const accent = STATUS_ACCENT[coach.status];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-1">
        <Logo size={34} />
        <div>
          <p className="text-xs text-muted-foreground leading-none capitalize">
            {format(today, "EEEE d MMMM", { locale: sv })}
          </p>
          <h1 className="text-xl font-semibold leading-tight">Min kropp idag</h1>
        </div>
      </header>

      {/* Check-in nudge — only when today's reading is missing */}
      {!todayCheckin && (
        <Link
          href="/checkin"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3"
        >
          <HeartPulse className="h-5 w-5" />
          <span className="flex-1 text-sm font-medium">Logga hur kroppen känns idag</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* 1. CURRENT CAPACITY — the hero */}
      <Link href="/insights" className="block">
        <Card className={cn("border-2 space-y-3", accent.ring)}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Så mycket löpning tål kroppen nu</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon trend={coach.capacityTrend} />
              {coach.capacityTrendWord}
            </span>
          </div>
          {coach.capacityMinutes != null ? (
            <>
              <div className="text-5xl font-semibold tracking-tight">{coach.capacityLabel}</div>
              <p className="text-xs text-muted-foreground">
                Längsta löppass du klarat utan bakslag i skenbenen.
              </p>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Förslag på nästa pass: </span>
                <span className="font-medium">{coach.progressionLabel}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-semibold tracking-tight">Inte uppmätt än</div>
              <p className="text-xs text-muted-foreground">
                Mäts från ditt första löppass som kroppen tål utan bakslag. Börja så här:
              </p>
              <ol className="rounded-lg bg-muted px-3 py-2.5 text-sm space-y-1.5">
                {FIRST_RUN_TEMPLATE.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
                <li className="text-xs text-muted-foreground pt-1">{FIRST_RUN_TEMPLATE.summary}</li>
              </ol>
            </>
          )}
          <p className="text-right text-xs text-muted-foreground">Säkerhet {coach.confidence}%</p>
        </Card>
      </Link>

      {/* 2. TODAY'S RECOMMENDATION */}
      <Link href="/insights" className="block">
        <Card className="space-y-3">
          <span className="text-sm text-muted-foreground">Dagens pass</span>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{coach.recommendation.emoji}</span>
            <span className="text-2xl font-semibold">{coach.recommendation.label}</span>
            <span className="ml-auto text-sm text-muted-foreground">{coach.recommendation.confidence}%</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{coach.recommendation.why}</p>
        </Card>
      </Link>

      {/* 3. RECOVERY STATUS */}
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", accent.dot)} />
          <span className="font-medium">{coach.statusLabel}</span>
          <span className="ml-auto text-sm text-muted-foreground">{coach.statusConfidence}%</span>
        </div>
        <div className="grid grid-cols-2 text-sm text-muted-foreground">
          <span>
            Redo <span className="text-foreground">{coach.expectedReadyLabel}</span>
          </span>
          <span className="text-right">Trend: {coach.statusTrendWord}</span>
        </div>
      </Card>

      {/* 4. NEXT IMPACT SESSION */}
      <Card className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Nästa löppass</span>
          <span className="font-medium">{coach.nextImpact.whenLabel}</span>
        </div>
        <p className="text-sm">{coach.nextImpact.suggestion}</p>
        <p className="text-xs text-muted-foreground">
          Uppskattad chans att lyckas: {coach.nextImpact.successProbability}%
        </p>
      </Card>

      {/* 5. CAPACITY TREND */}
      <Card className="space-y-3">
        <span className="text-sm text-muted-foreground">Kapacitet över tid</span>
        {coach.capacitySeries.some((s) => s.minutes != null) ? (
          <LineChart
            labels={coach.capacitySeries.map((s) => s.week)}
            series={[{ label: "min", color: "#10b981", values: coach.capacitySeries.map((s) => s.minutes) }]}
            unit=" min"
            height={80}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Byggs upp när du loggat några löppass.</p>
        )}
      </Card>

      {/* 6. DECISION REASONING */}
      <Card className="space-y-2">
        <span className="text-sm text-muted-foreground">Beslutet bygger på</span>
        <ul className="space-y-1.5">
          {coach.reasoning.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {r.ok ? (
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              )}
              <span className={cn(!r.ok && "text-muted-foreground")}>{r.text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
