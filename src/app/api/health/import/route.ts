import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Health Auto Export → webhook. Configure the "REST API" automation in the
// Health Auto Export iOS app to POST workouts here with header
//   x-import-secret: <HEALTH_IMPORT_SECRET>
// Attributed to HEALTH_OWNER_USER_ID (your Supabase auth user id).
//
// HAE's payload shape varies by version/config; this parser is deliberately
// defensive and logs what it couldn't map. Expected-ish:
//   { data: { workouts: [ { id, name, start, duration, distance, ... } ] } }

const ACTIVITY_MAP: Record<string, string> = {
  running: "running",
  run: "running",
  outdoorrun: "running",
  indoorrun: "running",
  walking: "walking",
  walk: "walking",
  cycling: "cycling",
  cycle: "cycling",
  biking: "cycling",
  soccer: "football",
  football: "football",
  traditionalstrengthtraining: "gym",
  functionalstrengthtraining: "gym",
  strength: "gym",
};

function mapActivity(name: string | undefined): string {
  if (!name) return "other";
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  return ACTIVITY_MAP[key] ?? "other";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "qty" in v) {
    const q = (v as { qty?: unknown }).qty;
    return typeof q === "number" ? q : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** HAE durations are usually seconds; convert to whole minutes. */
function toMinutes(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  // < 20 is implausible as seconds for a workout → treat as minutes already.
  return n < 20 ? Math.round(n) : Math.round(n / 60);
}

function toDateISO(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Accept "2026-06-28 09:12:00 +0200" or ISO; take the date part.
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export async function POST(req: Request) {
  const secret = process.env.HEALTH_IMPORT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Import not configured (HEALTH_IMPORT_SECRET)" }, { status: 503 });
  }
  if (req.headers.get("x-import-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseEarly = createAdminClient();

  // Owner: explicit env wins; otherwise auto-detect the single user (this is a
  // personal app). Removes the need to look up your UID by hand.
  let owner = process.env.HEALTH_OWNER_USER_ID;
  if (!owner) {
    const { data: list, error: listErr } = await supabaseEarly.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: "Could not resolve owner: " + listErr.message }, { status: 500 });
    }
    if ((list?.users?.length ?? 0) === 1) {
      owner = list.users[0].id;
    } else {
      return NextResponse.json(
        { error: "Set HEALTH_OWNER_USER_ID — more than one user exists." },
        { status: 503 },
      );
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workouts =
    (payload as { data?: { workouts?: unknown[] }; workouts?: unknown[] })?.data?.workouts ??
    (payload as { workouts?: unknown[] })?.workouts ??
    [];

  if (!Array.isArray(workouts) || workouts.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, note: "no workouts in payload" });
  }

  const supabase = supabaseEarly;
  const rows = [];
  const skipped: string[] = [];

  for (const w of workouts as Record<string, unknown>[]) {
    const date = toDateISO(w.start ?? w.startDate ?? w.date);
    const externalId = (w.id ?? w.uuid ?? `${w.name}-${w.start}`) as string;
    if (!date) {
      skipped.push(String(externalId));
      continue;
    }
    rows.push({
      user_id: owner,
      external_id: String(externalId),
      type: mapActivity(w.name as string | undefined),
      date,
      // Prefer explicit clean fields (Apple Shortcuts sends these); fall back
      // to Health Auto Export's raw seconds/qty shapes. Unit guards make the
      // Shortcut robust whether it emits minutes/seconds or km/metres.
      duration_minutes: (() => {
        const dm = num(w.duration_minutes);
        if (dm != null) return dm > 180 ? Math.round(dm / 60) : Math.round(dm); // >180 ⇒ seconds
        return toMinutes(w.duration);
      })(),
      distance_km: (() => {
        const dk = num(w.distance_km) ?? num(w.distance);
        if (dk == null) return null;
        return dk > 100 ? Math.round((dk / 1000) * 100) / 100 : dk; // >100 ⇒ metres
      })(),
      avg_hr: num(w.avg_hr ?? w.avgHeartRate ?? w.averageHeartRate),
      max_hr: num(w.max_hr ?? w.maxHeartRate),
      calories: num(w.calories ?? w.activeEnergyBurned ?? w.totalEnergyBurned),
      imported_from: (w.source as string) || "Apple Watch",
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped });
  }

  const { error } = await supabase
    .from("sessions")
    .upsert(rows, { onConflict: "user_id,external_id" });
  if (error) {
    console.error("health import upsert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: rows.length, skipped });
}
