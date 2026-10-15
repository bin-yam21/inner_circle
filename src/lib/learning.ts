/**
 * The learning loop: connects what you study (lessons, quizzes) with what you do
 * (daily bias calls, trades, rules) so you can see whether learning turns into results.
 * Pure functions only, so everything here is unit-tested in tests/learning.test.ts.
 */
import type { CardState, DailyLog, Drill, LessonProgress, QuizAnswer, QuizQuestion, Rule, RuleCheck, Trade } from "./types";
import { groupBy, round, tradeStats, weekday, type Group } from "./stats";

// Concepts --------------------------------------------------------------------
export interface Concept { id: string; name: string; setups: string[]; lessons: string[]; explainers: string[] }

/** ICT concepts, each linked to the setups that use it, the lessons that teach it and the explainer videos. Edit freely. */
export const CONCEPTS: Concept[] = [
  { id: "liquidity", name: "Liquidity & stop runs", setups: ["Turtle soup (stop run)"], lessons: ["ict-07", "ict-26", "ict-34", "ict-41", "ict-15", "ict-16", "ict-23", "ict-24", "ict-37"], explainers: ["ict-01-liquidity", "ict-08-false-breakouts"] },
  { id: "premium-discount", name: "Premium, discount & OTE", setups: ["OTE retracement"], lessons: ["ict-04", "ict-05", "ict-06", "ict-10"], explainers: ["ict-02-premium-discount-ote"] },
  { id: "order-blocks", name: "Order blocks & breakers", setups: ["Order block", "Breaker", "Rejection block", "Mitigation block", "Propulsion block"], lessons: ["ict-27", "ict-28", "ict-29", "ict-30", "ict-32"], explainers: ["ict-03-order-blocks"] },
  { id: "fvg", name: "Fair value gaps & voids", setups: ["FVG / void fill", "Vacuum block fill"], lessons: ["ict-33", "ict-35", "ict-31"], explainers: ["ict-04-fair-value-gaps"] },
  { id: "structure", name: "Market structure & order flow", setups: [], lessons: ["ict-08", "ict-17", "ict-18", "ict-19", "ict-20", "ict-21", "ict-42"], explainers: [] },
  { id: "time", name: "Time of day & killzones", setups: [], lessons: ["ict-02", "ict-03", "ict-14"], explainers: ["ict-05-killzones"] },
  { id: "ipda", name: "IPDA data ranges", setups: [], lessons: ["ict-38", "ict-39", "ict-40"], explainers: ["ict-06-ipda-data-ranges"] },
  { id: "htf", name: "HTF bias, macro & seasonals", setups: [], lessons: ["ict-22", "ict-25", "ict-43", "ict-44", "ict-45", "ict-46", "ict-47", "ict-48", "ict-49", "ict-51"], explainers: [] },
  { id: "smt", name: "SMT divergence", setups: [], lessons: ["ict-36"], explainers: [] },
  { id: "execution", name: "Entries & trade management", setups: [], lessons: ["ict-01", "ict-52", "ict-53", "ict-54", "ict-55"], explainers: [] },
  { id: "risk", name: "Risk & money management", setups: [], lessons: ["ict-09", "ict-11", "ict-12", "ict-13", "ict-50"], explainers: ["ict-07-risk-halving"] },
  { id: "mindset", name: "Mindset & discipline", setups: [], lessons: ["psy-01", "psy-02", "psy-03", "psy-04", "psy-05", "psy-06", "psy-07", "psy-08", "psy-09", "psy-10"], explainers: ["psy-01-tilt", "psy-02-process-over-outcome"] },
];
export const conceptById = (id: string) => CONCEPTS.find((c) => c.id === id);

/** Concept ids a trade used: the ones tagged on it plus the ones implied by its setup. */
export function conceptsOfTrade(t: Pick<Trade, "setup" | "concepts">): string[] {
  const ids = new Set(t.concepts ?? []);
  for (const c of CONCEPTS) if (c.setups.includes(t.setup)) ids.add(c.id);
  return [...ids];
}

