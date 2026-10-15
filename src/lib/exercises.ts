/**
 * "Spot it" chart exercises built on the structure detector. Pure functions:
 * makeExercise() picks a chart moment with something to find; grade() checks an answer.
 * Tested in tests/exercises.test.ts.
 */
import { analyze, zoneOf, type Analysis, type Zone } from "./detect";
import { decimalsFor } from "./replay";
import type { Candle } from "./types";

export type ExerciseKind = "fvg-bull" | "fvg-bear" | "bsl" | "ssl" | "pd" | "ob-bull" | "ob-bear" | "sweep";

export const EXERCISES: Record<ExerciseKind, { title: string; prompt: string; concept: string; lesson: string; explain: string }> = {
  "fvg-bull": { title: "Bullish FVG", prompt: "Click inside an unfilled bullish fair value gap.", concept: "fvg", lesson: "ict-33",
    explain: "A bullish FVG is a three-candle imbalance: the first candle's high is below the third candle's low. Price often returns to it before continuing higher." },
  "fvg-bear": { title: "Bearish FVG", prompt: "Click inside an unfilled bearish fair value gap.", concept: "fvg", lesson: "ict-33",
    explain: "A bearish FVG: the first candle's low is above the third candle's high. Price often returns up into it before continuing lower." },
  bsl: { title: "Buy-side liquidity", prompt: "Click the buy-side liquidity above price (stops resting above a high).", concept: "liquidity", lesson: "ict-34",
    explain: "Buy-side liquidity rests above swing highs, especially equal highs: short sellers' stops and breakout buy orders. It's a draw on price." },
  ssl: { title: "Sell-side liquidity", prompt: "Click the sell-side liquidity below price (stops resting below a low).", concept: "liquidity", lesson: "ict-34",
    explain: "Sell-side liquidity rests below swing lows, especially equal lows: long traders' stops. Price is drawn to it, often before reversing." },
  pd: { title: "Premium or discount", prompt: "Is the last close in premium, discount or equilibrium of the dealing range?", concept: "premium-discount", lesson: "ict-04",
    explain: "Take the range from the highest swing high to the lowest swing low. Above 50% is premium (look to sell), below is discount (look to buy)." },
  "ob-bull": { title: "Bullish order block", prompt: "Click the bullish order block: the last down candle before the displacement up.", concept: "order-blocks", lesson: "ict-27",
    explain: "A bullish order block is the last down-close candle before a strong displacement higher that leaves a fair value gap. Price often returns to it." },
  "ob-bear": { title: "Bearish order block", prompt: "Click the bearish order block: the last up candle before the displacement down.", concept: "order-blocks", lesson: "ict-27",
    explain: "A bearish order block is the last up-close candle before a strong displacement lower that leaves a fair value gap." },
  sweep: { title: "Liquidity sweep", prompt: "Click the candle that ran stops above a high or below a low, then closed back inside.", concept: "liquidity", lesson: "ict-16",
    explain: "A sweep (turtle soup) wicks through an old high or low, takes the resting stops, and closes back inside the range: a false breakout." },
};
export const EXERCISE_KINDS = Object.keys(EXERCISES) as ExerciseKind[];

/** How many candles the exercise shows, and how recent the target must be. */
export const VIEW = 70;
const RECENT = 45;

export interface Exercise { kind: ExerciseKind; end: number; analysis: Analysis; answer?: Zone }
export type Answer = { index: number; price: number } | { zone: Zone };
export interface Graded { correct: boolean; message: string }

/** Indexes of the structures that count as a right answer for an exercise. */
export function targets(ex: Exercise, c: Candle[]) {
  const a = ex.analysis, from = ex.end - RECENT, close = c[ex.end].c;
  switch (ex.kind) {
    case "fvg-bull": case "fvg-bear": {
      const kind = ex.kind === "fvg-bull" ? "bull" : "bear";
      return { gaps: a.gaps.filter((g) => g.kind === kind && g.index >= from && g.filledAt == null) };
    }
    case "bsl": return { pools: a.pools.filter((p) => p.kind === "BSL" && p.sweptAt == null && p.price > close && p.indices[0] >= ex.end - VIEW) };
    case "ssl": return { pools: a.pools.filter((p) => p.kind === "SSL" && p.sweptAt == null && p.price < close && p.indices[0] >= ex.end - VIEW) };
    case "ob-bull": case "ob-bear": {
      const kind = ex.kind === "ob-bull" ? "bull" : "bear";
      return { obs: a.orderBlocks.filter((o) => o.kind === kind && o.index >= from) };
    }
    case "sweep": return { sweeps: a.sweeps.filter((s) => s.index >= from) };
    case "pd": return {};
  }
}

