# Roadmap: closing the learning loop

Goal: connect **study → practice → trading → review** so the app shows whether learning is turning into better decisions.

Status: ✅ done · 🚧 in progress · ⬜ planned

## Phase 1: Feedback on data you already log

| # | Feature | Where | Status |
|---|---|---|---|
| 1.1 | **Bias scorecard**: predicted vs actual daily direction, "price reached my level?", hit rate overall / by market / by weekday / last 20 days | Daily log, Progress | ✅ |
| 1.2 | **Plan adherence**: "Followed my plan?" on each trade; expectancy when followed vs broken | Trade editor, Journal | ✅ |
| 1.3 | **MAE / MFE (in R)**: how far each trade went against / for you; R left on the table | Trade editor, Journal | ✅ |
| 1.4 | **Concept tags + concept mastery**: lessons done + quiz accuracy + trade expectancy per ICT concept | Trade editor, Progress | ✅ |
| 1.5 | **Mistake → lesson prescriptions**: repeated mistakes in the last 30 days point to the lesson and explainer that fix them | Progress, Dashboard | ✅ |
| 1.6 | **Spaced repetition**: quiz answers move through review boxes (1, 3, 7, 14, 30, 60 days); "Due for review" quiz mode | Quizzes, Dashboard | ✅ |
| 1.7 | **Go-live gates**: objective demo → live criteria with progress bars | Progress, Dashboard | ✅ |

## Phase 2: Practice without risk

| # | Feature | Status |
|---|---|---|
| 2.1 | **Chart replay trainer**: import OHLC CSV (TradingView, MT4/MT5, generic) or use synthetic data; step candle by candle; call bias; place entry/stop/target; auto-fill and score in R; drill history and stats | ✅ |
| 2.2 | Replay drills feed concept mastery ("Replay" column) and a new "Practise in replay" go-live gate | ✅ |
| 2.3 | Flashcards from glossary terms and your own trade screenshots, on the same spaced schedule | ✅ |

## Phase 3: AI coaching and less friction

| # | Feature | Status |
|---|---|---|
| 3.1 | AI trade review: trade fields + screenshots → process critique against checklist, rules and lessons (Claude vision, your API key); saved on the trade | ✅ |
| 3.2 | AI weekly coach: drafts the weekly review (structured output) from trades, check-ins, bias calls, rule check-ins and drills | ✅ |
| 3.3 | Broker statement import (MT4/MT5, cTrader, generic CSV) with preview and duplicate detection | ✅ |
| 3.4 | Guided pre-session routine: check-in → risk state → HTF bias → levels → news → killzone → rules | ✅ |
| 3.5 | Setup playbook: your definition, stats and model trades (winners by the plan, checklist 8+, no mistakes) per setup | ✅ |

## Data changes (db versions 3–4)

- `DailyLog`: `biasDir`, `actualDir`, `levelHit`
- `Trade`: `followedPlan`, `mae`, `mfe`, `concepts`
- `QuizAnswer`: `box`, `due`
- `Trade`: `aiReview`, `aiReviewAt` · `DailyLog`: `newsChecked`, `routineDoneAt`
- New tables `replayData` (imported candle sets), `drills` (replay results) and `cards` (flashcard schedule), all included in backups. Playbook definitions are stored in `settings` under `playbook:<setup>`.

Logic: `src/lib/learning.ts` (mastery, gates, prescriptions, bias, spaced repetition, flashcard queue), `src/lib/replay.ts` (replay trainer), `src/lib/importTrades.ts` (broker import), `src/lib/ai.ts` (tutor, trade review, weekly coach). Unit tests in `tests/`; the browser test (`tests/e2e.mjs`) intercepts api.anthropic.com, so it checks the AI requests without a key.

## Ideas for later

- Live candle data for replay without CSV export (needs a data provider)
- AI review of replay drills, and of the Daily log's bias reasoning
- Session-time correction for imported trades (broker server time → New York)
