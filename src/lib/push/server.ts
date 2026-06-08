import webpush, { type PushSubscription } from "web-push";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@rehab-logger.local";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type Notification = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Returns { sent, expired } where `expired` are endpoints that should be removed. */
export async function sendPush(
  subscriptions: StoredSubscription[],
  notification: Notification,
): Promise<{ sent: number; expired: string[] }> {
  configure();
  const payload = JSON.stringify(notification);
  const expired: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      const target: PushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(target, payload);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Gone / not found — subscription is dead.
          expired.push(sub.endpoint);
        } else {
          console.error("web-push send failed:", err);
        }
      }
    }),
  );

  return { sent, expired };
}
