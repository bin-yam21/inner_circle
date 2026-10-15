import { useLiveQuery } from "dexie-react-hooks";
import { db, streakFrom } from "./db";
import { lessons } from "./content";

/** XP rewards for learning activities. Tune freely. */
export const XP = { explainer: 30, lesson: 50, quizCorrect: 10, trade: 15, checkin: 10, dailyLog: 15, review: 40, planTask: 20, material: 10, drill: 10, biasScored: 5, spotCorrect: 3 };

export interface Achievement { id: string; title: string; desc: string; icon: string; done: boolean; progress: number }
export interface XpState { xp: number; level: number; levelXp: number; nextLevelXp: number; title: string; streak: number; achievements: Achievement[] }

const TITLES = ["Novice", "Apprentice", "Chart Reader", "Liquidity Hunter", "Order Flow Student", "PD Array Analyst", "Session Strategist", "IPDA Navigator", "Market Technician", "Smart Money Mentor"];

/** Level n starts at 100·(n−1)² XP: 0, 100, 400, 900, 1600… */
export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const levelXp = 100 * (level - 1) ** 2, nextLevelXp = 100 * level ** 2;
  return { level, levelXp, nextLevelXp, title: TITLES[Math.min(level - 1, TITLES.length - 1)] };
}

export function useXp(): XpState | undefined {
  return useLiveQuery(async () => {
    const [progress, answers, trades, checkins, logs, reviews, plan, materials, activity, rules, watched, drills, logRows, spotRight] = await Promise.all([
      db.progress.toArray(), db.quizAnswers.toArray(), db.trades.toArray(), db.checkins.count(), db.dailyLogs.count(),
      db.reviews.count(), db.plan.toArray(), db.materials.count(), db.activity.toArray(), db.rules.count(), db.watched.count(),
      db.drills.count(), db.dailyLogs.toArray(), db.spotAnswers.filter((a) => a.correct).count(),
    ]);
    const biasScored = logRows.filter((l) => l.biasDir && l.actualDir).length;
    const done = progress.filter((p) => p.done);
    const correct = answers.filter((a) => a.correct).length;
    const planDone = plan.filter((p) => p.done).length;
    const xp = done.length * XP.lesson + correct * XP.quizCorrect + trades.length * XP.trade + checkins * XP.checkin +
      logs * XP.dailyLog + reviews * XP.review + planDone * XP.planTask + materials * XP.material + watched * XP.explainer +
      drills * XP.drill + biasScored * XP.biasScored + spotRight * XP.spotCorrect;
    const streak = streakFrom(activity.map((a) => a.date));
    const ictDone = done.filter((p) => p.courseId === "ict-mentorship-2016").length;
    const ictTotal = lessons.filter((l) => l.courseId === "ict-mentorship-2016").length || 1;
    const psyDone = done.filter((p) => p.courseId === "trading-psychology").length;
    const psyTotal = lessons.filter((l) => l.courseId === "trading-psychology").length || 1;
    const a = (id: string, title: string, desc: string, icon: string, cur: number, target: number): Achievement =>
      ({ id, title, desc, icon, done: cur >= target, progress: Math.min(1, cur / target) });
    const achievements = [
      a("watch1", "Lights, camera", "Watch your first explainer video", "play", watched, 1),
      a("watch-all", "Visual learner", "Watch 8 explainer videos", "eye", watched, 8),
      a("first-lesson", "First step", "Complete your first lesson", "footprints", done.length, 1),
      a("month1", "Foundations laid", "Complete 8 ICT lessons", "layers", ictDone, 8),
      a("half-ict", "Halfway there", "Complete half of the ICT course", "mountain", ictDone, Math.ceil(ictTotal / 2)),
      a("ict-grad", "ICT graduate", "Complete all ICT lessons", "graduation-cap", ictDone, ictTotal),
      a("mind", "Mind over market", "Complete the psychology course", "brain", psyDone, psyTotal),
      a("quiz10", "Sharp mind", "Answer 10 quiz questions correctly", "target", correct, 10),
      a("quiz50", "Quiz master", "Answer 50 quiz questions correctly", "trophy", correct, 50),
      a("trade1", "In the arena", "Log your first trade", "candlestick-chart", trades.length, 1),
      a("trade30", "Go-live ready", "Log 30 demo trades (ICT's bar)", "badge-check", trades.length, 30),
      a("checkin7", "Self-aware", "Do 7 daily check-ins", "heart-pulse", checkins, 7),
      a("streak7", "On fire", "Study 7 days in a row", "flame", streak, 7),
      a("rules", "Rulebook", "Write your trading rules", "scroll-text", rules, 3),
      a("review", "Reflective trader", "Complete a weekly review", "notebook-pen", reviews, 1),
      a("log5", "Price watcher", "Write 5 daily logs", "eye", logs, 5),
      a("bias20", "Bias reader", "Score your daily bias on 20 days", "target", biasScored, 20),
      a("drill1", "Back to the tape", "Finish your first replay drill", "rewind", drills, 1),
      a("drill50", "Screen time", "Finish 50 replay drills", "rewind", drills, 50),
      a("eye50", "Sharp eye", "Get 50 chart drills right", "eye", spotRight, 50),
      a("eye250", "Chart reader", "Get 250 chart drills right", "eye", spotRight, 250),
    ];
    return { xp, ...levelFor(xp), streak, achievements };
  }, []);
}
