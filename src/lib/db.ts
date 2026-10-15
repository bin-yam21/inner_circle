import Dexie, { type Table } from "dexie";
import type {
  Activity, ChatMessage, CheckIn, DailyLog, LessonProgress, Material, PlanTask, QuizAnswer,
  QuizRound, Rule, RuleCheck, Setting, Trade, TradeImage, Watched, WeeklyReview, ReplayDataset, Drill, CardState, SpotAnswer,
} from "./types";

/**
 * All user data lives in this browser database (IndexedDB) on your own machine.
 * To add a feature with new data: add a table here and bump the version with
 * `this.version(N+1).stores({...})`. Dexie migrates existing data automatically.
 */
export class AcademyDB extends Dexie {
  progress!: Table<LessonProgress, string>;
  quizAnswers!: Table<QuizAnswer, string>;
  quizRounds!: Table<QuizRound, number>;
  trades!: Table<Trade, string>;
  images!: Table<TradeImage, number>;
  dailyLogs!: Table<DailyLog, string>;
  checkins!: Table<CheckIn, string>;
  reviews!: Table<WeeklyReview, string>;
  rules!: Table<Rule, string>;
  ruleChecks!: Table<RuleCheck, string>;
  materials!: Table<Material, string>;
  plan!: Table<PlanTask, string>;
  settings!: Table<Setting, string>;
  activity!: Table<Activity, string>;
  chat!: Table<ChatMessage, number>;
  watched!: Table<Watched, string>;
  replayData!: Table<ReplayDataset, string>;
  drills!: Table<Drill, string>;
  cards!: Table<CardState, string>;
  spotAnswers!: Table<SpotAnswer, number>;

  constructor(name = "trading-academy") {
    super(name);
    this.version(1).stores({
      progress: "key, courseId, done",
      quizAnswers: "key, courseId, correct",
      quizRounds: "++id, date",
      trades: "id, date, market, setup, session, account",
      images: "++id, tradeId",
      dailyLogs: "date",
      checkins: "date",
      reviews: "week",
      rules: "id, order",
      ruleChecks: "date",
      materials: "id, type, course, createdAt",
      plan: "key",
      settings: "key",
      activity: "date",
      chat: "++id, at",
    });
    this.version(2).stores({ watched: "id, at" });
    this.version(3).stores({ replayData: "id, createdAt", drills: "id, at, datasetId" });
    this.version(4).stores({ cards: "key, due" });
    this.version(5).stores({ spotAnswers: "++id, kind, at" });
  }
}

export const db = new AcademyDB();

export const TABLES = ["progress", "quizAnswers", "quizRounds", "trades", "images", "dailyLogs", "checkins", "reviews", "rules", "ruleChecks", "materials", "plan", "settings", "activity", "chat", "watched", "replayData", "drills", "cards", "spotAnswers"] as const;
export type TableName = (typeof TABLES)[number];

export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Count a study action toward today's streak. */
export async function markActivity() {
  const date = todayStr();
  const cur = await db.activity.get(date);
  await db.activity.put({ date, count: (cur?.count ?? 0) + 1 });
}

export function streakFrom(dates: string[]): number {
  const set = new Set(dates);
  const d = new Date();
  if (!set.has(todayStr(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(todayStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const uid = (prefix = "") => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Settings ------------------------------------------------------------------
export interface AppSettings {
  accountSize: number; allocationPct: number; riskPct: number; pipValue: number;
  dailyLossLimitR: number; weeklyTargetPips: number; currency: string;
  apiKey: string; theme: "system" | "light" | "dark"; videoFolder: string;
}
export const DEFAULT_SETTINGS: AppSettings = {
  accountSize: 10000, allocationPct: 30, riskPct: 1, pipValue: 10,
  dailyLossLimitR: 2, weeklyTargetPips: 75, currency: "USD",
  apiKey: "", theme: "system", videoFolder: "D:\\forex\\@Inner circle trade",
};
export async function loadSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as AppSettings;
}
export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await db.settings.put({ key, value });
}