export type MasteryStatus = "Not started" | "Studying" | "Understood" | "Practising" | "Edge" | "Leak";
export interface Mastery {
  concept: Concept; lessonsDone: number; lessonsTotal: number;
  quizAnswered: number; quizCorrect: number; quizAccuracy: number | null;
  /** 0–1 blend of lessons completed and quiz accuracy. */
  knowledge: number;
  trades: number; expectancy: number; totalR: number; winRate: number;
  /** Replay drills where you placed a trade with a setup that uses this concept. */
  drills: number; drillExpectancy: number;
  status: MasteryStatus;
}

/**
 * Knowledge comes from lessons + quizzes; application comes from trades.
 * "Edge" = 10+ trades with positive expectancy, "Leak" = 5+ trades losing money.
 */
/** Replay drills that ended with a trade (win, loss or still open). */
export const tradedDrills = (drills: Drill[]) => drills.filter((d) => d.outcome === "win" || d.outcome === "loss" || d.outcome === "open");

export function conceptMastery(progress: LessonProgress[], answers: QuizAnswer[], questions: QuizQuestion[], trades: Trade[], drills: Drill[] = []): Mastery[] {
  const done = new Set(progress.filter((p) => p.done).map((p) => p.lessonId));
  const byKey = new Map(answers.map((a) => [a.key, a]));
  return CONCEPTS.map((concept) => {
    const lessonsDone = concept.lessons.filter((l) => done.has(l)).length;
    const qs = questions.filter((q) => concept.lessons.includes(q.lesson));
    const answered = qs.map((q) => byKey.get(`${q.courseId}:${q.index}`)).filter((a): a is QuizAnswer => !!a);
    const quizCorrect = answered.filter((a) => a.correct).length;
    const quizAccuracy = answered.length ? quizCorrect / answered.length : null;
    const lessonPart = concept.lessons.length ? lessonsDone / concept.lessons.length : 0;
    const knowledge = quizAccuracy == null ? lessonPart * 0.6 : lessonPart * 0.5 + quizAccuracy * 0.5;
    const ts = trades.filter((t) => conceptsOfTrade(t).includes(concept.id));
    const st = tradeStats(ts);
    const ds = tradedDrills(drills).filter((d) => d.setup && concept.setups.includes(d.setup));
    const drillExpectancy = ds.length ? round(ds.reduce((a, d) => a + d.r, 0) / ds.length) : 0;
    let status: MasteryStatus = "Not started";
    if (st.n >= 10 && st.expectancy > 0) status = "Edge";
    else if (st.n >= 5 && st.expectancy < 0) status = "Leak";
    else if (st.n > 0 || ds.length >= 3) status = "Practising";
    else if (knowledge >= 0.7) status = "Understood";
    else if (lessonsDone || answered.length) status = "Studying";
    return {
      concept, lessonsDone, lessonsTotal: concept.lessons.length, quizAnswered: answered.length, quizCorrect, quizAccuracy,
      knowledge: round(knowledge), trades: st.n, expectancy: st.expectancy, totalR: st.totalR, winRate: st.winRate,
      drills: ds.length, drillExpectancy, status,
    };
  });
}

