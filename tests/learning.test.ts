import { describe, expect, it } from "vitest";
import { addDays, biasStats, cardQueue, conceptMastery, missingDetails, monthlyTrends, conceptsOfTrade, executionStats, goLiveGates, isDue, prescriptions, scheduleReview } from "../src/lib/learning";
import type { DailyLog, LessonProgress, QuizAnswer, QuizQuestion, Trade } from "../src/lib/types";

const mk = (date: string, r: number, extra: Partial<Trade> = {}): Trade => ({
  id: date + r + Math.random(), date, market: "EUR/USD", direction: "Long", setup: "Order block", timeframe: "15m", session: "London open",
  r, emotionsBefore: [], emotionsAfter: [], mistakes: [], notes: "", account: "Demo", createdAt: 0, updatedAt: 0, ...extra,
});
const log = (date: string, biasDir: DailyLog["biasDir"], actualDir: DailyLog["actualDir"], extra: Partial<DailyLog> = {}): DailyLog => ({
  date, markets: "EUR/USD", bias: "", waitingFor: "", dailyHigh: "", dailyHighTime: "", dailyLow: "", dailyLowTime: "",
  notes: "", processGrade: "", missed: "", updatedAt: 0, biasDir, actualDir, ...extra,
});

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("spaced repetition", () => {
  it("resets a miss to tomorrow and grows intervals on correct answers", () => {
    expect(scheduleReview(undefined, false, "2026-10-15")).toEqual({ box: 0, due: "2026-10-16" });
    expect(scheduleReview(undefined, true, "2026-10-15")).toEqual({ box: 2, due: "2026-10-18" });
    expect(scheduleReview({ box: 0, correct: false }, true, "2026-10-15")).toEqual({ box: 1, due: "2026-10-16" });
    expect(scheduleReview({ box: 2, correct: true }, true, "2026-10-15")).toEqual({ box: 3, due: "2026-10-22" });
    expect(scheduleReview({ box: 6, correct: true }, true, "2026-10-15").box).toBe(6);
  });
  it("treats old missed answers without a schedule as due", () => {
    const a = (x: Partial<QuizAnswer>): QuizAnswer => ({ key: "k", courseId: "c", index: 0, correct: true, wrongCount: 0, at: 0, ...x });
    expect(isDue(a({ correct: false }), "2026-10-15")).toBe(true);
    expect(isDue(a({ correct: true }), "2026-10-15")).toBe(false);
    expect(isDue(a({ due: "2026-10-15" }), "2026-10-15")).toBe(true);
    expect(isDue(a({ due: "2026-10-16" }), "2026-10-15")).toBe(false);
  });
});

describe("bias scorecard", () => {
  it("scores only days with both directions and tracks streaks", () => {
    const s = biasStats([
      log("2026-10-05", "Bullish", "Bullish"), log("2026-10-06", "Bullish", "Bearish"),
      log("2026-10-07", "Bearish", "Bearish", { levelHit: "yes" }), log("2026-10-08", "Range", "Range", { markets: "gbp/usd, dxy", levelHit: "no" }),
      log("2026-10-09", "Bullish", ""),
    ]);
    expect(s.scored).toBe(4);
    expect(s.hitRate).toBe(0.75);
    expect(s.streak).toBe(2);
    expect(s.levelHitRate).toBe(0.5);
    expect(s.byMarket.map((g) => g.key).sort()).toEqual(["EUR/USD", "GBP/USD"]);
  });
});

