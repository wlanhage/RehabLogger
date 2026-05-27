"use server";
import { createClient } from "@/lib/supabase/server";
import { chatComplete, type ChatTurn } from "@/lib/ai/openrouter";
import {
  COACH_SYSTEM_PROMPT,
  formatContextForPrompt,
  loadCoachContext,
} from "@/lib/ai/context";
import type { ChatMessage } from "@/types/db";
import { revalidatePath } from "next/cache";

const HISTORY_LIMIT = 20;

export async function sendChatMessage(userText: string) {
  const text = userText.trim();
  if (!text) throw new Error("Empty message");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Persist user message first.
  const { error: insertErr } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: text });
  if (insertErr) throw insertErr;

  // Build context and recent history.
  const ctx = await loadCoachContext(14);
  const contextBlock = formatContextForPrompt(ctx);

  const { data: history } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const ordered = ((history ?? []) as ChatMessage[]).slice().reverse();

  const system = `${COACH_SYSTEM_PROMPT}

---
CURRENT USER CONTEXT
${contextBlock}
---

The conversation that follows is the user's chat with you. Keep replies short and actionable — usually 3–8 sentences or a tight bullet list.`;

  const messages: ChatTurn[] = [
    { role: "system", content: system },
    ...ordered.map((m) => ({ role: m.role, content: m.content }) satisfies ChatTurn),
  ];

  const reply = await chatComplete(messages, { temperature: 0.5 });

  const { error: aiErr } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "assistant", content: reply });
  if (aiErr) throw aiErr;

  revalidatePath("/coach/chat");
  return { reply };
}

export async function clearChat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/coach/chat");
}
