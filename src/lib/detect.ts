/**
 * ICT structure detector: mechanical approximations of ICT's definitions, used to
 * train the eye (chart exercises) and to draw overlays in replay.
 *
 * Every function looks only at candles up to `end`, so an overlay drawn at a candle
 * never uses information from later candles. Tested in tests/detect.test.ts.
 *
 * These rules are simplifications. ICT applies judgement (higher-timeframe context,
 * time of day, which liquidity is "obvious") that no rule fully captures.
 */
import { atr } from "./replay";
import type { Candle } from "./types";

export interface Swing { index: number; price: number; kind: "high" | "low" }
/** Fair value gap. `index` is the middle (displacement) candle; the gap spans candles index−1 to index+1. */
export interface Gap { kind: "bull" | "bear"; index: number; top: number; bottom: number; mitigatedAt: number | null; filledAt: number | null }
/** Resting liquidity: buy-side above swing highs, sell-side below swing lows. */
export interface Pool { kind: "BSL" | "SSL"; price: number; indices: number[]; equal: boolean; sweptAt: number | null }
/** A candle that ran a pool's stops and closed back inside it (turtle soup). */
export interface Sweep { index: number; kind: "BSL" | "SSL"; level: number }
export interface OrderBlock { kind: "bull" | "bear"; index: number; high: number; low: number; displacementAt: number; mitigatedAt: number | null }
export interface DealingRange { high: Swing; low: Swing; eq: number; band: number }
export type Zone = "premium" | "discount" | "equilibrium";

export interface Analysis {
  end: number; atr: number; swings: Swing[]; gaps: Gap[]; pools: Pool[]; sweeps: Sweep[]; orderBlocks: OrderBlock[]; range: DealingRange | null;
}

/** Fractal swings: higher high (lower low) than `n` candles on each side. Only swings confirmed by `end` are returned. */
export function swings(c: Candle[], from: number, end: number, n = 2): Swing[] {
  const out: Swing[] = [];
  for (let i = Math.max(from, n); i <= end - n; i++) {
    let hi = true, lo = true;
    for (let j = 1; j <= n; j++) {
      if (!(c[i].h > c[i - j].h && c[i].h >= c[i + j].h)) hi = false;
      if (!(c[i].l < c[i - j].l && c[i].l <= c[i + j].l)) lo = false;
    }
    if (hi) out.push({ index: i, price: c[i].h, kind: "high" });
    if (lo) out.push({ index: i, price: c[i].l, kind: "low" });
  }
  return out;
}

/**
 * Average range at candle `i` (the candle's own range when there's no history yet).
 * Thresholds use the ATR where the structure formed, never at the end of the data,
 * so whether something counts can't depend on later volatility.
 */
const localAtr = (c: Candle[], i: number) => atr(c, i) || c[i].h - c[i].l;

/** Three-candle imbalances of at least `minAtr` × the local ATR, with when price first traded into them and when they were filled. */
export function fvgs(c: Candle[], from: number, end: number, minAtr: number): Gap[] {
  const out: Gap[] = [];
  for (let i = Math.max(from, 1); i <= end - 1; i++) {
    const a = c[i - 1], b = c[i + 1];
    const minSize = minAtr * localAtr(c, i - 1);
    let g: Gap | null = null;
    if (b.l > a.h && b.l - a.h >= minSize) g = { kind: "bull", index: i, bottom: a.h, top: b.l, mitigatedAt: null, filledAt: null };
    else if (b.h < a.l && a.l - b.h >= minSize) g = { kind: "bear", index: i, top: a.l, bottom: b.h, mitigatedAt: null, filledAt: null };
    if (!g) continue;
    for (let j = i + 2; j <= end; j++) {
      const k = c[j];
      const into = g.kind === "bull" ? k.l < g.top : k.h > g.bottom;
      const through = g.kind === "bull" ? k.l <= g.bottom : k.h >= g.top;
      if (into && g.mitigatedAt == null) g.mitigatedAt = j;
      if (through) { g.filledAt = j; break; }
    }
    out.push(g);
  }
  return out;
}

/** First candle after `after` (up to `end`) that trades beyond `price` in the pool's direction. */
function sweptAfter(c: Candle[], kind: Pool["kind"], price: number, after: number, end: number): number | null {
  for (let j = after + 1; j <= end; j++) if (kind === "BSL" ? c[j].h > price : c[j].l < price) return j;
  return null;
}

/**
 * Liquidity pools from swings. Two swings within `tolAtr` × the local ATR of each other, with the first
 * still intact when the second forms, make one "equal highs/lows" pool (the most obvious liquidity).
 */
