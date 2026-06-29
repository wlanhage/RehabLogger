"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSession } from "./actions";

export function DeleteSessionButton({ sessionId, date }: { sessionId: string; date: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("Radera passet? Det går inte att ångra.")) return;
    start(async () => {
      await deleteSession(sessionId, date);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-red-500 inline-flex items-center gap-1 disabled:opacity-50"
      aria-label="Radera pass"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Raderar…" : "Radera"}
    </button>
  );
}
