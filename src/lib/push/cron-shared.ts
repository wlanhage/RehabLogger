import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, type StoredSubscription, type Notification } from "./server";

export function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Local date in Europe/Stockholm as YYYY-MM-DD. */
export function stockholmDateISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

/**
 * Send a notification to every user who has at least one push subscription
 * AND has no daily check-in for today (Europe/Stockholm date).
 */
export async function notifyUsersWithoutTodayCheckin(notification: Notification) {
  const supabase = createAdminClient();
  const today = stockholmDateISO();

  // All users with a check-in today.
  const { data: doneRows, error: e1 } = await supabase
    .from("daily_checkins")
    .select("user_id")
    .eq("date", today);
  if (e1) throw e1;
  const done = new Set((doneRows ?? []).map((r) => r.user_id));

  // All subscriptions whose owners haven't logged today.
  const { data: subs, error: e2 } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  if (e2) throw e2;

  const targets: StoredSubscription[] = (subs ?? [])
    .filter((s) => !done.has(s.user_id))
    .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));

  if (targets.length === 0) return { sent: 0, skipped: subs?.length ?? 0, expired: [] as string[] };

  const { sent, expired } = await sendPush(targets, notification);

  // Clean up dead subscriptions.
  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return { sent, skipped: (subs?.length ?? 0) - targets.length, expired };
}
