import { describe, expect, it } from "vitest";
import { actualDirection, parseCandlesCsv, parseTime, simulate, syntheticCandles, validateOrder, type Order } from "../src/lib/replay";
import type { Candle } from "../src/lib/types";

describe("CSV import", () => {
  it("reads a TradingView export (unix seconds, header)", () => {
    const r = parseCandlesCsv("time,open,high,low,close,Volume\n1760000000,1.1,1.2,1.0,1.15,5\n1760000900,1.15,1.16,1.14,1.15,3\n");
    expect(r.candles).toHaveLength(2);
    expect(r.candles[0]).toEqual({ t: 1760000000000, o: 1.1, h: 1.2, l: 1, c: 1.15 });
  });
  it("reads MT4 history without a header", () => {
    const r = parseCandlesCsv("2026.10.01,00:00,1.1010,1.1020,1.1000,1.1015,123\r\n2026.10.01,00:15,1.1015,1.1030,1.1010,1.1025,99");
    expect(r.candles.map((c) => c.t)).toEqual([Date.UTC(2026, 9, 1, 0, 0), Date.UTC(2026, 9, 1, 0, 15)]);
  });
  it("reads MT5 tab-separated bars with <DATE> <TIME> headers", () => {
    const r = parseCandlesCsv("<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\n2026.10.01\t01:00:00\t150.10\t150.30\t150.00\t150.20\t10");
    expect(r.candles[0]).toEqual({ t: Date.UTC(2026, 9, 1, 1, 0), o: 150.1, h: 150.3, l: 150, c: 150.2 });
  });
  it("skips broken rows, sorts and removes duplicates", () => {
    const r = parseCandlesCsv("Date;Open;High;Low;Close\n2026-10-02;1;2;0.5;1.5\n2026-10-01;1;2;0.5;1.5\nbad;x;y;z;w\n2026-10-03;1;0.5;0.4;1\n2026-10-01;1;2;0.5;1.5");
    expect(r.candles.map((c) => c.t)).toEqual([Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 2)]);
    expect(r.skipped).toBe(3);
  });
  it("parses common time formats", () => {
    expect(parseTime("2026-10-01T12:30:00Z")).toBe(Date.UTC(2026, 9, 1, 12, 30));
    expect(parseTime("20261001 123000")).toBe(Date.UTC(2026, 9, 1, 12, 30));
    expect(parseTime("1760000000000")).toBe(1760000000000);
    expect(parseTime("nonsense")).toBeNull();
  });
});

describe("synthetic data", () => {
  it("is valid OHLC, reproducible and skips weekends", () => {
    const a = syntheticCandles(500, 42), b = syntheticCandles(500, 42);
    expect(a).toEqual(b);
    for (const k of a) { expect(k.h).toBeGreaterThanOrEqual(Math.max(k.o, k.c)); expect(k.l).toBeLessThanOrEqual(Math.min(k.o, k.c)); }
    expect(a.some((k) => new Date(k.t).getUTCDay() === 6)).toBe(false);
  });
});

const c = (o: number, h: number, l: number, cl: number, i: number): Candle => ({ t: i, o, h, l, c: cl });

describe("order simulation", () => {
  const candles = [c(10, 10.5, 9.5, 10, 0), c(10, 10.2, 9.0, 9.2, 1), c(9.2, 9.6, 8.9, 9.5, 2), c(9.5, 11.2, 9.4, 11, 3), c(11, 11.5, 10.8, 11.2, 4)];
  const long: Order = { direction: "Long", entry: 9.2, stop: 8.7, target: 11.0, placedIndex: 0, market: false };

  it("waits for the fill, then hits the target", () => {
    expect(simulate(long, candles, 0).status).toBe("pending");
    expect(simulate(long, candles, 1)).toMatchObject({ status: "open", fillIndex: 1 });
    expect(simulate(long, candles, 4)).toEqual({ status: "win", fillIndex: 1, exitIndex: 3, r: 3.6 });
  });
  it("stops out at −1R", () => {
    expect(simulate({ ...long, stop: 8.95 }, candles, 4)).toMatchObject({ status: "loss", r: -1, exitIndex: 2 });
  });
  it("assumes the stop when one candle hits both", () => {
    const wide = [c(10, 10, 10, 10, 0), c(10, 12, 8, 10, 1)];
    expect(simulate({ direction: "Long", entry: 10, stop: 9, target: 11, placedIndex: 0, market: true }, wide, 1).status).toBe("loss");
  });
  it("handles shorts and market fills", () => {
    const s = simulate({ direction: "Short", entry: 10, stop: 10.6, target: 9.1, placedIndex: 0, market: true }, candles, 1);
    expect(s).toMatchObject({ status: "win", r: 1.5 });
  });
  it("validates order geometry", () => {
    expect(validateOrder({ direction: "Long", entry: 10, stop: 11, target: 12 })).toMatch(/below/);
    expect(validateOrder({ direction: "Short", entry: 10, stop: 11, target: 9 })).toBeNull();
  });
});

describe("actual direction", () => {
  it("calls small moves a range", () => {
    const flat = Array.from({ length: 30 }, (_, i) => c(10, 10.1, 9.9, 10 + (i % 2) * 0.01, i));
    expect(actualDirection(flat, 15, 29)).toBe("Range");
    const up = Array.from({ length: 30 }, (_, i) => c(10 + i * 0.1, 10.15 + i * 0.1, 9.95 + i * 0.1, 10.1 + i * 0.1, i));
    expect(actualDirection(up, 15, 29)).toBe("Bullish");
  });
});
