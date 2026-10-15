/**
 * Targeted replay drills: find the moments in a candle series where a specific ICT
 * situation has just formed, so practice is deliberate instead of random.
 *
 * Moments are chosen ONLY from what is visible at the start candle, never from what
 * happens next. Filtering on outcomes would show you only setups that worked and
 * inflate your practice results. Tested in tests/scenarios.test.ts.
 */
import { analyze, isDisplacement } from "./detect";
import { atr } from "./replay";
import type { BiasDir, Candle } from "./types";

export type ScenarioKind = "ssl-sweep-long" | "bsl-sweep-short" | "fvg-bull" | "fvg-bear" | "ob-bull" | "ob-bear" | "eq-lows" | "eq-highs";

export const SCENARIOS: Record<ScenarioKind, { title: string; desc: string; bias: BiasDir; lesson: string }> = {
  "ssl-sweep-long": { title: "Sell-side sweep → displacement up", desc: "Lows were just run and price displaced higher. Plan a long on the retrace into the FVG or order block.", bias: "Bullish", lesson: "ict-16" },
  "bsl-sweep-short": { title: "Buy-side sweep → displacement down", desc: "Highs were just run and price displaced lower. Plan a short on the retrace.", bias: "Bearish", lesson: "ict-16" },
  "fvg-bull": { title: "Fresh bullish FVG", desc: "A displacement up just left a fair value gap. Will price return to it, and does it hold?", bias: "Bullish", lesson: "ict-33" },
  "fvg-bear": { title: "Fresh bearish FVG", desc: "A displacement down just left a fair value gap. Will price return to it, and does it hold?", bias: "Bearish", lesson: "ict-33" },
  "ob-bull": { title: "New bullish order block", desc: "A bullish order block just formed. Plan the entry at the block, stop below it.", bias: "Bullish", lesson: "ict-27" },
  "ob-bear": { title: "New bearish order block", desc: "A bearish order block just formed. Plan the entry at the block, stop above it.", bias: "Bearish", lesson: "ict-27" },
  "eq-lows": { title: "Equal lows below price", desc: "Equal lows: obvious sell-side liquidity. Is it the draw on liquidity, and what happens after it's taken?", bias: "Bearish", lesson: "ict-34" },
  "eq-highs": { title: "Equal highs above price", desc: "Equal highs: obvious buy-side liquidity. Is it the draw on liquidity, and what happens after it's taken?", bias: "Bullish", lesson: "ict-34" },
};
export const SCENARIO_KINDS = Object.keys(SCENARIOS) as ScenarioKind[];

/** Candles of history needed before a drill start, and candles left after it to play out. */
export const LEAD = 120, TAIL = 60;
/** Two moments of the same kind closer than this count as one. */
const SPACING = 10;

/** Start candles for each scenario. A start is the first candle after the situation is fully visible. */
export function findScenarios(c: Candle[]): Record<ScenarioKind, number[]> {
  const out = Object.fromEntries(SCENARIO_KINDS.map((k) => [k, [] as number[]])) as Record<ScenarioKind, number[]>;
  if (c.length < LEAD + TAIL + 10) return out;
  const a = analyze(c, c.length - 1, c.length);
  const add = (kind: ScenarioKind, start: number) => {
    if (start < LEAD || start > c.length - 1 - TAIL) return;
    const list = out[kind];
    if (list.length && start - list[list.length - 1] < SPACING) return;
    list.push(start);
  };
  const displaced = (i: number) => isDisplacement(c[i], atr(c, i - 1));
  // Gaps are sorted by index already; the gap is visible once its third candle (index + 1) has closed.
  for (const g of a.gaps) {
    if (!displaced(g.index)) continue;
    const start = g.index + 2;
    add(g.kind === "bull" ? "fvg-bull" : "fvg-bear", start);
    // Sweep of the opposite side within the 5 candles before the displacement.
    const sweptBefore = a.sweeps.some((s) => s.kind === (g.kind === "bull" ? "SSL" : "BSL") && s.index <= g.index && s.index >= g.index - 5);
    if (sweptBefore) add(g.kind === "bull" ? "ssl-sweep-long" : "bsl-sweep-short", start);
  }
  for (const o of a.orderBlocks) add(o.kind === "bull" ? "ob-bull" : "ob-bear", o.displacementAt + 2);
  // Equal highs/lows are visible once the second swing is confirmed (2 candles later), if not yet run by then.
  for (const p of a.pools.filter((p) => p.equal).sort((x, y) => x.indices[1] - y.indices[1])) {
    const start = p.indices[1] + 3;
    if (p.sweptAt != null && p.sweptAt < start) continue;
    add(p.kind === "BSL" ? "eq-highs" : "eq-lows", start);
  }
  for (const k of SCENARIO_KINDS) out[k].sort((x, y) => x - y);
  return out;
}