const hasTarget = (ex: Exercise, c: Candle[]) => {
  if (ex.kind === "pd") return !!ex.analysis.range && ex.analysis.range.high.index >= ex.end - VIEW && ex.analysis.range.low.index >= ex.end - VIEW;
  const t = targets(ex, c);
  return Object.values(t).some((list) => (list as unknown[]).length > 0);
};

/** A random moment in `c` that has at least one target for `kind`. Tries `tries` times, then gives up (null). */
export function makeExercise(c: Candle[], kind: ExerciseKind, rand: () => number = Math.random, tries = 60): Exercise | null {
  if (c.length < 200) return null;
  for (let t = 0; t < tries; t++) {
    const end = 160 + Math.floor(rand() * (c.length - 161));
    const ex: Exercise = { kind, end, analysis: analyze(c, end, 160) };
    if (!hasTarget(ex, c)) continue;
    if (kind === "pd") ex.answer = zoneOf(ex.analysis.range!, c[end].c);
    return ex;
  }
  return null;
}

/**
 * Click answers are judged generously on time (anywhere from the structure to the last candle,
 * because zones extend to the right) and on price with a small tolerance (0.15 ATR).
 */
export function grade(ex: Exercise, c: Candle[], ans: Answer): Graded {
  const info = EXERCISES[ex.kind];
  if (ex.kind === "pd") {
    if (!("zone" in ans)) return { correct: false, message: "Pick premium, discount or equilibrium." };
    const ok = ans.zone === ex.answer;
    const r = ex.analysis.range!, d = decimalsFor(c), f = (x: number) => x.toFixed(d);
    return { correct: ok, message: `${ok ? "Right" : "Not quite"}: the range runs ${f(r.low.price)} → ${f(r.high.price)}, 50% is ${f(r.eq)}, and the close ${f(c[ex.end].c)} is in ${ex.answer}. ${info.explain}` };
  }
  if (!("index" in ans)) return { correct: false, message: "Click on the chart." };
  const tol = ex.analysis.atr * 0.15;
  const t = targets(ex, c);
  let ok = false;
  if (t.gaps) ok = t.gaps.some((g) => ans.index >= g.index - 1 && ans.price >= g.bottom - tol && ans.price <= g.top + tol);
  if (t.pools) ok = t.pools.some((p) => ans.index >= p.indices[0] - 2 && Math.abs(ans.price - p.price) <= Math.max(tol, ex.analysis.atr * 0.35));
  if (t.obs) ok = t.obs.some((o) => ans.index >= o.index - 1 && ans.price >= o.low - tol && ans.price <= o.high + tol);
  if (t.sweeps) ok = t.sweeps.some((s) => Math.abs(ans.index - s.index) <= 1);
  const count = Object.values(t).reduce((n, list) => n + (list as unknown[]).length, 0);
  return { correct: ok, message: ok ? `Right. ${info.explain}` : `Not quite. The detector found ${count} here (highlighted). ${info.explain}` };
}

/** Accuracy per exercise kind over the last `n` answers of each kind; the weakest kind with at least 3 answers. */
export function exerciseStats(answers: { kind: string; correct: boolean; at: number }[], n = 20) {
  const by = new Map<string, { total: number; right: number }>();
  for (const kind of EXERCISE_KINDS) {
    const last = answers.filter((a) => a.kind === kind).sort((a, b) => b.at - a.at).slice(0, n);
    by.set(kind, { total: last.length, right: last.filter((a) => a.correct).length });
  }
  const weakest = [...by.entries()].filter(([, v]) => v.total >= 3).sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0]?.[0] as ExerciseKind | undefined;
  return { by, weakest };
}
