import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DailyDecision, Recommendation } from "@/lib/load/decision";

const LIGHT_STYLE: Record<DailyDecision["light"], { dot: string; label: string; ring: string }> = {
  green: { dot: "bg-emerald-500", label: "Grönt", ring: "border-emerald-500/40" },
  yellow: { dot: "bg-yellow-500", label: "Gult", ring: "border-yellow-500/40" },
  red: { dot: "bg-red-500", label: "Rött", ring: "border-red-500/40" },
};

const REC_LABEL: Record<Recommendation, string> = {
  run_allowed: "Spring (får öka lite)",
  repeat_previous_run: "Upprepa förra passet",
  reduce_run_load: "Minska löpdosen",
  bike_instead: "Cykla istället",
  strength_only: "Bara styrka",
  rest: "Vila",
  log_checkin: "Logga check-in",
};

export function TodayDecision({
  decision,
  hasCheckin,
}: {
  decision: DailyDecision;
  hasCheckin: boolean;
}) {
  const s = LIGHT_STYLE[decision.light];

  return (
    <Card className={cn("space-y-3 border-2", s.ring)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-3.5 w-3.5 rounded-full", s.dot)} />
          <span className="font-semibold">{s.label} idag</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {REC_LABEL[decision.recommendation]}
        </span>
      </div>

      {!hasCheckin && (
        <Link
          href="/checkin"
          className="block rounded-lg bg-muted px-3 py-2 text-sm font-medium text-center"
        >
          Logga dagens check-in för en mer träffsäker rekommendation →
        </Link>
      )}

      <p className="text-sm leading-relaxed">{decision.rationale}</p>

      {decision.prescription && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Pass: </span>
          {decision.prescription}
        </div>
      )}

      {decision.tibialBudget > 0 && (
        <p className="text-xs text-muted-foreground">
          Tibial budget idag: {decision.tibialBudget} AU
        </p>
      )}
    </Card>
  );
}
