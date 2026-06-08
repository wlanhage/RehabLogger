import { NextResponse } from "next/server";
import { notifyUsersWithoutTodayCheckin, verifyCron } from "@/lib/push/cron-shared";

// Vercel Cron fires at 07 UTC = 09 CEST (summer) / 08 CET (winter).
// Adjust the schedule in vercel.json if you want strict 09 local year-round.
export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await notifyUsersWithoutTodayCheckin({
      title: "Rehab Logger",
      body: "Logga hur kroppen känns idag",
      url: "/checkin",
      tag: "morning-checkin",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("morning cron failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