describe("concepts", () => {
  it("adds concepts implied by the setup to tagged ones", () => {
    expect(conceptsOfTrade({ setup: "Breaker", concepts: ["time"] }).sort()).toEqual(["order-blocks", "time"]);
    expect(conceptsOfTrade({ setup: "Other" })).toEqual([]);
  });
  it("flags a leak when a concept loses money over 5+ trades", () => {
    const trades = [1, -1, -1, -1, -1].map((r, i) => mk(`2026-10-0${i + 1}`, r, { setup: "FVG / void fill" }));
    const m = conceptMastery([], [], [], trades).find((x) => x.concept.id === "fvg")!;
    expect(m.trades).toBe(5);
    expect(m.status).toBe("Leak");
  });
  it("blends lessons and quiz accuracy into knowledge", () => {
    const progress: LessonProgress[] = ["ict-33", "ict-35", "ict-31"].map((id) => ({ key: `ict-mentorship-2016:${id}`, courseId: "ict-mentorship-2016", lessonId: id, done: true, notes: "", updatedAt: 0 }));
    const qs: QuizQuestion[] = [0, 1].map((index) => ({ courseId: "ict-mentorship-2016", index, lesson: "ict-33", q: "", options: [], answer: 0, explain: "" }));
    const answers: QuizAnswer[] = [{ key: "ict-mentorship-2016:0", courseId: "ict-mentorship-2016", index: 0, correct: true, wrongCount: 0, at: 0 }, { key: "ict-mentorship-2016:1", courseId: "ict-mentorship-2016", index: 1, correct: false, wrongCount: 1, at: 0 }];
    const m = conceptMastery(progress, answers, qs, []).find((x) => x.concept.id === "fvg")!;
    expect(m.quizAccuracy).toBe(0.5);
    expect(m.knowledge).toBe(0.75);
    expect(m.status).toBe("Understood");
  });
});

describe("prescriptions", () => {
  it("returns repeated recent mistakes, most frequent first", () => {
    const trades = [
      mk("2026-10-10", -1, { mistakes: ["Chased price"] }), mk("2026-10-11", -1, { mistakes: ["Chased price", "Moved stop"] }),
      mk("2026-10-12", 2, { mistakes: ["None"] }), mk("2026-10-13", -1, { mistakes: ["Moved stop"] }), mk("2026-10-14", -1, { mistakes: ["Chased price"] }),
      mk("2026-08-01", -1, { mistakes: ["Revenge trade"] }), mk("2026-08-02", -1, { mistakes: ["Revenge trade"] }),
    ];
    const p = prescriptions(trades, "2026-10-15");
    expect(p.map((x) => x.mistake)).toEqual(["Chased price", "Moved stop"]);
    expect(p[0].count).toBe(3);
    expect(p[0].fix.lessons.length).toBeGreaterThan(0);
  });
});

describe("execution stats", () => {
  it("compares followed vs broken plan and measures excursions", () => {
    const e = executionStats([
      mk("2026-10-01", 2, { followedPlan: true, mfe: 3, mae: 0.2 }), mk("2026-10-02", -1, { followedPlan: false, mfe: 1.5, mae: 1 }),
      mk("2026-10-03", 1, { followedPlan: true, mfe: 1, mae: 0.4 }), mk("2026-10-04", -1),
    ]);
    expect(e.recorded).toBe(3);
    expect(e.adherence).toBeCloseTo(2 / 3);
    expect(e.followed?.expectancy).toBe(1.5);
    expect(e.broken?.expectancy).toBe(-1);
    expect(e.leftOnTable).toBe(0.5);
    expect(e.losersThatWereUp).toBe(1);
    expect(e.winnerHeat).toBe(0.3);
  });
});

describe("go-live gates", () => {
  it("are all unmet on an empty account and the volume gate tracks demo trades only", () => {
    expect(goLiveGates([], [], [], []).every((g) => !g.met)).toBe(true);
    const trades = Array.from({ length: 30 }, (_, i) => mk(`2026-09-${String(i + 1).padStart(2, "0")}`, i % 2 ? 2 : -1, { followedPlan: true }));
    const g = goLiveGates([...trades, mk("2026-10-01", 5, { account: "Live" })], [], [], []);
    expect(g.find((x) => x.id === "volume")?.met).toBe(true);
    expect(g.find((x) => x.id === "expectancy")?.met).toBe(true);
    expect(g.find((x) => x.id === "plan")?.met).toBe(true);
    expect(g.find((x) => x.id === "bias")?.met).toBe(false);
  });
});

describe("go-live gate progress", () => {
  it("doesn't look complete on a tiny sample", () => {
    const g = goLiveGates([mk("2026-10-01", 3), mk("2026-10-02", 2), mk("2026-10-03", 1)], [], [], []);
    expect(g.find((x) => x.id === "expectancy")!.progress).toBeCloseTo(0.3);
  });
});

