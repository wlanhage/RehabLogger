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
  opts?: {
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
    /**
     * Gemini 2.5 reasons internally before producing output. Those reasoning
     * tokens count against maxOutputTokens, so a strict format response can
     * silently get truncated. Pass 0 to disable thinking entirely, or a small
     * budget (e.g. 512) for light reasoning.
     */
    thinkingBudget?: number;
  },
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
      ...(opts?.thinkingBudget !== undefined
        ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
        : {}),
    },
  };
}

// Fallback chain when the requested model is overloaded.
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash-lite"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function callGemini(
  model: string,
  apiKey: string,
  payload: object,
): Promise<{ ok: true; content: string } | { ok: false; status: number; body: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body };
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
  }
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const content = parts.map((p) => p.text ?? "").join("").trim();
  if (!content) return { ok: false, status: 502, body: "empty response" };
  return { ok: true, content };
}

export async function chatComplete(
  messages: ChatTurn[],
  opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** Force JSON output via Gemini's responseMimeType. */
    json?: boolean;
    /** Disable (0) or cap Gemini 2.5 internal reasoning tokens. */
    thinkingBudget?: number;
  },
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const primary = opts?.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const candidates = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  const payload = buildPayload(messages, opts);

  // Retry 503/overloaded with exponential backoff before falling back to the
  // next model in the chain. 429 / auth errors are fatal — surface immediately.
  let lastErr = "";
  for (const model of candidates) {
    const delays = [800, 1600, 3200]; // ms — total ~5.6s before fallback
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const r = await callGemini(model, apiKey, payload);
      if (r.ok) return r.content;

      if (r.status === 401 || r.status === 403) {
        throw new Error("Gemini rejected the API key. Check GEMINI_API_KEY.");
      }
      if (r.status === 429) {
        throw new Error("Gemini rate-limit hit. Wait a minute and try again.");
      }

      lastErr = `${model} ${r.status}: ${r.body || ""}`;

      // 503 (UNAVAILABLE) / 500 / 504 — retry, then fall back.
      const retriable = r.status === 503 || r.status === 500 || r.status === 504;
      if (!retriable) break;
      if (attempt < delays.length) {
        console.warn(`Gemini ${model} overloaded (${r.status}), retrying in ${delays[attempt]}ms…`);
        await sleep(delays[attempt]);
      }
    }
    console.warn(`Gemini ${model} unavailable, trying fallback model…`);
  }

  throw new Error(`Gemini unavailable across all models. Last error: ${lastErr}`);
}