// Mistake prescriptions -------------------------------------------------------
export interface Fix { lessons: string[]; explainer?: string; tip: string }
/** For each journal mistake: the lessons and explainer that address it, and one concrete habit. */
export const MISTAKE_FIX: Record<string, Fix> = {
  "No setup / impulse": { lessons: ["ict-14", "ict-44", "psy-03"], explainer: "psy-02-process-over-outcome", tip: "Score the checklist before every entry. Under 8/10 means no trade." },
  "Chased price": { lessons: ["ict-04", "ict-54", "psy-05"], explainer: "ict-02-premium-discount-ote", tip: "Buy in discount, sell in premium. Put a limit order at the PD array and let price come to you." },
  "Moved stop": { lessons: ["ict-13", "ict-55", "psy-02"], explainer: "ict-07-risk-halving", tip: "The stop sits where the idea is wrong. Set it, then take your hands off it." },
  "Oversized": { lessons: ["ict-50", "ict-09", "psy-06"], explainer: "ict-07-risk-halving", tip: "Use the position-size calculator for every trade. Never more than 1% of the allocation." },
  "Outside killzone": { lessons: ["ict-02", "ict-03"], explainer: "ict-05-killzones", tip: "Only enter inside the London or New York killzone. Set alarms for the open." },
  "Against HTF bias": { lessons: ["ict-22", "ict-51", "ict-17"], explainer: "ict-06-ipda-data-ranges", tip: "Write the daily bias and the draw on liquidity before the session. No trades against it." },
  "Traded the news candle": { lessons: ["ict-53", "ict-44"], explainer: "ict-05-killzones", tip: "Check the calendar every morning. Stay flat from 5 minutes before to 15 minutes after high-impact news." },
  "Exited too early": { lessons: ["ict-55", "ict-20", "psy-02"], explainer: "ict-01-liquidity", tip: "Mark the draw on liquidity before entry and hold for it. Scale out at most a third early." },
  "Held a loser too long": { lessons: ["ict-13", "psy-02", "psy-09"], explainer: "ict-07-risk-halving", tip: "A trade that hits the stop is finished. No re-entries for 30 minutes." },
  "Revenge trade": { lessons: ["psy-04", "ict-12"], explainer: "psy-01-tilt", tip: "After a loss, stand up and walk away for 30 minutes. The tilt guard tells you when to stop." },
  "Ignored checklist": { lessons: ["ict-14", "psy-10"], explainer: "psy-02-process-over-outcome", tip: "Keep the checklist open next to the chart and score it in the journal every time." },
};

export interface Prescription { mistake: string; count: number; costR: number; fix: Fix }
/** Mistakes repeated at least `min` times in the last `days` days, worst first. */
export function prescriptions(trades: Trade[], today: string, days = 30, min = 2): Prescription[] {
  const since = addDays(today, -days);
  const recent = trades.filter((t) => t.date > since && t.date <= today);
  return groupBy(recent, (t) => t.mistakes.filter((m) => m !== "None"))
    .filter((g) => g.n >= min && MISTAKE_FIX[g.key])
    .map((g) => ({ mistake: g.key, count: g.n, costR: g.totalR, fix: MISTAKE_FIX[g.key] }))
    .sort((a, b) => b.count - a.count || a.costR - b.costR);
}

// Bias scorecard --------------------------------------------------------------
export interface BiasStats {
  scored: number; hits: number; hitRate: number;
  last20: { n: number; hitRate: number };
  levelChecked: number; levelHitRate: number;
  byMarket: { key: string; n: number; hitRate: number }[];
  byWeekday: { key: string; n: number; hitRate: number }[];
  streak: number;
  recent: { date: string; hit: boolean }[];
}
const isScored = (l: DailyLog) => !!l.biasDir && !!l.actualDir;
const firstMarket = (s: string) => (s.split(/[,;]/)[0] ?? "").trim().toUpperCase() || "—";

