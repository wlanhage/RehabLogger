"use client";
import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "unsupported"; reason: string }
  | { kind: "needs-install" }
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" };

function b64UrlToUint8Array(b64Url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64Url.length % 4)) % 4);
  const b64 = (b64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

function isStandalone(): boolean {
  // iOS Safari uses navigator.standalone; everyone else has media-query.
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function PushNotifications() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState({ kind: "unsupported", reason: "Din webbläsare stödjer inte push-notiser." });
      return;
    }
    // iOS Safari requires the app to be added to the Home Screen first.
    if (/iP(hone|ad|od)/.test(navigator.userAgent) && !isStandalone()) {
      setState({ kind: "needs-install" });
      return;
    }
    if (Notification.permission === "denied") {
      setState({ kind: "denied" });
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    setState({ kind: sub ? "on" : "off" });
  }

  async function enable() {
    setError(null);
    if (!vapidKey) {
      setError("VAPID-nyckel saknas — serverkonfigurationsfel.");
      return;
    }
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setState({ kind: "denied" });
          return;
        }
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw.js")) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64UrlToUint8Array(vapidKey),
        });
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Prenumeration misslyckades");
        }
        setState({ kind: "on" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunde inte slå på notiser");
      }
    });
  }

  async function disable() {
    setError(null);
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setState({ kind: "off" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunde inte stänga av");
      }
    });
  }

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">Kontrollerar notis-status…</p>;
  }

  if (state.kind === "unsupported") {
    return <p className="text-sm text-muted-foreground">{state.reason}</p>;
  }

  if (state.kind === "needs-install") {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Smartphone className="h-4 w-4" />
          Lägg till på hemskärmen först
        </div>
        <p className="text-muted-foreground">
          iOS tillåter bara push-notiser för installerade webbappar. I Safari, tryck{" "}
          <strong>Dela → Lägg till på hemskärmen</strong>, öppna appen från ikonen och kom tillbaka hit.
        </p>
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notiser är blockerade för den här sidan. Tillåt dem i webbläsarinställningarna och ladda om.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {state.kind === "on" ? (
            <>
              <Bell className="h-4 w-4" />
              <span className="font-medium">Notiser är på</span>
            </>
          ) : (
            <>
              <BellOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Notiser är av</span>
            </>
          )}
        </div>
        {state.kind === "on" ? (
          <Button size="sm" variant="outline" onClick={disable} disabled={pending}>
            Stäng av
          </Button>
        ) : (
          <Button size="sm" onClick={enable} disabled={pending}>
            Slå på
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Dagliga påminnelser 09:00 och 21:00 om du inte loggat din check-in.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
