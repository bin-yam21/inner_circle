import { describe, expect, it } from "vitest";
import { conceptMastery } from "../src/lib/learning";
import { buildStudyPlan, CHART_TARGET, pickFocus } from "../src/lib/studyPlan";
import type { LessonProgress, Trade } from "../src/lib/types";

const mk = (r: number, setup: string): Trade => ({ id: String(Math.random()), date: "2026-10-05", market: "X", direction: "Long", setup, timeframe: "15m", session: "London open", r, emotionsBefore: [], emotionsAfter: [], mistakes: [], notes: "", account: "Demo", createdAt: 0, updatedAt: 0 });
const done = (ids: string[]): LessonProgress[] => ids.map((id) => ({ key: `c:${id}`, courseId: "c", lessonId: id, done: true, notes: "", updatedAt: 0 }));

describe("pickFocus", () => {
  it("prefers a leak", () => {
    const mastery = conceptMastery([], [], [], [mk(-1, "Breaker"), mk(-1, "Breaker"), mk(-1, "Breaker"), mk(1, "Breaker"), mk(-1, "Breaker")]);
    const f = pickFocus(mastery);
    expect(f.id).toBe("order-blocks");
    expect(f.reason).toMatch(/losing money/);
  });
  it("otherwise picks the weakest concept that still has lessons to do", () => {
    // Every concept at zero except liquidity and fvg, which have lessons done.
    const mastery = conceptMastery(done(["ict-07", "ict-33", "ict-35", "ict-31"]), [], [], []);
    const f = pickFocus(mastery);
    expect(["liquidity", "fvg"]).not.toContain(f.id);
    expect(f.reason).toMatch(/weakest/);
  });
});

describe("buildStudyPlan", () => {
  const mastery = conceptMastery([], [], [], []);
  const base = { focus: { id: "fvg", reason: "r" }, mastery, lessonsDone: new Set<string>(), lessonsDoneToday: new Set<string>(), dueQuiz: 3, dueCards: 0, chartToday: [], drillsToday: [] };
  it("builds five tasks around the focus concept", () => {
    const p = buildStudyPlan(base);
    expect(p.focusName).toBe("Fair value gaps & voids");
    expect(p.tasks.map((t) => t.id)).toEqual(["lesson", "review", "cards", "chart", "replay"]);
    expect(p.tasks[0]).toMatchObject({ title: "Lesson: ICT Fair Value Gaps", done: false, link: "/courses/ict-mentorship-2016/ict-33" });
    expect(p.tasks[1]).toMatchObject({ done: false });
    expect(p.tasks[2]).toMatchObject({ done: true, detail: "Nothing due today." });
    expect(p.tasks[3]).toMatchObject({ link: "/chart-drills?kind=fvg-bull", progress: [0, CHART_TARGET] });
    expect(p.tasks[4].link).toBe("/replay?drill=fvg-bull");
  });
  it("ticks tasks off from today's activity, counting only matching drills", () => {
    const p = buildStudyPlan({ ...base, lessonsDoneToday: new Set(["ict-33"]), lessonsDone: new Set(["ict-33"]), dueQuiz: 0,
      chartToday: [...Array(4).fill({ kind: "fvg-bull" }), { kind: "fvg-bear" }, { kind: "pd" }],
      drillsToday: [{ scenario: "fvg-bull" }, { scenario: "fvg-bull" }, {}, { scenario: "ob-bull" }] });
    expect(p.tasks[0]).toMatchObject({ done: true, detail: "Completed today." });
    expect(p.tasks[1].done).toBe(true);
    expect(p.tasks[3]).toMatchObject({ done: true, progress: [5, 5] });
    expect(p.tasks[4]).toMatchObject({ done: false, progress: [2, 3] });
  });
  it("uses mixed drills for concepts without a dedicated exercise", () => {
    const p = buildStudyPlan({ ...base, focus: { id: "mindset", reason: "r" } });
    expect(p.tasks[3].link).toBe("/chart-drills");
    expect(p.tasks[4].link).toBe("/replay");
  });
});
