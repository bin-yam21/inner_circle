import type { Trade } from "./types";

export interface Group { key: string; n: number; wins: number; totalR: number; winRate: number; expectancy: number }
export interface TradeStats {
  n: number; wins: number; losses: number; breakeven: number; winRate: number; totalR: number;
  expectancy: number; avgWin: number; avgLoss: number; profitFactor: number | null;
  maxDrawdownR: number; longestWinStreak: number; longestLossStreak: number; currentLossStreak: number;
  equity: { i: number; date: string; r: number; cum: number }[];
}

/** Sort oldest → newest by date then creation time. */
export const chronological = (trades: Trade[]) =>
  trades.slice().sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")) || a.createdAt - b.createdAt);

export function tradeStats(input: Trade[]): TradeStats {
  const trades = chronological(input);
  const n = trades.length;
  const winsArr = trades.filter((t) => t.r > 0), lossArr = trades.filter((t) => t.r < 0);
  const totalR = trades.reduce((a, t) => a + t.r, 0);
  const grossWin = winsArr.reduce((a, t) => a + t.r, 0), grossLoss = -lossArr.reduce((a, t) => a + t.r, 0);
  let cum = 0, peak = 0, maxDD = 0, ws = 0, ls = 0, bestW = 0, bestL = 0;
  const equity = trades.map((t, i) => {
    cum += t.r; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum);
    if (t.r > 0) { ws++; ls = 0; } else if (t.r < 0) { ls++; ws = 0; } else { ws = 0; ls = 0; }
    bestW = Math.max(bestW, ws); bestL = Math.max(bestL, ls);
    return { i: i + 1, date: t.date, r: t.r, cum: round(cum) };
  });
  return {
    n, wins: winsArr.length, losses: lossArr.length, breakeven: n - winsArr.length - lossArr.length,
    winRate: n ? winsArr.length / n : 0, totalR: round(totalR), expectancy: n ? round(totalR / n) : 0,
    avgWin: winsArr.length ? round(grossWin / winsArr.length) : 0, avgLoss: lossArr.length ? round(-grossLoss / lossArr.length) : 0,
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss) : null,
    maxDrawdownR: round(maxDD), longestWinStreak: bestW, longestLossStreak: bestL, currentLossStreak: ls,
    equity,
  };
}

export function groupBy(trades: Trade[], keyOf: (t: Trade) => string | string[]): Group[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const keys = ([] as string[]).concat(keyOf(t)).filter(Boolean);
    for (const k of keys) map.set(k, [...(map.get(k) ?? []), t]);
  }
  return [...map.entries()].map(([key, ts]) => {
    const wins = ts.filter((t) => t.r > 0).length, totalR = ts.reduce((a, t) => a + t.r, 0);
    return { key, n: ts.length, wins, totalR: round(totalR), winRate: wins / ts.length, expectancy: round(totalR / ts.length) };
  }).sort((a, b) => b.totalR - a.totalR);
}

export const weekday = (date: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(date + "T12:00:00").getDay()];

/** Tilt guard: what the rules say to do given today's trades. */
export function tiltAdvice(all: Trade[], today: string, dailyLimitR: number): { level: "ok" | "warn" | "stop"; message: string; riskFactor: number } {
  const st = tradeStats(all);
  const todays = all.filter((t) => t.date === today);
  const todayR = todays.reduce((a, t) => a + t.r, 0);
  if (dailyLimitR > 0 && todayR <= -dailyLimitR) return { level: "stop", message: `You're at ${round(todayR)}R today, past your ${dailyLimitR}R daily loss limit. Stop trading for today and journal what happened.`, riskFactor: 0 };
  if (st.currentLossStreak >= 3) return { level: "stop", message: `${st.currentLossStreak} losses in a row. ICT: "equity preservation is the number one rule". Stop for today, review the trades, and come back at a quarter of your normal risk.`, riskFactor: 0.25 };
  if (st.currentLossStreak >= 1) {
    const f = 1 / Math.pow(2, st.currentLossStreak);
    return { level: "warn", message: `${st.currentLossStreak} loss${st.currentLossStreak > 1 ? "es" : ""} in a row. Halve your risk (now ×${f}) and take only A+ setups. Wait 30 minutes after a loss before the next entry.`, riskFactor: f };
  }
  return { level: "ok", message: "No losing streak. Trade your plan at normal risk.", riskFactor: 1 };
}

export const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
export const fmtR = (r: number) => (r > 0 ? "+" : "") + round(r).toFixed(2) + "R";
export const pct = (x: number) => Math.round(x * 100) + "%";
