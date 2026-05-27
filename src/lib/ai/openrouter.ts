// Minimal OpenRouter client. We hit the OpenAI-compatible
// /chat/completions endpoint with plain fetch — no extra deps.

export type ChatRole = "system" | "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export async function chatComplete(
  messages: ChatTurn[],
  opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** Force JSON output (OpenAI-compatible response_format). */
    json?: boolean;
  },
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const model = opts?.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  // Cap output so OpenRouter doesn't reserve the model's full context as
  // worst-case cost (otherwise you'll hit 402 on free / low-balance accounts).
  const max_tokens = opts?.maxTokens ?? 1024;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(process.env.OPENROUTER_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_REFERER } : {}),
      ...(process.env.OPENROUTER_APP_TITLE ? { "X-Title": process.env.OPENROUTER_APP_TITLE } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.4,
      max_tokens,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenRouter returned an empty response");
  return content;
}