export function biasStats(logs: DailyLog[]): BiasStats {
  const scored = logs.filter(isScored).sort((a, b) => a.date.localeCompare(b.date));
  const hit = (l: DailyLog) => l.biasDir === l.actualDir;
  const rate = (ls: DailyLog[]) => (ls.length ? ls.filter(hit).length / ls.length : 0);
  const group = (keyOf: (l: DailyLog) => string) => {
    const m = new Map<string, DailyLog[]>();
    for (const l of scored) m.set(keyOf(l), [...(m.get(keyOf(l)) ?? []), l]);
    return [...m.entries()].map(([key, ls]) => ({ key, n: ls.length, hitRate: rate(ls) })).sort((a, b) => b.n - a.n);
  };
  const last20 = scored.slice(-20);
  let streak = 0;
  for (let i = scored.length - 1; i >= 0 && hit(scored[i]); i--) streak++;
  const levelChecked = logs.filter((l) => l.levelHit === "yes" || l.levelHit === "no");
  return {
    scored: scored.length, hits: scored.filter(hit).length, hitRate: rate(scored),
    last20: { n: last20.length, hitRate: rate(last20) },
    levelChecked: levelChecked.length, levelHitRate: levelChecked.length ? levelChecked.filter((l) => l.levelHit === "yes").length / levelChecked.length : 0,
    byMarket: group((l) => firstMarket(l.markets)), byWeekday: group((l) => weekday(l.date)),
    streak, recent: scored.slice(-30).map((l) => ({ date: l.date, hit: hit(l) })),
  };
}

// Plan adherence & excursions -------------------------------------------------
export interface ExecutionStats {
  recorded: number; adherence: number;
  followed: Group | null; broken: Group | null;
  withMfe: number; avgMfe: number; avgMae: number;
  /** Average R given back on winners (MFE − result). */
  leftOnTable: number;
  /** Losing trades that were at least +1R in profit first. */
  losersThatWereUp: number;
  /** Average MAE on winners: how much heat good trades needed. */
  winnerHeat: number;
}
export function executionStats(trades: Trade[]): ExecutionStats {
  const rec = trades.filter((t) => t.followedPlan === true || t.followedPlan === false);
  const g = groupBy(rec, (t) => (t.followedPlan ? "Followed plan" : "Broke plan"));
  const ex = trades.filter((t) => t.mfe != null || t.mae != null);
  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const winners = ex.filter((t) => t.r > 0);
  return {
    recorded: rec.length, adherence: rec.length ? rec.filter((t) => t.followedPlan).length / rec.length : 0,
    followed: g.find((x) => x.key === "Followed plan") ?? null, broken: g.find((x) => x.key === "Broke plan") ?? null,
    withMfe: ex.length, avgMfe: avg(ex.filter((t) => t.mfe != null).map((t) => t.mfe!)), avgMae: avg(ex.filter((t) => t.mae != null).map((t) => t.mae!)),
    leftOnTable: avg(winners.filter((t) => t.mfe != null).map((t) => Math.max(0, t.mfe! - t.r))),
    losersThatWereUp: ex.filter((t) => t.r < 0 && (t.mfe ?? 0) >= 1).length,
    winnerHeat: avg(winners.filter((t) => t.mae != null).map((t) => t.mae!)),
  };
}

// Spaced repetition -----------------------------------------------------------
/** Days until the next review for boxes 1..6. A wrong answer goes back to box 0 (due tomorrow). */
export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60];

export function scheduleReview(prev: Pick<QuizAnswer, "box" | "correct"> | undefined, correct: boolean, today: string): { box: number; due: string } {
  if (!correct) return { box: 0, due: addDays(today, 1) };
  // First-time correct answers skip ahead: you already knew it.
  const from = prev ? (prev.box ?? (prev.correct ? 1 : 0)) : 1;
  const box = Math.min(from + 1, SRS_INTERVALS.length);
  return { box, due: addDays(today, SRS_INTERVALS[box - 1]) };
}
/** Due when its date has come; older answers without a schedule are due only if they were missed. */
export const isDue = (a: QuizAnswer, today: string) => (a.due ? a.due <= today : !a.correct);

// Go-live gates ---------------------------------------------------------------
export interface Gate { id: string; label: string; detail: string; value: string; progress: number; met: boolean }

