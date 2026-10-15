/**
 * Chart replay trainer logic: CSV import, synthetic practice data and order simulation.
 * Pure functions; tested in tests/replay.test.ts.
 */
import type { BiasDir, Candle, Direction, Drill } from "./types";

// CSV import ------------------------------------------------------------------
export interface ParseResult { candles: Candle[]; skipped: number }

/**
 * Reads OHLC candles from CSV text. Handles:
 *  - TradingView export:  time,open,high,low,close[,Volume]   (unix seconds or ISO time)
 *  - MT4/MT5 export:      2026.10.01,00:00,1.1010,1.1020,1.1000,1.1015,123   (no header)
 *                         <DATE>	<TIME>	<OPEN>	<HIGH>	<LOW>	<CLOSE>…   (MT5, tab separated)
 *  - Generic:             any header with date/time + open/high/low/close columns
 * Times are read as UTC. Rows that can't be read are skipped and counted.
 */
export function parseCandlesCsv(text: string): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { candles: [], skipped: 0 };
  const delim = [";", "\t", ","].map((d) => [d, lines[0].split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));

  const head = rows[0].map((h) => h.toLowerCase().replace(/[<>\s_]/g, ""));
  const hasHeader = head.some((h) => ["open", "o", "close", "c", "high"].includes(h));
  let ti: number, di: number | null = null, oi: number, hi: number, li: number, ci: number;
  if (hasHeader) {
    const find = (...names: string[]) => head.findIndex((h) => names.includes(h));
    oi = find("open", "o"); hi = find("high", "h"); li = find("low", "l"); ci = find("close", "c");
    const date = find("date", "day"), time = find("time", "timestamp", "datetime", "date/time", "gmttime", "localtime");
    if (date >= 0 && time >= 0) { di = date; ti = time; } else ti = time >= 0 ? time : date >= 0 ? date : 0;
  } else {
    // MT4 style: date, time, o, h, l, c   vs   time, o, h, l, c
    const twoCol = /^\d{1,2}:\d{2}/.test(rows[0][1] ?? "");
    if (twoCol) { di = 0; ti = 1; oi = 2; hi = 3; li = 4; ci = 5; } else { ti = 0; oi = 1; hi = 2; li = 3; ci = 4; }
  }
  if ([oi, hi, li, ci].some((i) => i < 0)) return { candles: [], skipped: rows.length };

  const out: Candle[] = [];
  let skipped = 0;
  for (const r of rows.slice(hasHeader ? 1 : 0)) {
    const t = parseTime(di != null ? `${r[di]} ${r[ti]}` : r[ti]);
    const [o, h, l, c] = [oi, hi, li, ci].map((i) => Number(r[i]));
    if (t == null || ![o, h, l, c].every(Number.isFinite) || h < Math.max(o, c, l) || l > Math.min(o, c, h)) { skipped++; continue; }
    out.push({ t, o, h, l, c });
  }
  out.sort((a, b) => a.t - b.t);
  const dedup = out.filter((c, i) => i === 0 || c.t !== out[i - 1].t);
  return { candles: dedup, skipped: skipped + out.length - dedup.length };
}

/** Unix seconds/ms, ISO, "2026.10.01 00:00", "2026-10-01 00:00:00", "20261001 000000". Returns ms (UTC). */
export function parseTime(s: string | undefined): number | null {
  if (!s) return null;
  s = s.trim();
  if (/^\d{9,13}(\.\d+)?$/.test(s)) { const n = Number(s); return n < 1e11 ? n * 1000 : n; }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})(?:[ T]?(\d{2}):?(\d{2}):?(\d{2})?)?$/);
  if (compact) s = `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4] ?? "00"}:${compact[5] ?? "00"}:${compact[6] ?? "00"}`;
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

// Synthetic data --------------------------------------------------------------
/** Seeded random numbers so a generated set is reproducible. */
export function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Practice candles with trending legs, retracements and occasional stop runs,
 * so there is structure to read. Not real market data.
 */
