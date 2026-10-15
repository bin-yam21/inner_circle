import { describe, expect, it } from "vitest";
import { tradeStats, groupBy, tiltAdvice } from "../src/lib/stats";
import { addTradingDays, ipdaAnchor, ipdaRanges, tradingDaysBetween } from "../src/lib/ipda";
import { parseFrontmatter } from "../src/lib/frontmatter";
import { calcR } from "../src/pages/TradeEditor";
import type { Trade } from "../src/lib/types";

const mk = (date: string, r: number, extra: Partial<Trade> = {}): Trade => ({
  id: date + r + Math.random(), date, market: "EUR/USD", direction: "Long", setup: "Order block", timeframe: "15m", session: "London open",
  r, emotionsBefore: [], emotionsAfter: [], mistakes: [], notes: "", account: "Demo", createdAt: 0, updatedAt: 0, ...extra,
});

describe("tradeStats", () => {
  it("computes win rate, expectancy, drawdown and streaks", () => {
    const s = tradeStats([mk("2026-10-01", 3), mk("2026-10-02", -1), mk("2026-10-03", -1), mk("2026-10-04", 5), mk("2026-10-05", -1)]);
    expect(s.n).toBe(5);
    expect(s.winRate).toBeCloseTo(0.4);
    expect(s.totalR).toBe(5);
    expect(s.expectancy).toBe(1);
    expect(s.maxDrawdownR).toBe(2);
    expect(s.longestLossStreak).toBe(2);
    expect(s.currentLossStreak).toBe(1);
    expect(s.profitFactor).toBeCloseTo(8 / 3, 2);
    expect(s.equity.map((p) => p.cum)).toEqual([3, 2, 1, 6, 5]);
  });
  it("handles an empty journal", () => {
    const s = tradeStats([]);
    expect(s.n).toBe(0); expect(s.expectancy).toBe(0); expect(s.profitFactor).toBeNull();
  });
  it("groups multi-valued keys", () => {
    const g = groupBy([mk("2026-10-01", 2, { mistakes: ["Chased price"] }), mk("2026-10-02", -1, { mistakes: ["Chased price", "Oversized"] })], (t) => t.mistakes);
    expect(g.find((x) => x.key === "Chased price")?.totalR).toBe(1);
    expect(g.find((x) => x.key === "Oversized")?.n).toBe(1);
  });
});

describe("tiltAdvice (ICT halving rule)", () => {
  it("halves after one loss and stops after three", () => {
    expect(tiltAdvice([mk("2026-10-01", 2), mk("2026-10-02", -1)], "2026-10-09", 2).riskFactor).toBe(0.5);
    expect(tiltAdvice([mk("2026-10-01", -1), mk("2026-10-02", -1), mk("2026-10-03", -1)], "2026-10-09", 2).level).toBe("stop");
  });
  it("stops at the daily loss limit", () => {
    expect(tiltAdvice([mk("2026-10-08", 1), mk("2026-10-08", -1.5), mk("2026-10-08", -1.5)], "2026-10-08", 2).level).toBe("stop");
  });
});

describe("IPDA trading-day maths", () => {
  it("skips weekends", () => {
    expect(addTradingDays("2026-10-09", 1)).toBe("2026-10-12"); // Fri -> Mon
    expect(addTradingDays("2026-10-12", -1)).toBe("2026-10-09");
    expect(addTradingDays("2026-10-01", 20)).toBe("2026-10-29");
    expect(tradingDaysBetween("2026-10-01", "2026-10-29")).toBe(20);
  });
  it("anchors on the first trading day of the last completed month", () => {
    expect(ipdaAnchor("2026-10-08")).toBe("2026-09-01");
    expect(ipdaAnchor("2026-12-15")).toBe("2026-11-02"); // Nov 1 2026 is a Sunday
    expect(ipdaRanges("2026-09-01").map((r) => r.days)).toEqual([20, 40, 60]);
  });
});

describe("frontmatter & R calculation", () => {
  it("parses lesson frontmatter", () => {
    const { data, body } = parseFrontmatter("---\nid: x-1\ntitle: Order blocks: basics\norder: 3\n---\n\n- point\n");
    expect(data).toEqual({ id: "x-1", title: "Order blocks: basics", order: "3" });
    expect(body).toBe("- point\n");
  });
  it("computes R from prices for longs and shorts", () => {
    expect(calcR({ direction: "Long", entry: 1.1430, stop: 1.1414, exit: 1.1478 })).toBe(3);
    expect(calcR({ direction: "Short", entry: 1.3220, stop: 1.3275, exit: 1.3275 })).toBe(-1);
    expect(calcR({ direction: "Long", entry: 1, stop: 1, exit: 2 })).toBeNull();
  });
});
