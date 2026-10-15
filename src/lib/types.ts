// Content (read-only, from /content) ----------------------------------------
export interface Module { id: string; title: string }
export interface Course {
  /** Icon name from src/components/fx.tsx ICONS. */
  icon?: string;
  id: string; title: string; subtitle?: string; description?: string;
  author?: string; tags?: string[]; modules: Module[];
}
export interface Lesson {
  courseId: string; id: string; module: string; order: number; title: string;
  duration?: string; meta?: string; video?: string; body: string;
}
export interface QuizQuestion {
  courseId: string; index: number; lesson: string; q: string;
  options: string[]; answer: number; explain: string;
}
export interface NewsItem {
  id: string; date: string; tag?: string; markets?: string[]; title: string;
  summary: string; ict?: string; lessons?: string[]; source?: string; url?: string;
}
export interface Snapshot { asOf: string; note?: string; items: { k: string; v: string; s?: string }[] }
export interface Plan { id: string; title: string; course?: string; weeks: { title: string; tasks: string[] }[] }
export interface RefPage { id: string; title: string; order: number; course?: string; body: string }
export interface GlossaryTerm { term: string; definition: string }
/** An ICT execution model (content/models/*.json). Times are New York, "HH:MM". */
export interface StrategyModel {
  id: string; order: number; name: string; source: string; summary: string;
  windows: { start: string; end: string; label: string }[];
  steps: string[]; entry: string; stop: string; target: string; invalidation: string;
  checklist: string[]; lessons: string[]; setups: string[]; scenario?: string;
}

// User data (IndexedDB) ------------------------------------------------------
export type Direction = "Long" | "Short";
export interface Trade {
  id: string; date: string; time?: string; market: string; direction: Direction;
  setup: string; timeframe: string; session: string;
  entry?: number | null; stop?: number | null; target?: number | null; exit?: number | null;
  size?: number | null; r: number; pnl?: number | null;
  checklist?: number | null; emotionsBefore: string[]; emotionsAfter: string[];
  mistakes: string[]; notes: string; lesson?: string; account: "Demo" | "Live";
  /** Did I execute the plan as written? null = not recorded. */
  followedPlan?: boolean | null;
  /** Max adverse / favourable excursion while the trade was open, in R (both positive numbers). */
  mae?: number | null; mfe?: number | null;
  /** ICT concepts used in this trade (ids from CONCEPTS in lib/learning.ts). */
  concepts?: string[];
  /** Execution model used (StrategyModel id). */
  model?: string;
  /** Last AI coach review of this trade, and when it was written. */
  aiReview?: string; aiReviewAt?: number;
  createdAt: number; updatedAt: number;
}
export interface TradeImage { id?: number; tradeId: string; kind: "before" | "after" | "other"; blob: Blob; caption?: string }
export interface LessonProgress { key: string; courseId: string; lessonId: string; done: boolean; doneAt?: number; notes: string; updatedAt: number }
export interface QuizAnswer {
  key: string; courseId: string; index: number; correct: boolean; wrongCount: number; at: number;
  /** Spaced-repetition box (0 = just missed) and the date it is next due (YYYY-MM-DD). */
  box?: number; due?: string;
}
export interface QuizRound { id?: number; date: string; label: string; score: number; total: number }
export interface DailyLog {
  date: string; markets: string; bias: string; waitingFor: string;
  dailyHigh: string; dailyHighTime: string; dailyLow: string; dailyLowTime: string;
  notes: string; processGrade: string; missed: string; updatedAt: number;
  /** Bias scorecard: predicted direction, what price actually did, and whether price reached the level I expected. */
  biasDir?: BiasDir; actualDir?: BiasDir; levelHit?: "" | "yes" | "no";
  /** Pre-session routine: news calendar checked, and when the routine was completed. */
  newsChecked?: boolean; routineDoneAt?: number;
  /** Last AI review of this day's bias reasoning. */
  aiReview?: string; aiReviewAt?: number;
}
export type BiasDir = "" | "Bullish" | "Bearish" | "Range";
export interface CheckIn {
  date: string; sleep: number; mood: number; focus: number; stress: number; fear: number;
  emotions: string[]; intention: string; updatedAt: number;
}
export interface WeeklyReview { week: string; best: string; worst: string; mistakes: string; lessons: string; nextFocus: string; updatedAt: number }
export interface Rule { id: string; text: string; category: string; active: boolean; order: number }
export interface RuleCheck { date: string; followed: Record<string, boolean> }
export type MaterialType = "note" | "link" | "video" | "pdf" | "image" | "file";
export interface Material {
  id: string; title: string; type: MaterialType; url?: string; body?: string; tags: string[];
  course?: string; file?: Blob; fileName?: string; done: boolean; createdAt: number;
}
export interface PlanTask { key: string; done: boolean; at?: number }
export interface Setting { key: string; value: unknown }
export interface Activity { date: string; count: number }
export interface ChatMessage { id?: number; role: "user" | "assistant"; content: string; at: number }

/** One row per explainer video you finished. */
export interface Watched { id: string; at: number; count: number }

// Chart replay trainer --------------------------------------------------------
export interface Candle { t: number; o: number; h: number; l: number; c: number }
/** An imported (or generated) candle series used for replay practice. */
export interface ReplayDataset { id: string; name: string; market: string; timeframe: string; candles: Candle[]; createdAt: number }
/** One replay practice run: the bias called, the order planned and how it played out. */
export interface Drill {
  id: string; datasetId: string; datasetName: string; market: string; timeframe: string;
  startIndex: number; endIndex: number; startTime: number;
  bias: BiasDir; biasCorrect: boolean | null;
  direction?: Direction; entry?: number | null; stop?: number | null; target?: number | null;
  outcome: "no-trade" | "not-filled" | "win" | "loss" | "open"; r: number;
  setup?: string; notes: string; at: number;
  /** Targeted drill type (ScenarioKind from lib/scenarios.ts); absent for a random start. */
  scenario?: string;
  /** Last AI review of this drill. */
  aiReview?: string; aiReviewAt?: number;
}

/** Spaced-repetition state of one flashcard. key: "g:<term>" (glossary) or "t:<tradeId>" (trade screenshot). */
export interface CardState { key: string; box: number; due: string; correct: boolean; at: number; reviews: number }

/** One answer in the chart exercises ("spot it"). kind: an ExerciseKind from lib/exercises.ts. */
export interface SpotAnswer { id?: number; kind: string; correct: boolean; at: number; datasetId?: string }
