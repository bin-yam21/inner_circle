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

const DRILL_SYSTEM = `You are a trading coach reviewing one chart-replay practice drill by a student of the ICT (Inner Circle Trader) 2016–17 Mentorship.
You get the candles as text (index 0 = the candle where the student made their call; negative = history they could see; positive = what happened next), their bias call, the order they planned (if any) and their notes.
Judge the READ, not the luck. Using only the candles given, identify what was visible at index 0: recent swing highs/lows and obvious liquidity (equal highs/lows), the dealing range and whether price was in premium or discount, displacement and any fair value gaps or order blocks. Quote prices and candle indexes.
Then say whether the bias was justified by that context, whether the entry/stop/target were placed at sensible PD arrays and liquidity, and what the student should have looked for. If the data is too ambiguous to judge, say so.
Use short headings: Context at the call · The bias · The order · What to look for next time. Plain text, under about 300 words. Education only, not financial advice.`;

const BIAS_SYSTEM = `You are a trading coach reviewing one day of a student's ICT (Inner Circle Trader) daily-bias practice.
You get the bias they called before the session and why, the levels they were waiting for, what price actually did (direction, the day's high and low and when they formed), whether price reached their level, and their notes.
Assess the REASONING: was it based on the draw on liquidity, premium/discount, higher-timeframe PD arrays and time of day? Was the call wrong because the reasoning was weak, or reasonable but the market did something else? Use the timing of the high and low (e.g. a London-session low on a bullish day is the classic pattern) where it helps.
Use short headings: Verdict · What the reasoning got right · What it missed · One question to ask tomorrow. Plain text, under about 220 words. Only use ICT ideas you are confident about. Education only, not financial advice.`;

export async function reviewDrill(apiKey: string, drillText: string, onText: (t: string) => void, signal?: AbortSignal): Promise<string> {
  return (await streamClaude(apiKey, DRILL_SYSTEM, [{ type: "text", text: drillText }], { effort: "medium", onText, signal })).text;
}
export async function reviewBias(apiKey: string, dayText: string, onText: (t: string) => void, signal?: AbortSignal): Promise<string> {
  return (await streamClaude(apiKey, BIAS_SYSTEM, [{ type: "text", text: dayText }], { effort: "medium", onText, signal })).text;
}

// Pre-trade check -----------------------------------------------------------------------------

const PRECHECK_SYSTEM = `You check a trader's plan BEFORE they enter, against their OWN written criteria. The trader studies the ICT (Inner Circle Trader) mentorship and trades on a demo account while learning.
You get: the execution model they intend to use (its rules and checklist), the items they ticked themselves, their active personal rules, context computed by their journal app (New York time, whether the model's time window is open, their daily bias call, their tilt/risk status, the reward:risk of the plan), their notes, and chart screenshots.
Your job is ONLY to judge whether this plan meets their criteria. Do not predict the market, do not say whether price will go up or down, and do not tell them to take or avoid the trade: say whether the plan follows their rules.
For every checklist item give a status:
- "pass": the plan, context or screenshot supports it.
- "fail": the context or screenshot contradicts it, even if the trader ticked it (be strict: e.g. entry above 50% of the visible range on a long is not in discount; outside the time window is a fail).
- "unclear": it can't be verified from what you were given (say what would show it).
Add any rule breaks or concerns not covered by the checklist (stop placement, room to target, trading against their own bias, tilt status). decision is "meets_plan" only if no item fails and nothing important is unclear; "partly" if minor items fail or are unclear; "does_not_meet" if a core rule fails. Grade the process A–F. Keep notes short and concrete, quoting prices when you can read them.`;

const PRECHECK_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["decision", "grade", "checks", "concerns", "summary"],
  properties: {
    decision: { type: "string", enum: ["meets_plan", "partly", "does_not_meet"] },
    grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    checks: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "status", "note"], properties: {
      item: { type: "string" }, status: { type: "string", enum: ["pass", "fail", "unclear"] }, note: { type: "string" },
    } } },
    concerns: { type: "array", items: { type: "string" } },
    summary: { type: "string", description: "Two or three sentences on whether the plan follows the trader's own rules." },
  },
} as const;

export type PreCheckVerdict = import("./types").PreCheckVerdict;

export async function preTradeCheck(apiKey: string, planText: string, shots: Blob[], signal?: AbortSignal): Promise<PreCheckVerdict> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, b] of shots.slice(0, 2).entries()) { content.push({ type: "text", text: `Chart screenshot ${i + 1}:` }); content.push(await imageBlock(b)); }
  content.push({ type: "text", text: planText });
  const { final, text } = await streamClaude(apiKey, PRECHECK_SYSTEM, content, {
    effort: "medium", format: { type: "json_schema", schema: PRECHECK_SCHEMA as unknown as Record<string, unknown> }, signal,
  });
  if (final.stop_reason === "max_tokens") throw new Error("The check was cut off. Try again.");
  return JSON.parse(text) as PreCheckVerdict;
}
