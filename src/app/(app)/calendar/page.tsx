import { createClient } from "@/lib/supabase/server";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import Link from "next/link";
import { Dumbbell, Bike, Footprints, Volleyball } from "lucide-react";
import type { TrainingType } from "@/lib/constants";
import { cn } from "@/lib/utils";

const icons: Record<TrainingType, typeof Dumbbell> = {
  gym: Dumbbell,
  cycling: Bike,
  walking: Footprints,
  football: Volleyball,
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const cursor = sp.m ? new Date(sp.m + "-01") : new Date();
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("date,type")
    .gte("date", format(gridStart, "yyyy-MM-dd"))
    .lte("date", format(gridEnd, "yyyy-MM-dd"));

  const map = new Map<string, Set<TrainingType>>();
  (sessions ?? []).forEach((s: { date: string; type: TrainingType }) => {
    if (!map.has(s.date)) map.set(s.date, new Set());
    map.get(s.date)!.add(s.type);
  });

  const prevMonth = format(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1), "yyyy-MM");
  const nextMonth = format(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), "yyyy-MM");

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <Link href={`/calendar?m=${prevMonth}`} className="px-3 py-1 text-sm text-muted-foreground">‹</Link>
        <h1 className="text-xl font-semibold">{format(cursor, "MMMM yyyy")}</h1>
        <Link href={`/calendar?m=${nextMonth}`} className="px-3 py-1 text-sm text-muted-foreground">›</Link>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const types = map.get(key);
          const inMonth = isSameMonth(day, cursor);
          return (
            <Link
              key={key}
              href={`/calendar/${key}`}
              className={cn(
                "aspect-square rounded-lg border border-border p-1 flex flex-col text-xs",
                !inMonth && "opacity-30",
                isToday(day) && "border-foreground",
              )}
            >
              <span className="font-medium">{format(day, "d")}</span>
              <div className="flex-1 flex flex-wrap items-end gap-0.5">
                {types && Array.from(types).map((t) => {
                  const I = icons[t];
                  return <I key={t} className="h-3 w-3" />;
                })}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
