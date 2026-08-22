import type { TCREIPrompt } from '../core/TCREIBridge';
import { tcreiPromptToText } from '../core/TCREIBridge';

const GEMINI_ENDPOINT = (
  import.meta.env.VITE_GEMINI_API_URL as string | undefined
)?.trim();
const REQUEST_TIMEOUT_MS = 5000;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

function fallbackResponse(prompt: TCREIPrompt): string {
  const match = prompt.Task.match(/detectado: ([^.]+)/i);
  const subject = match?.[1] ?? 'situación';
  const uncertainty = /baja|no disponible/i.test(prompt.Context);
  return uncertainty
    ? `Atención: detecté ${subject}, pero la información es limitada. Avance con precaución.`
    : `Atención: detecté ${subject}. Avance con precaución.`;
}

export async function sendTCREIPrompt(tcrei: TCREIPrompt): Promise<string> {
  if (!GEMINI_ENDPOINT) return fallbackResponse(tcrei);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: tcreiPromptToText(tcrei), tcrei }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Generative AI request failed: ${response.status}`);
    const data = (await response.json()) as GeminiResponse & {
      text?: string;
      response?: string;
    };
    const text =
      data.text ??
      data.response ??
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join(' ')
        .trim();
    return text || fallbackResponse(tcrei);
  } catch {
    return fallbackResponse(tcrei);
  } finally {
    window.clearTimeout(timeout);
  }
}