export function liquidityPools(c: Candle[], sw: Swing[], end: number, tolAtr: number): Pool[] {
  const out: Pool[] = [];
  for (const side of ["high", "low"] as const) {
    const kind: Pool["kind"] = side === "high" ? "BSL" : "SSL";
    const list = sw.filter((s) => s.kind === side);
    const used = new Set<number>();
    for (let a = 0; a < list.length; a++) {
      if (used.has(a)) continue;
      const first = list[a];
      const aSwept = sweptAfter(c, kind, first.price, first.index, end);
      let pair = -1;
      for (let b = a + 1; b < list.length; b++) {
        const second = list[b];
        if (aSwept != null && aSwept < second.index) break;
        if (Math.abs(second.price - first.price) <= tolAtr * localAtr(c, second.index)) { pair = b; break; }
      }
      if (pair >= 0) {
        const second = list[pair];
        used.add(pair);
        const price = kind === "BSL" ? Math.max(first.price, second.price) : Math.min(first.price, second.price);
        out.push({ kind, price, indices: [first.index, second.index], equal: true, sweptAt: sweptAfter(c, kind, price, second.index, end) });
      } else {
        out.push({ kind, price: first.price, indices: [first.index], equal: false, sweptAt: aSwept });
      }
    }
  }
  return out.sort((p, q) => p.indices[0] - q.indices[0]);
}

/** A level is "obvious" liquidity if it's equal highs/lows or held for at least this many candles before being run. */
export const OBVIOUS_AGE = 8;

/**
 * Pools whose sweeping candle closed back inside the level: a stop run, not a breakout.
 * Only obvious liquidity counts; running a minor swing a few candles later isn't a meaningful sweep.
 */
export function sweeps(c: Candle[], pools: Pool[]): Sweep[] {
  const byIndex = new Map<number, Sweep>();
  for (const p of pools) {
    if (p.sweptAt == null) continue;
    if (!p.equal && p.sweptAt - p.indices[p.indices.length - 1] < OBVIOUS_AGE) continue;
    const k = c[p.sweptAt];
    const closedBack = p.kind === "BSL" ? k.c < p.price : k.c > p.price;
    const prev = byIndex.get(p.sweptAt);
    // If one candle runs several pools, keep the furthest level.
    if (closedBack && (!prev || (p.kind === "BSL" ? p.price > prev.level : p.price < prev.level))) byIndex.set(p.sweptAt, { index: p.sweptAt, kind: p.kind, level: p.price });
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

export const isDisplacement = (k: Candle, a: number) => {
  const body = Math.abs(k.c - k.o);
  return a > 0 && body >= 1.2 * a && body >= 0.6 * (k.h - k.l);
};

/** Last opposite-colour candle (within 3) before a displacement candle that left a fair value gap. */
export function orderBlocks(c: Candle[], gaps: Gap[], end: number): OrderBlock[] {
  const out: OrderBlock[] = [];
  for (const g of gaps) {
    const d = c[g.index];
    const up = g.kind === "bull";
    if (up !== d.c > d.o || !isDisplacement(d, atr(c, g.index - 1))) continue;
    for (let j = g.index - 1; j >= Math.max(0, g.index - 3); j--) {
      const k = c[j];
      if (up ? k.c < k.o : k.c > k.o) {
        const ob: OrderBlock = { kind: g.kind, index: j, high: k.h, low: k.l, displacementAt: g.index, mitigatedAt: null };
        for (let m = g.index + 2; m <= end; m++) if (up ? c[m].l <= ob.high : c[m].h >= ob.low) { ob.mitigatedAt = m; break; }
        out.push(ob);
        break;
      }
    }
  }
  return out;
}

/** Highest swing high and lowest swing low in the last `lookback` candles. */
export function dealingRange(sw: Swing[], end: number, lookback = 60): DealingRange | null {
  const win = sw.filter((s) => s.index >= end - lookback && s.index <= end);
  const highs = win.filter((s) => s.kind === "high"), lows = win.filter((s) => s.kind === "low");
  if (!highs.length || !lows.length) return null;
  const high = highs.reduce((a, b) => (b.price > a.price ? b : a));
  const low = lows.reduce((a, b) => (b.price < a.price ? b : a));
  return { high, low, eq: (high.price + low.price) / 2, band: (high.price - low.price) * 0.05 };
}

export function zoneOf(r: DealingRange, price: number): Zone {
  return price > r.eq + r.band ? "premium" : price < r.eq - r.band ? "discount" : "equilibrium";
}

/** Everything the detector can see at candle `end`, looking back `lookback` candles. */
export function analyze(c: Candle[], end: number, lookback = 150): Analysis {
  const from = Math.max(0, end - lookback);
  const a = atr(c, end);
  const sw = swings(c, from, end);
  const gaps = fvgs(c, from, end, 0.15);
  const pools = liquidityPools(c, sw, end, 0.15);
  return { end, atr: a, swings: sw, gaps, pools, sweeps: sweeps(c, pools), orderBlocks: orderBlocks(c, gaps, end), range: dealingRange(sw, end) };
}
