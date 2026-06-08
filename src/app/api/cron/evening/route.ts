import { NextResponse } from "next/server";
import { notifyUsersWithoutTodayCheckin, verifyCron } from "@/lib/push/cron-shared";

// Vercel Cron fires at 19 UTC = 21 CEST (summer) / 20 CET (winter).
export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await notifyUsersWithoutTodayCheckin({
      title: "Rehab Logger",
      body: "Sista påminnelsen — hur har kroppen känts idag?",
      url: "/checkin",
      tag: "evening-checkin",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("evening cron failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
