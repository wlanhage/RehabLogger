import { createClient } from "@/lib/supabase/server";
import { ChatWindow } from "./chat-window";
import type { ChatMessage } from "@/types/db";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(50);

  return <ChatWindow initial={(data ?? []) as ChatMessage[]} />;
}