export function syntheticCandles(n = 3000, seed = Date.now() % 100000, start = 1.1, stepMinutes = 15): Candle[] {
  const rand = rng(seed);
  const out: Candle[] = [];
  let price = start, drift = 0, legLeft = 0;
  /** Direction of a displacement due in the next candle or two (after a stop run), 0 = none. */
  let pending = 0, pendingIn = 0;
  const vol = start * 0.0009;
  let t = Date.UTC(2026, 0, 5, 0, 0);
  for (let i = 0; i < n; i++) {
    if (legLeft-- <= 0) { drift = (rand() - 0.5) * vol * 0.6; legLeft = 20 + Math.floor(rand() * 60); }
    const hour = new Date(t).getUTCHours();
    const killzone = (hour >= 7 && hour < 10) || (hour >= 12 && hour < 16);
    const session = hour >= 7 && hour < 10 ? 1.8 : hour >= 12 && hour < 16 ? 1.6 : hour >= 22 || hour < 2 ? 0.6 : 0.9;
    const o = price;
    let c = o + drift + (rand() - 0.5) * vol * session;
    let h = Math.max(o, c) + rand() * vol * 0.6 * session;
    let l = Math.min(o, c) - rand() * vol * 0.6 * session;
    // Displacement: a strong, full-bodied candle. Mostly right after a stop run (reversing it),
    // otherwise occasionally in the killzones in the direction of the current leg.
    const dispDir = pending && --pendingIn <= 0 ? pending : rand() < (killzone ? 0.02 : 0.005) ? (drift >= 0 ? 1 : -1) : 0;
    if (dispDir) {
      pending = 0;
      c = o + dispDir * vol * session * (2 + rand() * 1.5);
      h = Math.max(o, c) + rand() * vol * 0.15;
      l = Math.min(o, c) - rand() * vol * 0.15;
      drift = dispDir * Math.abs(drift || vol * 0.15); legLeft = Math.max(legLeft, 15);
    } else if (rand() < 0.03) { // stop run: a long wick through recent liquidity, then reversal
      const up = rand() < 0.5;
      if (up) { h += vol * (1.5 + rand() * 2); c = Math.min(c, o); } else { l -= vol * (1.5 + rand() * 2); c = Math.max(c, o); }
      if (rand() < 0.45) { pending = up ? -1 : 1; pendingIn = 1 + Math.floor(rand() * 3); }
    }
    const d = start > 50 ? 2 : 5;
    const r = (x: number) => Number(x.toFixed(d));
    out.push({ t, o: r(o), h: r(Math.max(h, o, c)), l: r(Math.min(l, o, c)), c: r(c) });
    price = c;
    t += stepMinutes * 60_000;
    if (new Date(t).getUTCDay() === 6) t += 2 * 86_400_000; // skip weekends
  }
  return out;
}

// Order simulation ------------------------------------------------------------
export interface Order { direction: Direction; entry: number; stop: number; target: number; placedIndex: number; market: boolean }
export interface OrderState { status: "pending" | "open" | "win" | "loss"; fillIndex: number | null; exitIndex: number | null; r: number }

export function validateOrder(o: Pick<Order, "direction" | "entry" | "stop" | "target">): string | null {
  if (![o.entry, o.stop, o.target].every((x) => Number.isFinite(x))) return "Set entry, stop and target.";
  if (o.direction === "Long" && !(o.stop < o.entry && o.entry < o.target)) return "For a long, the stop must be below the entry and the target above it.";
  if (o.direction === "Short" && !(o.stop > o.entry && o.entry > o.target)) return "For a short, the stop must be above the entry and the target below it.";
  return null;
}
export const rewardRisk = (o: Pick<Order, "entry" | "stop" | "target">) => Math.abs(o.target - o.entry) / Math.abs(o.entry - o.stop);

/**
 * Walks candles after the order was placed, up to and including `cursor`.
 * Pending orders fill when price trades through the entry. Once filled, if one candle
 * touches both stop and target we assume the stop hit first (the conservative choice).
 */
