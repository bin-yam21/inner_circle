import { describe, expect, it } from "vitest";
import { analyze } from "../src/lib/detect";
import { syntheticCandles } from "../src/lib/replay";
import { findScenarios, LEAD, SCENARIO_KINDS, TAIL } from "../src/lib/scenarios";

const c = syntheticCandles(3000, 33);
const found = findScenarios(c);

describe("targeted drill scenarios", () => {
  it("finds every scenario type in practice data, within the playable range", () => {
    for (const k of SCENARIO_KINDS) {
      expect(found[k].length, k).toBeGreaterThan(0);
      for (const s of found[k]) { expect(s).toBeGreaterThanOrEqual(LEAD); expect(s).toBeLessThanOrEqual(c.length - 1 - TAIL); }
    }
  });
  it("never uses candles after the start: the same moments are found when later candles don't exist yet", () => {
    for (const cut of [700, 1300, 2000, 2600]) {
      const early = findScenarios(c.slice(0, cut));
      for (const k of SCENARIO_KINDS) {
        const playable = (s: number) => s <= cut - 1 - TAIL;
        expect(early[k].filter(playable), `${k} at cut ${cut}`).toEqual(found[k].filter(playable));
      }
    }
  });
  it("the triggering structure is already visible on the candle before the start", () => {
    for (const s of found["fvg-bull"].slice(0, 5)) expect(analyze(c, s - 1, 50).gaps.some((g) => g.kind === "bull" && g.index === s - 2)).toBe(true);
    for (const s of found["eq-lows"].slice(0, 5)) expect(analyze(c, s - 1, 150).pools.some((p) => p.kind === "SSL" && p.equal && p.indices[1] === s - 3 && p.sweptAt == null)).toBe(true);
  });
  it("returns empty lists for short data", () => {
    expect(Object.values(findScenarios(c.slice(0, 100))).every((l) => l.length === 0)).toBe(true);
  });
});