export function goLiveGates(trades: Trade[], logs: DailyLog[], rules: Rule[], checks: RuleCheck[], drills: Drill[] = []): Gate[] {
  const demo = trades.filter((t) => t.account === "Demo");
  const last30 = demo.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).slice(-30);
  const st = tradeStats(last30);
  const ex = executionStats(last30);
  const bias = biasStats(logs);
  const active = new Set(rules.filter((r) => r.active).map((r) => r.id));
  const recentChecks = checks.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
  let ok = 0, total = 0;
  for (const c of recentChecks) for (const id of active) { total++; if (c.followed[id]) ok++; }
  const adherence = total ? ok / total : 0;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  // Quality gates need at least 10 trades before they can look complete.
  const sample = Math.min(1, st.n / 10), planSample = Math.min(1, ex.recorded / 10), checkSample = Math.min(1, recentChecks.length / 10);
  const p = (x: number) => Math.round(x * 100) + "%";
  const practice = tradedDrills(drills);
  const practiceExp = practice.length ? round(practice.reduce((a, d) => a + d.r, 0) / practice.length) : 0;
  return [
    { id: "volume", label: "30 demo trades", detail: "ICT's minimum sample before risking real money.", value: `${demo.length} / 30`, progress: clamp(demo.length / 30), met: demo.length >= 30 },
    { id: "expectancy", label: "Positive expectancy", detail: "Average result per trade over your last 30 demo trades is above +0.2R.", value: st.n ? `${st.expectancy >= 0 ? "+" : ""}${st.expectancy.toFixed(2)}R` : "–", progress: clamp((st.expectancy + 0.5) / 0.7) * sample, met: st.n >= 10 && st.expectancy > 0.2 },
    { id: "drawdown", label: "Drawdown under control", detail: "Worst peak-to-trough in the last 30 demo trades is 6R or less.", value: st.n ? `−${st.maxDrawdownR.toFixed(1)}R` : "–", progress: clamp(1 - Math.max(0, st.maxDrawdownR - 6) / 6) * sample, met: st.n >= 10 && st.maxDrawdownR <= 6 },
    { id: "plan", label: "Follow your plan", detail: "At least 80% of recent trades marked \"Followed my plan\".", value: ex.recorded ? p(ex.adherence) : "not recorded", progress: clamp(ex.adherence / 0.8) * planSample, met: ex.recorded >= 10 && ex.adherence >= 0.8 },
    { id: "bias", label: "Read the daily bias", detail: "Bias right at least 55% of the time over 20+ scored days in the Daily log.", value: bias.scored ? `${p(bias.hitRate)} of ${bias.scored} days` : "no scored days", progress: clamp((bias.scored / 20) * 0.5 + (bias.hitRate / 0.55) * 0.5), met: bias.scored >= 20 && bias.hitRate >= 0.55 },
    { id: "practice", label: "Practise in replay", detail: "20+ replay drills with a trade, and positive expectancy across them.", value: practice.length ? `${practice.length} drills · ${practiceExp >= 0 ? "+" : ""}${practiceExp.toFixed(2)}R` : "no drills", progress: clamp(practice.length / 20) * (practice.length && practiceExp > 0 ? 1 : 0.5), met: practice.length >= 20 && practiceExp > 0 },
    { id: "rules", label: "Keep your rules", detail: "80%+ of your active rules ticked across your last 20 rule check-ins.", value: total ? p(adherence) : "no check-ins", progress: clamp(adherence / 0.8) * checkSample, met: recentChecks.length >= 10 && adherence >= 0.8 },
  ];
}

// Dates -----------------------------------------------------------------------
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Flashcards ------------------------------------------------------------------
/**
 * Today's study queue: cards that are due (most overdue first), then up to
 * `newLimit` cards you have never seen, in deck order.
 */
export function cardQueue(keys: string[], states: Pick<CardState, "key" | "due">[], today: string, newLimit = 10): string[] {
  const byKey = new Map(states.map((s) => [s.key, s]));
  const due = keys.filter((k) => { const s = byKey.get(k); return s && s.due <= today; }).sort((a, b) => byKey.get(a)!.due.localeCompare(byKey.get(b)!.due));
  const fresh = keys.filter((k) => !byKey.has(k)).slice(0, newLimit);
  return [...due, ...fresh];
}