describe("replay drills in mastery and gates", () => {
  const drill = (r: number, setup = "FVG / void fill", outcome: "win" | "loss" | "no-trade" = r > 0 ? "win" : "loss") =>
    ({ id: String(Math.random()), datasetId: "d", datasetName: "d", market: "X", timeframe: "15m", startIndex: 0, endIndex: 10, startTime: 0, bias: "Bullish" as const, biasCorrect: true, outcome, r, setup, notes: "", at: 0 });
  it("counts traded drills toward the setup's concept", () => {
    const m = conceptMastery([], [], [], [], [drill(2), drill(-1), drill(2), drill(0, "FVG / void fill", "no-trade")]).find((x) => x.concept.id === "fvg")!;
    expect(m.drills).toBe(3);
    expect(m.drillExpectancy).toBe(1);
    expect(m.status).toBe("Practising");
  });
  it("adds a practice gate met by 20 profitable drills", () => {
    const g = (ds: ReturnType<typeof drill>[]) => goLiveGates([], [], [], [], ds).find((x) => x.id === "practice")!;
    expect(g([]).met).toBe(false);
    expect(g(Array.from({ length: 20 }, (_, i) => drill(i % 2 ? 2 : -1))).met).toBe(true);
    expect(g(Array.from({ length: 20 }, () => drill(-1))).met).toBe(false);
  });
});

describe("flashcard queue", () => {
  it("puts due cards first (most overdue first), then a limited number of new ones", () => {
    const q = cardQueue(["a", "b", "c", "d", "e"], [{ key: "b", due: "2026-10-14" }, { key: "c", due: "2026-10-10" }, { key: "d", due: "2026-10-20" }], "2026-10-15", 1);
    expect(q).toEqual(["c", "b", "a"]);
  });
});

describe("monthly trends", () => {
  it("groups by month, newest first, with null rates when nothing was measured", () => {
    const rows = monthlyTrends({
      trades: [mk("2026-09-10", 2, { followedPlan: true }), mk("2026-09-11", -1, { followedPlan: false }), mk("2026-10-02", 1)],
      logs: [log("2026-10-01", "Bullish", "Bullish"), log("2026-10-02", "Bearish", "Bullish")],
      drills: [], rules: [{ id: "r1", text: "x", category: "Risk", active: true, order: 0 }],
      checks: [{ date: "2026-09-05", followed: { r1: true } }, { date: "2026-09-06", followed: {} }],
      activity: [{ date: "2026-08-30" }, { date: "2026-10-01" }],
    });
    expect(rows.map((r) => r.month)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(rows[0]).toMatchObject({ trades: 1, expectancy: 1, planAdherence: null, biasDays: 2, biasHitRate: 0.5, ruleAdherence: null, studyDays: 1 });
    expect(rows[1]).toMatchObject({ trades: 2, expectancy: 0.5, planAdherence: 0.5, biasHitRate: null, ruleAdherence: 0.5 });
    expect(rows[2]).toMatchObject({ trades: 0, expectancy: null, studyDays: 1 });
  });
});

describe("chart eye in mastery", () => {
  it("blends chart drill accuracy into knowledge for the matching concept", () => {
    const spots = [true, true, false, true].map((correct, i) => ({ kind: "fvg-bull", correct, at: i }));
    const m = conceptMastery([], [], [], [], [], spots).find((x) => x.concept.id === "fvg")!;
    expect(m.chartAnswered).toBe(4);
    expect(m.chartAccuracy).toBe(0.75);
    expect(m.knowledge).toBe(0.38); // lessons 0 × 0.5 + chart 0.75 × 0.5
    expect(conceptMastery([], [], [], [], [], spots).find((x) => x.concept.id === "liquidity")!.chartAccuracy).toBeNull();
  });
});

describe("missingDetails", () => {
  it("lists what a trade still needs, and nothing once complete", () => {
    expect(missingDetails({ followedPlan: null, emotionsBefore: [], mistakes: [], time: "" })).toEqual(["plan followed?", "emotions", "mistakes (or None)", "time"]);
    expect(missingDetails({ followedPlan: false, emotionsBefore: ["Calm"], mistakes: ["None"], time: "08:30" })).toEqual([]);
  });
});
