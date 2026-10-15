import { describe, expect, it } from "vitest";
import { analyze, dealingRange, fvgs, isDisplacement, liquidityPools, orderBlocks, sweeps, swings, zoneOf } from "../src/lib/detect";
import { syntheticCandles } from "../src/lib/replay";
import type { Candle } from "../src/lib/types";

/** Candle from open/high/low/close; time = index. */
const k = (o: number, h: number, l: number, c: number, t = 0): Candle => ({ t, o, h, l, c });
const series = (rows: [number, number, number, number][]) => rows.map(([o, h, l, c], i) => k(o, h, l, c, i));

describe("swings", () => {
  it("finds fractal highs and lows and needs confirming candles", () => {
    const c = series([[10, 11, 9, 10], [10, 12, 9.5, 11], [11, 15, 10, 14], [14, 13, 11, 12], [12, 12.5, 8, 9], [9, 10, 7, 8], [8, 9, 7.5, 8.5], [8.5, 9.5, 8, 9]]);
    const s = swings(c, 0, c.length - 1);
    expect(s).toContainEqual({ index: 2, price: 15, kind: "high" });
    expect(s).toContainEqual({ index: 5, price: 7, kind: "low" });
    // At end = 5 the low at 5 isn't confirmed yet (needs 2 candles after it).
    expect(swings(c, 0, 5).some((x) => x.index === 5)).toBe(false);
  });
});

describe("fair value gaps", () => {
  it("finds a bullish gap and tracks mitigation and fill", () => {
    const c = series([[10, 10.5, 9.8, 10.2], [10.2, 12, 10.1, 11.9], [11.9, 12.5, 11, 12.4], [12.4, 12.6, 10.8, 11], [11, 11.2, 10.3, 10.4]]);
    const [g] = fvgs(c, 0, c.length - 1, 0.1);
    expect(g).toMatchObject({ kind: "bull", index: 1, bottom: 10.5, top: 11, mitigatedAt: 3, filledAt: 4 });
  });
  it("finds a bearish gap and ignores gaps below the minimum size", () => {
    const c = series([[12, 12.2, 11.5, 11.6], [11.6, 11.7, 9.5, 9.6], [9.6, 10.5, 9, 9.2]]);
    expect(fvgs(c, 0, 2, 0.1)[0]).toMatchObject({ kind: "bear", top: 11.5, bottom: 10.5, mitigatedAt: null });
    expect(fvgs(c, 0, 2, 2)).toEqual([]); // 2 × ATR (0.7 here) is bigger than the 1.0 gap
  });
  it("never looks past `end`", () => {
    const c = series([[10, 10.5, 9.8, 10.2], [10.2, 12, 10.1, 11.9], [11.9, 12.5, 11, 12.4], [12.4, 12.6, 10.8, 11], [11, 11.2, 10.3, 10.4]]);
    expect(fvgs(c, 0, 3, 0.1)[0].filledAt).toBeNull();
  });
});

describe("liquidity", () => {
  // Two equal highs at ~15 (index 2 and 6), then a candle that wicks to 15.5 and closes at 14.
  const c = series([
    [12, 13, 11, 12.5], [12.5, 14, 12, 13.5], [13.5, 15, 13, 14], [14, 14.5, 12.5, 13], [13, 13.5, 12, 12.5],
    [12.5, 14.5, 12.4, 14.2], [14.2, 15.02, 13.8, 14.4], [14.4, 14.6, 13.2, 13.5], [13.5, 14, 12.8, 13.2], [13.2, 15.5, 13, 14],
  ]);
  it("groups equal highs into one buy-side pool and detects the sweep", () => {
    const sw = swings(c, 0, c.length - 1);
    const pools = liquidityPools(c, sw, c.length - 1, 0.1);
    const bsl = pools.find((p) => p.kind === "BSL" && p.equal)!;
    expect(bsl.indices).toEqual([2, 6]);
    expect(bsl.price).toBe(15.02);
    expect(bsl.sweptAt).toBe(9);
    expect(sweeps(c, pools)).toContainEqual({ index: 9, kind: "BSL", level: 15.02 });
  });
});

describe("order blocks and displacement", () => {
  it("marks the last down candle before a bullish displacement that left a gap", () => {
    const c = series([
      [10, 10.3, 9.7, 10], [10, 10.3, 9.7, 10.1], [10.1, 10.4, 9.8, 10], [10, 10.3, 9.7, 10.1], [10.1, 10.4, 9.8, 10],
      [10, 10.3, 9.7, 10.1], [10.1, 10.4, 9.8, 10], [10, 10.3, 9.7, 10.1], [10.1, 10.4, 9.8, 10], [10, 10.3, 9.7, 10.1],
      [10.1, 10.4, 9.8, 10], [10, 10.3, 9.7, 10.1], [10.1, 10.4, 9.8, 10], [10, 10.3, 9.7, 10.1], [10.1, 10.2, 9.6, 9.7],
      [9.7, 11.6, 9.65, 11.5], [11.5, 12, 11.2, 11.9], [11.9, 12.1, 10.1, 10.3],
    ]);
    expect(isDisplacement(c[15], 0.6)).toBe(true);
    const gaps = fvgs(c, 0, c.length - 1, 0.1);
    const obs = orderBlocks(c, gaps, c.length - 1);
    expect(obs[0]).toMatchObject({ kind: "bull", index: 14, high: 10.2, low: 9.6, displacementAt: 15, mitigatedAt: 17 });
  });
});

describe("dealing range", () => {
  it("splits premium, discount and equilibrium around the 50% level", () => {
    const r = dealingRange([{ index: 5, price: 20, kind: "high" }, { index: 10, price: 10, kind: "low" }], 20)!;
    expect(r.eq).toBe(15);
    expect([zoneOf(r, 18), zoneOf(r, 12), zoneOf(r, 15.2)]).toEqual(["premium", "discount", "equilibrium"]);
    expect(dealingRange([{ index: 5, price: 20, kind: "high" }], 20)).toBeNull();
  });
});

describe("analyze", () => {
  it("finds every structure type in practice data, without looking ahead", () => {
    const c = syntheticCandles(1500, 11);
    const a = analyze(c, 1200, 600);
    expect(a.swings.length).toBeGreaterThan(20);
    expect(a.gaps.length).toBeGreaterThan(5);
    expect(a.pools.some((p) => p.equal)).toBe(true);
    expect(a.range).not.toBeNull();
    const all = [...a.swings.map((s) => s.index + 2), ...a.gaps.map((g) => g.index + 1), ...a.gaps.flatMap((g) => [g.mitigatedAt ?? 0, g.filledAt ?? 0]), ...a.sweeps.map((s) => s.index)];
    expect(Math.max(...all)).toBeLessThanOrEqual(1200);
  });
});

describe("obvious liquidity only", () => {
  it("doesn't count a minor swing run a few candles later as a sweep", () => {
    // Swing high at index 2 (single, not equal), wicked through at index 5 and closed back below.
    const c = series([[10, 10.5, 9.5, 10.2], [10.2, 10.8, 10, 10.6], [10.6, 11, 10.4, 10.5], [10.5, 10.7, 10.1, 10.3], [10.3, 10.6, 10, 10.4], [10.4, 11.3, 10.3, 10.5], [10.5, 10.6, 10, 10.2]]);
    const pools = liquidityPools(c, swings(c, 0, 6), 6, 0.01);
    expect(pools.find((p) => p.kind === "BSL")!.sweptAt).toBe(5);
    expect(sweeps(c, pools)).toEqual([]);
  });
});
