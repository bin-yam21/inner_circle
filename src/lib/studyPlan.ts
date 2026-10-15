/**
 * Adaptive daily study plan: one focus concept per day (a leak first, otherwise your
 * weakest), with five short tasks built around it. Pure functions; tested in tests/studyPlan.test.ts.
 */
import type { Mastery } from "./learning";
import type { ExerciseKind } from "./exercises";
import type { ScenarioKind } from "./scenarios";
import { findLessonAnywhere } from "./content";

export interface StudyTask {
  id: "lesson" | "review" | "cards" | "chart" | "replay";
  title: string; detail: string; link: string; done: boolean;
  /** For count-based tasks: [done, target]. */
  progress?: [number, number];
}
export interface StudyPlan { focusId: string; focusName: string; reason: string; tasks: StudyTask[] }

/** Which chart drills and replay scenario train each concept. Concepts without a drill use mixed / random. */
const CHART_KINDS: Record<string, ExerciseKind[]> = {
  fvg: ["fvg-bull", "fvg-bear"], liquidity: ["bsl", "ssl", "sweep"], "premium-discount": ["pd"], "order-blocks": ["ob-bull", "ob-bear"],
};
const REPLAY: Record<string, ScenarioKind> = { fvg: "fvg-bull", "order-blocks": "ob-bull", liquidity: "ssl-sweep-long", structure: "bsl-sweep-short", execution: "fvg-bear" };
export const CHART_TARGET = 5, REPLAY_TARGET = 3;

/** A leak (losing money on it) beats everything; otherwise the lowest knowledge with lessons still to do; otherwise the lowest knowledge. */
export function pickFocus(mastery: Mastery[]): { id: string; reason: string } {
  const pctOf = (x: number) => Math.round(x * 100) + "%";
  const leak = mastery.filter((m) => m.status === "Leak").sort((a, b) => a.expectancy - b.expectancy)[0];
  if (leak) return { id: leak.concept.id, reason: `You're losing money with it: ${leak.trades} trades at ${leak.expectancy.toFixed(2)}R each.` };
  const open = mastery.filter((m) => m.lessonsDone < m.lessonsTotal);
  const pool = open.length ? open : mastery;
  const weakest = pool.slice().sort((a, b) => a.knowledge - b.knowledge)[0];
  const parts = [`lessons ${weakest.lessonsDone}/${weakest.lessonsTotal}`, weakest.quizAccuracy != null ? `quiz ${pctOf(weakest.quizAccuracy)}` : null, weakest.chartAccuracy != null ? `chart ${pctOf(weakest.chartAccuracy)}` : null].filter(Boolean);
  return { id: weakest.concept.id, reason: `Your weakest concept right now: knowledge ${pctOf(weakest.knowledge)} (${parts.join(", ")}).` };
}

export function buildStudyPlan(input: {
  focus: { id: string; reason: string }; mastery: Mastery[];
  /** Lesson ids you've completed (all time) and today. */
  lessonsDone: Set<string>; lessonsDoneToday: Set<string>;
  dueQuiz: number; dueCards: number;
  chartToday: { kind: string }[]; drillsToday: { scenario?: string }[];
}): StudyPlan {
  const m = input.mastery.find((x) => x.concept.id === input.focus.id) ?? input.mastery[0];
  const c = m.concept;
  const nextLesson = c.lessons.find((id) => !input.lessonsDone.has(id));
  const doneToday = c.lessons.find((id) => input.lessonsDoneToday.has(id));
  const lessonId = nextLesson ?? doneToday ?? c.lessons[0];
  const lesson = findLessonAnywhere(lessonId);
  const kinds = CHART_KINDS[c.id];
  const chartDone = input.chartToday.filter((a) => !kinds || kinds.includes(a.kind as ExerciseKind)).length;
  const scenario = REPLAY[c.id];
  const replayDone = input.drillsToday.filter((d) => !scenario || d.scenario === scenario).length;
  const tasks: StudyTask[] = [
    nextLesson || doneToday
      ? { id: "lesson", title: `Lesson: ${lesson?.title ?? lessonId}`, detail: doneToday ? "Completed today." : "Watch or read it, take notes, and mark it complete.", link: lesson ? `/courses/${lesson.courseId}/${lesson.id}` : "/courses", done: !!doneToday }
      : { id: "lesson", title: `All ${c.name} lessons done`, detail: "Reread your notes on the first one if anything feels shaky.", link: lesson ? `/courses/${lesson.courseId}/${lesson.id}` : "/courses", done: true },
    { id: "review", title: input.dueQuiz ? `Review ${input.dueQuiz} due quiz question${input.dueQuiz === 1 ? "" : "s"}` : "Quiz reviews", detail: input.dueQuiz ? "Spaced repetition: a few minutes keeps concepts from fading." : "Nothing due today.", link: "/quiz?due=1", done: input.dueQuiz === 0 },
    { id: "cards", title: input.dueCards ? `Study ${input.dueCards} due flashcard${input.dueCards === 1 ? "" : "s"}` : "Flashcards", detail: input.dueCards ? "Glossary terms and your own chart screenshots." : "Nothing due today.", link: "/flashcards", done: input.dueCards === 0 },
    { id: "chart", title: kinds ? `${CHART_TARGET} chart drills on ${c.name.toLowerCase()}` : `${CHART_TARGET} mixed chart drills`, detail: "Find it on the chart, then compare with the detector.", link: kinds ? `/chart-drills?kind=${kinds[0]}` : "/chart-drills", done: chartDone >= CHART_TARGET, progress: [Math.min(chartDone, CHART_TARGET), CHART_TARGET] },
    { id: "replay", title: scenario ? `${REPLAY_TARGET} targeted replay drills` : `${REPLAY_TARGET} replay drills from a random point`, detail: scenario ? "Plan the entry, stop and target, then step it forward." : "Call the bias before you step forward.", link: scenario ? `/replay?drill=${scenario}` : "/replay", done: replayDone >= REPLAY_TARGET, progress: [Math.min(replayDone, REPLAY_TARGET), REPLAY_TARGET] },
  ];
  return { focusId: c.id, focusName: c.name, reason: input.focus.reason, tasks };
}
