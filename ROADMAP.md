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

## Phase 4: Sharper feedback

| # | Feature | Status |
|---|---|---|
| 4.1 | Broker import converts times to New York (NY+7 server time, UTC, local, NY) with daylight saving, and sets the session from that time | ✅ |
| 4.2 | AI review of replay drills (80 candles before the call + what followed) and of the Daily log's bias reasoning; shared `AiReview` panel | ✅ |
| 4.3 | Month-by-month trends on My progress: trades, expectancy, plan followed, bias right, drills, rules kept, study days, with ▲▼ | ✅ |
| 4.4 | "Today's plan" card on the Dashboard from the pre-session routine, with an after-close reminder to score the bias | ✅ |

## Phase 5: Train the eye, then find the edge

Goal: the app teaches you to *see* ICT structures on a chart (not just read about them), drills the exact situations you trade, and tells you where your real edge is.

### 5.1 Concept detector (`src/lib/detect.ts`) ✅

Pure functions over candles, never looking past the candle you're "at" (no hindsight):

| Structure | Rule used |
|---|---|
| Swing high / low | Fractal: higher high (lower low) than the 2 candles on each side; confirmed only once those candles exist |
| Fair value gap | 3-candle imbalance: candle 1's high below candle 3's low (bullish) or candle 1's low above candle 3's high (bearish); at least 0.15 ATR; tracks first touch (mitigated) and full fill |
| Liquidity pools | Buy-side above swing highs, sell-side below swing lows; "equal" when two swings are within 0.15 ATR; tracks when it's swept |
| Liquidity sweep | A wick through obvious liquidity (equal highs/lows, or a swing that held 8+ candles) that closes back inside it (turtle soup) |
| Displacement | Body ≥ 1.2 ATR and ≥ 60% of the candle's range |
| Order block | Last opposite-colour candle within 3 candles before a displacement candle that leaves a fair value gap |
| Dealing range | Highest swing high and lowest swing low in the last 60 candles; equilibrium = 50%, ±5% band |

These are mechanical approximations of ICT's definitions, good for training the eye. ICT applies judgement (context, time of day, higher timeframe) that no rule captures.

### 5.2 "Spot it" chart exercises (new page: Chart drills) ✅

- Exercise types: click an unfilled bullish/bearish FVG · click buy-side/sell-side liquidity · premium, discount or equilibrium? · click the bullish/bearish order block · click the candle that swept liquidity
- Uses your imported candles, or practice data if you have none
- After each answer: an overlay draws what the detector found, with a short explanation and a link to the lesson
- Accuracy per exercise type, a 20-answer rolling score, and a "weakest skill" recommendation
- Results feed concept mastery as a new "Chart eye" score (knowledge = lessons 40% + quiz 30% + chart eye 30% once you have chart answers)

### 5.3 Replay overlay ✅

- "Show structures" toggle in replay drills: draws swings, FVGs, order blocks, liquidity and the dealing range, up to the current candle only

### 5.4 Targeted replay drills ✅

- Pick a scenario (sell-side/buy-side sweep → displacement, fresh FVG, new order block, equal highs/lows); the drill starts on the candle after it forms
- Moments are chosen only from what is visible at the start, never from what happens next (tested: the same moments are found when later candles don't exist), so practice results aren't inflated
- Results by drill type; "Bias right" counts random-start drills only

### 5.5 Edge finder ✅

- Results by New York hour and weekday heatmap; combinations of setup × session × bias alignment; R-multiple distribution
- An auto-written "My A+ setup" from your profitable combinations (minimum sample shown), and a flag on trades outside it
- Every figure shows n and a 95% range; "edge" only when the range is above zero with 8+ trades; under 3 trades shows "too few trades"
- Chart poles validated with the dataviz palette checker (light and dark surfaces); hover tooltips and a table view on every chart

### 5.6 Strategy models ✅

- Playbooks for ICT's execution models (OTE, Turtle soup, Judas swing / Power of 3, Silver Bullet time window) with rules, time windows, checklists and per-model stats; labelled as summaries of ICT's public teaching

### 5.7 Adaptive daily study plan ✅

- Each day: weakest concept → one lesson → due flashcards → 5 chart exercises → 5 targeted drills

### 5.8 AI pre-trade check ⬜

- Screenshot + plan → Claude checks bias alignment, premium/discount, killzone and room to target against your checklist and playbook; logged with the trade

## Ideas for later

- Live candle data for replay without CSV export (needs a data provider)
- Chart image of the drill sent alongside the candle text in drill reviews
- A "coach memory": recurring themes across AI reviews summarised monthly
