import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const user_agent = req.headers.get("user-agent") ?? null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, user_agent },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("push subscribe failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
