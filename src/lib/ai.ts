import Anthropic from "@anthropic-ai/sdk";

/**
 * Course tutor using the Claude API with YOUR OWN API key (Settings → AI tutor).
 * The key is stored only in this browser's local database and sent only to api.anthropic.com.
 */
import { TUTOR_MODEL } from "./constants";
export { TUTOR_MODEL };

export interface TutorTurn { role: "user" | "assistant"; content: string }

const SYSTEM = `You are a study tutor inside a personal trading-education app. The student studies the ICT (Inner Circle Trader) 2016–17 Mentorship core content and a trading-psychology course.
Answer using the lesson notes supplied in the student's message, plus the conversation so far. Be concrete: quote ICT's definitions, rules and example price levels when they're relevant.
End every answer with a line starting "Rewatch:" naming the lesson(s) by title.
If the notes don't cover something, say so plainly rather than inventing ICT doctrine.
This is education, not financial advice: never tell the student to place a specific live trade.
Keep answers under about 250 words, in plain text with short paragraphs or simple "-" bullets.`;

export async function askTutor(
  apiKey: string,
  turns: TutorTurn[],
  onText: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream(
    {
      model: TUTOR_MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
    },
    { signal },
  );
  let text = "";
  stream.on("text", (delta) => { text += delta; onText(text); });
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") return text || "The tutor declined to answer this question. Try rephrasing it.";
  if (!text) text = final.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return text;
}

export function tutorErrorMessage(err: unknown): string {
  if (err instanceof CoachRefusal) return err.message;
  if (err instanceof SyntaxError) return "The coach returned something unreadable. Try again.";
  if (err instanceof Anthropic.AuthenticationError) return "Your API key was rejected. Check it in Settings.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the API. Wait a moment and try again.";
  if (err instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the Claude API. Check your internet connection.";
  if (err instanceof Anthropic.APIError) return `The API returned an error (${err.status ?? "unknown"}). Try again.`;
  return "Something went wrong. Try again.";
}

// Coaching: trade review (with screenshots) and weekly coach ---------------------------------

type Effort = "low" | "medium" | "high";

/** One streamed request with the shared settings (model, fallbacks). Returns the final message. */
async function streamClaude(
  apiKey: string,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  opts: { effort: Effort; format?: { type: "json_schema"; schema: Record<string, unknown> }; onText?: (fullText: string) => void; signal?: AbortSignal },
) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream(
    {
      model: TUTOR_MODEL,
      max_tokens: 16000,
      system,
      output_config: { effort: opts.effort, ...(opts.format ? { format: opts.format } : {}) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    },
    { signal: opts.signal },
  );
  let text = "";
  stream.on("text", (delta) => { text += delta; opts.onText?.(text); });
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new CoachRefusal();
  return { final, text: text || final.content.map((b) => (b.type === "text" ? b.text : "")).join("") };
}
export class CoachRefusal extends Error { constructor() { super("The coach declined to answer this request."); } }

/**
 * Screenshots go to the API as base64. Large screen captures are scaled down so the
 * long edge is at most 1568px (the size Claude reads images at) to keep requests small.
 */
export async function imageBlock(blob: Blob): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const jpeg = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read the screenshot"))), "image/jpeg", 0.88));
  const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(jpeg); });
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

const REVIEW_SYSTEM = `You are a strict but encouraging trading coach inside a personal journal app. The trader studies the ICT (Inner Circle Trader) 2016–17 Mentorship and a trading-psychology course, and trades on demo while learning.
You review ONE logged trade: its fields, the trader's notes, their pre-trade checklist, and any chart screenshots ("before" = at entry, "after" = outcome).
Judge the PROCESS, not the result: a losing trade taken by the rules is a good trade; a winning trade that broke the rules is a bad one.
Structure the answer with these short headings:
Verdict — one line: grade A–F for process, and why.
What you did well — 1–3 bullets.
What to fix — 1–3 bullets, each tied to a specific checklist item, rule, or ICT concept (bias, draw on liquidity, premium/discount, PD array, killzone, displacement, risk).
On the chart — what the screenshots show (only if screenshots were provided; say plainly when something can't be read from them).
Next time — one concrete habit.
Study — name 1–2 lessons from the list given, by exact title.
Only use ICT ideas you are confident about; if the notes don't say something, don't invent it. This is education, not financial advice: never suggest a specific live trade. Plain text, under about 350 words.`;

export interface TradeReviewInput { summary: string; images: { kind: string; blob: Blob }[]; lessonTitles: string[] }

export async function reviewTrade(apiKey: string, input: TradeReviewInput, onText: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const im of input.images.slice(0, 4)) {
    content.push({ type: "text", text: `Screenshot (${im.kind}):` });
    content.push(await imageBlock(im.blob));
  }
  content.push({ type: "text", text: `${input.summary}\n\nLessons available to recommend:\n${input.lessonTitles.join("\n")}` });
  const { text } = await streamClaude(apiKey, REVIEW_SYSTEM, content, { effort: "medium", onText, signal });
  return text;
}

const COACH_SYSTEM = `You are a trading coach writing a student's weekly review for them to edit. The student is learning the ICT (Inner Circle Trader) 2016–17 Mentorship on a demo account.
You get the week's trades, daily check-ins (sleep, mood, focus, stress, fear on 1–5 scales), daily bias calls, rule adherence and replay practice drills.
Write in the first person, as the student ("I…"), plainly and specifically: cite dates, markets, setups and R results from the data. Do not invent anything that isn't in the data; if a section has no data, say so in one short sentence.
Focus on process (rules, patience, checklist, risk) over P&L. The next-week focus must be ONE concrete, checkable behaviour.`;

const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["best", "worst", "mistakes", "lessons", "nextFocus"],
  properties: {
    best: { type: "string", description: "Best trade or decision of the week and why it was good process." },
    worst: { type: "string", description: "Worst trade or decision of the week and what went wrong." },
    mistakes: { type: "string", description: "Repeated mistakes and patterns (emotions, sleep, time of day, rule breaks), with numbers." },
    lessons: { type: "string", description: "What the week taught; link to ICT concepts or psychology lessons where relevant." },
    nextFocus: { type: "string", description: "One concrete, checkable behaviour for next week, one sentence." },
  },
} as const;

export interface WeeklyDraft { best: string; worst: string; mistakes: string; lessons: string; nextFocus: string }

export async function draftWeeklyReview(apiKey: string, weekData: string, signal?: AbortSignal): Promise<WeeklyDraft> {
  const { final, text } = await streamClaude(apiKey, COACH_SYSTEM, [{ type: "text", text: weekData }], {
    effort: "medium", format: { type: "json_schema", schema: COACH_SCHEMA as unknown as Record<string, unknown> }, signal,
  });
  if (final.stop_reason === "max_tokens") throw new Error("The draft was cut off. Try again.");
  return JSON.parse(text) as WeeklyDraft;
}