export function simulate(o: Order, candles: Candle[], cursor: number): OrderState {
  const risk = Math.abs(o.entry - o.stop);
  const sign = o.direction === "Long" ? 1 : -1;
  const rOf = (price: number) => Math.round(((price - o.entry) * sign / risk) * 100) / 100;
  let fillIndex: number | null = o.market ? o.placedIndex : null;
  for (let i = o.placedIndex + 1; i <= cursor && i < candles.length; i++) {
    const k = candles[i];
    if (fillIndex == null) {
      if (k.l <= o.entry && o.entry <= k.h) fillIndex = i; else continue;
    }
    const stopHit = o.direction === "Long" ? k.l <= o.stop : k.h >= o.stop;
    const targetHit = o.direction === "Long" ? k.h >= o.target : k.l <= o.target;
    if (stopHit) return { status: "loss", fillIndex, exitIndex: i, r: -1 };
    // On the fill candle we can't tell whether the target traded before the entry, so only
    // count it if the candle also closed beyond the target.
    const closedBeyond = o.direction === "Long" ? k.c >= o.target : k.c <= o.target;
    if (targetHit && (i > fillIndex || closedBeyond)) return { status: "win", fillIndex, exitIndex: i, r: rOf(o.target) };
  }
  if (fillIndex == null) return { status: "pending", fillIndex: null, exitIndex: null, r: 0 };
  return { status: "open", fillIndex, exitIndex: null, r: rOf(candles[Math.min(cursor, candles.length - 1)].c) };
}

// Bias scoring ----------------------------------------------------------------
/** Average true range over `n` candles ending at `end`. */
export function atr(candles: Candle[], end: number, n = 14): number {
  let sum = 0, k = 0;
  for (let i = Math.max(1, end - n + 1); i <= end; i++) {
    const c = candles[i], p = candles[i - 1];
    sum += Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)); k++;
  }
  return k ? sum / k : 0;
}

/** What price did between two candles: a move under 1.5 ATR counts as a range. */
export function actualDirection(candles: Candle[], start: number, end: number): BiasDir {
  const move = candles[end].c - candles[start].c;
  const a = atr(candles, start) || Math.abs(move) || 1;
  if (Math.abs(move) < a * 1.5) return "Range";
  return move > 0 ? "Bullish" : "Bearish";
}

/** Price decimals that fit a series (5 for EUR/USD, 3 for USD/JPY, 2 for indices). */
export function decimalsFor(candles: Candle[]): number {
  const p = candles[0]?.c ?? 1;
  return p >= 1000 ? 1 : p >= 50 ? 3 : 5;
}

/** A drill as text for the AI coach: the setup the student saw, their call, and what happened after. */
export function drillAsText(d: Drill, candles: Candle[], context = 80): string {
  const dec = decimalsFor(candles);
  const from = Math.max(0, d.startIndex - context), to = Math.min(candles.length - 1, d.endIndex);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
  const f = (x: number | null | undefined) => (x == null ? "–" : x.toFixed(dec));
  const rows = [];
  for (let i = from; i <= to; i++) { const k = candles[i]; rows.push(`${i - d.startIndex},${iso(k.t)},${f(k.o)},${f(k.h)},${f(k.l)},${f(k.c)}`); }
  return [
    `Market: ${d.market} · timeframe ${d.timeframe || "unknown"} · times UTC`,
    `Bias called at index 0: ${d.bias || "none"}${d.biasCorrect == null ? "" : ` (scored ${d.biasCorrect ? "right" : "wrong"} over ${d.endIndex - d.startIndex} candles)`}`,
    d.direction ? `Order: ${d.direction} ${d.setup ?? ""} · entry ${f(d.entry)} · stop ${f(d.stop)} · target ${f(d.target)} · outcome ${d.outcome}${d.outcome === "win" || d.outcome === "loss" || d.outcome === "open" ? ` ${d.r}R` : ""}` : "Order: none placed",
    `Student's notes: ${d.notes || "(none)"}`,
    "",
    "Candles (index,time,open,high,low,close):",
    ...rows,
  ].join("\n");
}
