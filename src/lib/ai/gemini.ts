// Minimal Google Gemini client. Uses the v1beta generateContent endpoint
// directly — no SDK dependency. Same surface as the previous OpenRouter
// helper so callers don't have to change.

export type ChatRole = "system" | "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };

// gemini-2.5-flash — generous free tier, JSON mode, fast, multi-language.
const DEFAULT_MODEL = "gemini-2.5-flash";

type GeminiPart = { text: string };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function buildPayload(
  messages: ChatTurn[],
  opts?: { temperature?: number; maxTokens?: number; json?: boolean },
) {
  // Gemini puts system messages in a dedicated top-level field, not the
  // conversation array. Concatenate any system turns into one block.
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return {
    ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: {
      temperature: opts?.temperature ?? 0.4,
      maxOutputTokens: opts?.maxTokens ?? 1024,
      ...(opts?.json ? { responseMimeType: "application/json" } : {}),
    },
  };
}

export async function chatComplete(
  messages: ChatTurn[],
  opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** Force JSON output via Gemini's responseMimeType. */
    json?: boolean;
  },
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = opts?.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(buildPayload(messages, opts)),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Gemini rejected the API key. Check GEMINI_API_KEY.");
    }
    if (res.status === 429) {
      throw new Error("Gemini rate-limit hit. Wait a minute and try again, or upgrade your plan.");
    }
    throw new Error(`Gemini ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const content = parts.map((p) => p.text ?? "").join("").trim();
  if (!content) throw new Error("Gemini returned an empty response");
  return content;
}
