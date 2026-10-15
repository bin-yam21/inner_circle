import { describe, expect, it } from "vitest";
import { aPlusSetups, alignment, byAlignment, byChecklist, byHour, cellOf, combos, heatmap, logsByDate, matchesAPlus, MIN_SAMPLE, nyHour, rDistribution } from "../src/lib/edge";
import type { DailyLog, Trade } from "../src/lib/types";

let id = 0;
const mk = (date: string, r: number, extra: Partial<Trade> = {}): Trade => ({
  id: String(id++), date, time: "08:30", market: "EUR/USD", direction: "Long", setup: "Order block", timeframe: "15m", session: "New York open",
  r, emotionsBefore: [], emotionsAfter: [], mistakes: [], notes: "", account: "Demo", createdAt: 0, updatedAt: 0, ...extra,
});
const log = (date: string, biasDir: DailyLog["biasDir"]): DailyLog => ({ date, markets: "", bias: "", waitingFor: "", dailyHigh: "", dailyHighTime: "", dailyLow: "", dailyLowTime: "", notes: "", processGrade: "", missed: "", updatedAt: 0, biasDir });

describe("cellOf", () => {
  it("computes expectancy with a 95% confidence half-width and only confirms large positive samples", () => {
    const c = cellOf("x", [2, -1, 2, -1].map((r) => mk("2026-10-05", r)));
    expect(c).toMatchObject({ n: 4, expectancy: 0.5, winRate: 0.5, totalR: 2, confirmed: false });
    expect(c.ci).toBeCloseTo(1.96 * Math.sqrt(3) / 2, 2);
    const strong = cellOf("y", Array.from({ length: MIN_SAMPLE }, (_, i) => mk("2026-10-05", i % 4 ? 2 : -1)));
    expect(strong.confirmed).toBe(true);
    expect(cellOf("z", [mk("2026-10-05", 3)]).ci).toBe(Infinity);
    expect(cellOf("z2", [mk("2026-10-05", 2), mk("2026-10-05", 2)]).ci).toBe(Infinity); // not ±0
  });
});

describe("time and distribution", () => {
  it("groups by New York hour and weekday × session", () => {
    const ts = [mk("2026-10-05", 1, { time: "03:15", session: "London open" }), mk("2026-10-05", -1, { time: "08:45" }), mk("2026-10-06", 2, { time: "08:05" })];
    expect(nyHour(ts[0])).toBe(3);
    const h = byHour(ts);
    expect(h[8]).toMatchObject({ n: 2, expectancy: 0.5 });
    expect(h[12]).toBeNull();
    const hm = heatmap(ts);
    expect(hm.cols).toEqual(["London open", "New York open"]);
    expect(hm.cells[0][0]).toMatchObject({ n: 1, expectancy: 1 }); // Monday, London open
    expect(hm.cells[1][1]).toMatchObject({ n: 1, expectancy: 2 }); // Tuesday, NY open
    expect(hm.cells[2][0]).toBeNull();
  });
  it("buckets R multiples", () => {
    const d = rDistribution([-1, -0.5, 0, 0.5, 1.5, 2, 4].map((r) => mk("2026-10-05", r)));
    expect(d.map((b) => b.n)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});

describe("bias alignment and combos", () => {
  const logs = [log("2026-10-05", "Bullish"), log("2026-10-06", "Bearish"), log("2026-10-07", "Range")];
  it("classifies trades against the day's bias", () => {
    const m = logsByDate(logs);
    expect(alignment(mk("2026-10-05", 1), m)).toBe("With my bias");
    expect(alignment(mk("2026-10-06", 1), m)).toBe("Against my bias");
    expect(alignment(mk("2026-10-06", 1, { direction: "Short" }), m)).toBe("With my bias");
    expect(alignment(mk("2026-10-07", 1), m)).toBe("No bias call");
    expect(alignment(mk("2026-10-09", 1), m)).toBe("No bias call");
    expect(byAlignment([mk("2026-10-05", 2), mk("2026-10-06", -1)], logs).map((c) => c.key)).toEqual(["With my bias", "Against my bias"]);
  });
  it("finds A+ setups and flags trades outside them", () => {
    const good = Array.from({ length: 10 }, (_, i) => mk("2026-10-05", i % 5 ? 2 : -1));
    const bad = Array.from({ length: 10 }, () => mk("2026-10-05", -1, { setup: "Breaker" }));
    const all = combos([...good, ...bad], logs);
    expect(all[0]).toMatchObject({ setup: "Order block", session: "New York open", align: "With my bias", n: 10 });
    const aplus = aPlusSetups(all);
    expect(aplus).toHaveLength(1);
    const m = logsByDate(logs);
    expect(matchesAPlus(good[0], aplus, m)).toBe(true);
    expect(matchesAPlus(bad[0], aplus, m)).toBe(false);
    expect(matchesAPlus(mk("2026-10-06", 1), aplus, m)).toBe(false); // same setup, but against the bias
  });
  it("orders checklist buckets", () => {
    const c = byChecklist([mk("2026-10-05", 1, { checklist: 9 }), mk("2026-10-05", -1, { checklist: 5 }), mk("2026-10-05", 0)]);
    expect(c.map((x) => x.key)).toEqual(["8–10", "0–5", "Not scored"]);
  });
});
