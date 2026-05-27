"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/db";
import { sendChatMessage, clearChat } from "./actions";

type Local = Pick<ChatMessage, "role" | "content"> & { id?: string; pending?: boolean };

export function ChatWindow({ initial }: { initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<Local[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    setText("");
    setMessages((m) => [
      ...m,
      { role: "user", content: t },
      { role: "assistant", content: "…", pending: true },
    ]);
    start(async () => {
      try {
        const res = await sendChatMessage(t);
        setMessages((m) => {
          const copy = m.slice();
          // Replace the trailing pending assistant placeholder.
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].pending) {
              copy[i] = { role: "assistant", content: res.reply };
              break;
            }
          }
          return copy;
        });
      } catch (e) {
        setMessages((m) => m.filter((x) => !x.pending));
        setError(e instanceof Error ? e.message : "Failed to send");
      }
    });
  }

  async function onClear() {
    if (!confirm("Clear all chat history?")) return;
    await clearChat();
    setMessages([]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 min-h-[40vh] max-h-[55vh] overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask anything — pain after a session, whether to push or back off, exercise swaps, etc. The coach reads your profile and recent sessions.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap max-w-[88%]",
              m.role === "user"
                ? "ml-auto bg-foreground text-background"
                : "mr-auto bg-muted",
              m.pending && "opacity-60",
            )}
          >
            {m.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask the coach…"
          rows={2}
        />
        <div className="flex gap-2">
          <Button onClick={send} disabled={pending || !text.trim()} className="flex-1" size="lg">
            {pending ? "Thinking…" : "Send"}
          </Button>
          {messages.length > 0 && (
            <Button variant="outline" onClick={onClear} size="lg">
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
