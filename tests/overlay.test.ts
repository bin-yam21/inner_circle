import { describe, expect, it } from "vitest";
import { analyze } from "../src/lib/detect";
import { makeExercise } from "../src/lib/exercises";
import { analysisOverlay, exerciseOverlay, LAYERS } from "../src/lib/overlay";
import { rng, syntheticCandles } from "../src/lib/replay";

const c = syntheticCandles(2000, 3);

describe("overlays", () => {
  it("draws only structures that exist by the current candle", () => {
    const end = 1500, ov = analysisOverlay(analyze(c, end, 150), end - 90, new Set(LAYERS.map(([k]) => k)));
    const starts = [...ov.zones!.map((z) => z.from), ...ov.levels!.map((l) => l.from), ...ov.marks!.map((m) => m.index), ...ov.bands!.map((b) => b.index)];
    expect(starts.length).toBeGreaterThan(3);
    expect(Math.max(...starts)).toBeLessThanOrEqual(end);
    expect(Math.min(...starts.filter((s) => !ov.zones!.some((z) => z.cls === "premium" && z.from === s)))).toBeGreaterThanOrEqual(end - 91);
  });
  it("respects the chosen layers", () => {
    const ov = analysisOverlay(analyze(c, 1500, 150), 1400, new Set(["liquidity"]));
    expect(ov.zones).toEqual([]);
    expect(ov.levels!.every((l) => l.cls.startsWith("liq-"))).toBe(true);
  });
  it("highlights the exercise targets and the click", () => {
    const ex = makeExercise(c, "fvg-bear", rng(9))!;
    const ov = exerciseOverlay(ex, c, { index: ex.end, price: c[ex.end].c });
    expect(ov.zones!.length).toBeGreaterThan(0);
    expect(ov.zones!.every((z) => z.cls.includes("fvg-bear target"))).toBe(true);
    expect(ov.marks!.at(-1)!.cls).toBe("click");
  });
});
