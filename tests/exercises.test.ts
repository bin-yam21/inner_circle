import { describe, expect, it } from "vitest";
import { EXERCISE_KINDS, exerciseStats, grade, makeExercise, targets, type Exercise } from "../src/lib/exercises";
import { rng, syntheticCandles } from "../src/lib/replay";

const candles = syntheticCandles(3000, 21);

/** A click right on the first target of an exercise. */
function hit(ex: Exercise) {
  const t = targets(ex, candles);
  if (t.gaps?.length) { const g = t.gaps[0]; return { index: g.index + 1, price: (g.top + g.bottom) / 2 }; }
  if (t.pools?.length) { const p = t.pools[0]; return { index: ex.end, price: p.price }; }
  if (t.obs?.length) { const o = t.obs[0]; return { index: o.index, price: (o.high + o.low) / 2 }; }
  if (t.sweeps?.length) { const s = t.sweeps[0]; return { index: s.index, price: candles[s.index].h }; }
  throw new Error("no target");
}

describe("chart exercises", () => {
  for (const kind of EXERCISE_KINDS) {
    it(`${kind}: can be generated from practice data and graded`, () => {
      const rand = rng(kind.length * 97);
      for (let n = 0; n < 5; n++) {
        const ex = makeExercise(candles, kind, rand);
        expect(ex, `no ${kind} exercise found`).not.toBeNull();
        if (kind === "pd") {
          expect(grade(ex!, candles, { zone: ex!.answer! }).correct).toBe(true);
          const wrong = ex!.answer === "premium" ? "discount" : "premium";
          expect(grade(ex!, candles, { zone: wrong }).correct).toBe(false);
        } else {
          expect(grade(ex!, candles, hit(ex!)).correct).toBe(true);
          // Far outside the visible range: always wrong.
          expect(grade(ex!, candles, { index: ex!.end - 200, price: candles[ex!.end].c * 2 }).correct).toBe(false);
        }
      }
    });
  }
  it("returns null when there isn't enough data", () => {
    expect(makeExercise(candles.slice(0, 100), "fvg-bull")).toBeNull();
  });
  it("never needs candles after the exercise point", () => {
    const ex = makeExercise(candles, "sweep", rng(5))!;
    const cut = candles.slice(0, ex.end + 1);
    const again = { ...ex, analysis: ex.analysis };
    expect(grade(again, cut, hit(ex)).correct).toBe(true);
  });
});

describe("exercise stats", () => {
  it("uses recent answers per kind and names the weakest", () => {
    const answers = [
      ...[true, true, true, false].map((correct, i) => ({ kind: "fvg-bull", correct, at: i })),
      ...[false, false, true].map((correct, i) => ({ kind: "bsl", correct, at: i })),
      { kind: "pd", correct: false, at: 1 },
    ];
    const s = exerciseStats(answers);
    expect(s.by.get("fvg-bull")).toEqual({ total: 4, right: 3 });
    expect(s.weakest).toBe("bsl");
  });
});
