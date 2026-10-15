/**
 * Edge finder: where in your own trades the expectancy is, by time, setup, session,
 * bias alignment and checklist score. Every figure carries its sample size and a 95%
 * confidence half-width, so a lucky handful of trades isn't mistaken for an edge.
 * Tested in tests/edge.test.ts.
 */
import { SESSIONS } from "./constants";
import { round, weekday } from "./stats";
import type { DailyLog, Trade } from "./types";

/** Below this many trades a group is shown but never called an edge. */
export const MIN_SAMPLE = 8;

export interface Cell { key: string; n: number; expectancy: number; winRate: number; totalR: number; ci: number; confirmed: boolean }

export function cellOf(key: string, ts: Trade[]): Cell {
  const n = ts.length;
  const total = ts.reduce((a, t) => a + t.r, 0);
  const mean = n ? total / n : 0;
  const sd = n > 1 ? Math.sqrt(ts.reduce((a, t) => a + (t.r - mean) ** 2, 0) / (n - 1)) : Infinity;
  // Under 3 trades the spread says nothing (two equal results would give a range of ±0).
  const ci = n >= 3 ? 1.96 * sd / Math.sqrt(n) : Infinity;
  return { key, n, expectancy: round(mean), winRate: n ? ts.filter((t) => t.r > 0).length / n : 0, totalR: round(total), ci: Number.isFinite(ci) ? round(ci) : Infinity, confirmed: n >= MIN_SAMPLE && mean - ci > 0 };
}
const group = (ts: Trade[], keyOf: (t: Trade) => string | null) => {
  const m = new Map<string, Trade[]>();
  for (const t of ts) { const k = keyOf(t); if (k != null) m.set(k, [...(m.get(k) ?? []), t]); }
  return m;
};

/** New York hour of the entry (the journal's time field is New York time). */
export const nyHour = (t: Trade): number | null => (t.time && /^\d{1,2}:\d{2}/.test(t.time) ? Number(t.time.split(":")[0]) : null);

export function byHour(trades: Trade[]): (Cell | null)[] {
  const g = group(trades, (t) => { const h = nyHour(t); return h == null ? null : String(h); });
  return Array.from({ length: 24 }, (_, h) => (g.has(String(h)) ? cellOf(String(h), g.get(String(h))!) : null));
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
/** Weekday × session grid; null where there are no trades. */
export function heatmap(trades: Trade[]): { rows: string[]; cols: string[]; cells: (Cell | null)[][] } {
  const cols = SESSIONS.filter((s) => trades.some((t) => t.session === s));
  const cells = WEEKDAYS.map((d) => cols.map((s) => {
    const ts = trades.filter((t) => weekday(t.date) === d && t.session === s);
    return ts.length ? cellOf(`${d} · ${s}`, ts) : null;
  }));
  return { rows: WEEKDAYS, cols, cells };
}

export const R_BUCKETS: { label: string; test: (r: number) => boolean; sign: -1 | 0 | 1 }[] = [
  { label: "≤ −1R", test: (r) => r <= -1, sign: -1 },
  { label: "−1 to 0", test: (r) => r > -1 && r < 0, sign: -1 },
  { label: "0", test: (r) => r === 0, sign: 0 },
  { label: "0 to 1", test: (r) => r > 0 && r < 1, sign: 1 },
  { label: "1 to 2", test: (r) => r >= 1 && r < 2, sign: 1 },
  { label: "2 to 3", test: (r) => r >= 2 && r < 3, sign: 1 },
  { label: "≥ 3R", test: (r) => r >= 3, sign: 1 },
];
export const rDistribution = (trades: Trade[]) => R_BUCKETS.map((b) => ({ label: b.label, sign: b.sign, n: trades.filter((t) => b.test(t.r)).length }));

export type Alignment = "With my bias" | "Against my bias" | "No bias call";
/** Was the trade in the direction of that day's bias in the Daily log? */
export function alignment(t: Trade, logsByDate: Map<string, DailyLog>): Alignment {
  const b = logsByDate.get(t.date)?.biasDir;
  if (!b || b === "Range") return "No bias call";
  return (b === "Bullish") === (t.direction === "Long") ? "With my bias" : "Against my bias";
}
export const logsByDate = (logs: DailyLog[]) => new Map(logs.map((l) => [l.date, l]));

export function byAlignment(trades: Trade[], logs: DailyLog[]): Cell[] {
  const m = logsByDate(logs);
  return [...group(trades, (t) => alignment(t, m)).entries()].map(([k, ts]) => cellOf(k, ts)).sort((a, b) => b.expectancy - a.expectancy);
}

export function byChecklist(trades: Trade[]): Cell[] {
  const bucket = (t: Trade) => (t.checklist == null ? "Not scored" : t.checklist >= 8 ? "8–10" : t.checklist >= 6 ? "6–7" : "0–5");
  const order = ["8–10", "6–7", "0–5", "Not scored"];
  return [...group(trades, bucket).entries()].map(([k, ts]) => cellOf(k, ts)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** Results per execution model (trades without a model are left out). */
export function byModel(trades: Trade[], nameOf: (id: string) => string): Cell[] {
  return [...group(trades, (t) => t.model ?? null).entries()].map(([k, ts]) => cellOf(nameOf(k), ts)).sort((a, b) => b.expectancy - a.expectancy);
}

/** Trades by whether (and how) they were checked before entry. */
export function byPreCheck(trades: Trade[]): Cell[] {
  const label = (t: Trade) => ({ meets_plan: "Checked: meets plan", partly: "Checked: partly", does_not_meet: "Checked: doesn't meet plan", manual: "Plan saved, no AI check" } as Record<string, string>)[t.preCheckDecision ?? ""] ?? "Not checked";
  const order = ["Checked: meets plan", "Checked: partly", "Checked: doesn't meet plan", "Plan saved, no AI check", "Not checked"];
  return [...group(trades, label).entries()].map(([k, ts]) => cellOf(k, ts)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export interface Combo extends Cell { setup: string; session: string; align: Alignment }
/** Setup × session × bias alignment, with at least `min` trades, best first. */
export function combos(trades: Trade[], logs: DailyLog[], min = 3): Combo[] {
  const m = logsByDate(logs);
  return [...group(trades, (t) => `${t.setup}|${t.session}|${alignment(t, m)}`).entries()]
    .filter(([, ts]) => ts.length >= min)
    .map(([k, ts]) => { const [setup, session, align] = k.split("|"); return { ...cellOf(`${setup} · ${session} · ${align.toLowerCase()}`, ts), setup, session, align: align as Alignment }; })
    .sort((a, b) => b.expectancy - a.expectancy || b.n - a.n);
}

/**
 * Your A+ setups: combinations with a statistically positive expectancy, or, while the
 * sample is still small, a clearly positive one (≥ +0.3R over MIN_SAMPLE trades). Best 3.
 */
export function aPlusSetups(all: Combo[]): Combo[] {
  return all.filter((c) => c.confirmed || (c.n >= MIN_SAMPLE && c.expectancy >= 0.3)).slice(0, 3);
}
export function matchesAPlus(t: Trade, aplus: Combo[], logs: Map<string, DailyLog>): boolean {
  const a = alignment(t, logs);
  return aplus.some((c) => c.setup === t.setup && c.session === t.session && c.align === a);
}
