# Trading Academy

A personal, local-first trading-education app: courses, quizzes, a full trade journal, trading psychology tools, daily logs, a personal library, market news and an AI tutor. All your data stays on your computer.

## Start the app

**Easiest:** double-click `start.bat`. It installs what's needed the first time, builds the app and opens it at http://localhost:4173.

From a terminal:

```bash
npm install        # first time only
npm run dev        # development mode with live reload (http://localhost:5173)
npm run build      # production build into dist/
npm run preview    # serve the production build (http://localhost:4173)
```

In Chrome or Edge you can **install it as an app**: use the install icon in the address bar. It then opens in its own window and works offline.

## What's inside

| Area | What it does |
|---|---|
| Today | The trading day in order on one page: pre-session routine → study plan → during the session (tilt status, killzone, pre-trade check, log a trade) → after the close (score the bias, finish journal entries) → weekly review at week's end. The menu groups everything else (Daily · Learn · Practise & review · More) |
| Dashboard | Animated hero with your level and XP, achievements, course progress, quiz accuracy, study streak, journal totals, today's mindset and tilt status, NY session, latest news. **Today's study plan** (one focus concept a day: lesson, reviews, flashcards, chart drills, targeted replay drills, ticking off automatically) and **Today's plan** card (bias, levels, intention, risk) from the pre-session routine, with an after-close reminder to score the bias |
| Explainers | 10 two-minute motion-graphics videos with narration, captions, chapters, speed control and fullscreen (liquidity, premium/discount & OTE, order blocks, fair value gaps, killzones, IPDA ranges, risk & the halving rule, false breakouts, tilt, process over outcome). Each is embedded in its lessons |
| Courses | ICT Mentorship Core Content (55 lessons from the video transcripts) and Trading Psychology (10 lessons). Mark lessons complete, write notes, quiz per lesson |
| Reference | Core rules, concept diagrams, PD array hierarchy, time of day, IPDA, macro and seasonals, ICT's worked trades, 2026 case studies |
| Strategy models | ICT execution models as playbooks (OTE, Turtle soup, Judas swing / Power of 3, Silver Bullet): steps, time windows with a live "open now" indicator, entry/stop/target, invalidation, checklist, lessons, practice links and your results per model. Edit them in `content/models/` |
| Quizzes | 64 questions with spaced repetition (a question comes back after 1, 3, 7, 14, 30, 60 days while you keep getting it right; a miss resets it). "Due for review" mode; history of rounds |
| Flashcards | Glossary terms and your own trade screenshots ("what's the bias and setup here?") on the same spaced schedule as quizzes. Keyboard: Space = show, 1 = didn't know, 2 = knew it |
| Chart drills | Train your eye on real candles: click the FVG, the buy-/sell-side liquidity, the order block or the sweep; call premium/discount. The chart then shows what the detector found. Adaptive mixed mode, accuracy per skill, feeds "Chart eye" in concept mastery |
| My progress | Go-live gates (objective demo → live criteria), "what to work on" (repeated mistakes → the lessons and explainers that fix them), concept mastery (lessons + quiz accuracy + trade expectancy per ICT concept), bias scorecard by market and weekday, and **month-by-month trends** (expectancy, plan followed, bias right, rules kept, drills, study days) |
| My library | Your own notes (Markdown), links, video links, PDFs, images and files, with tags and search |
| Trade journal | Full trade log: prices, auto-calculated R, setup, session, emotions, mistakes, checklist score, screenshots (paste with Ctrl+V). Stats include win rate, expectancy, profit factor, max drawdown, equity curve, and breakdowns by setup, session, market, weekday, mistake, emotion, concept and plan-followed. Plan adherence, MAE/MFE ("R left on the table", losers that were +1R first). CSV export. **Import from broker** (MT4/MT5, cTrader or any CSV) with preview; R comes from prices, or from P/L ÷ your planned risk; times are converted to New York (choose the file's clock: broker NY+7, UTC, local or NY) and the session is set from them. **AI coach review** on any saved trade grades the process and reads your screenshots |
| Edge finder | Where your edge is: weekday × session heatmap, results by New York hour, R distribution, with/against your daily bias, checklist score, every setup × session × bias combination, and your "A+ setups". Every figure has its sample size and a 95% range |
| Pre-session | Guided routine before you open a chart: check-in → risk state (tilt guard) → HTF bias → levels → news → killzone → rules. Saves into the check-in and Daily log |
| Pre-trade check | Before entry: plan (model, prices, why), the model's checklist, up to 2 chart screenshots; the app adds New York time, model window, your daily bias and tilt status. Claude checks the plan against your own model and rules (pass / fail / unclear per item, never a market prediction). Then log the trade prefilled, or record it as skipped |
| Daily log | ICT's Month 1 assignment: daily bias, waiting-for levels, when the day's high and low formed, missed trades, process grade. Bias scorecard: call the direction before the session, record what price did after, track your hit rate. **AI bias review** checks the reasoning behind a scored day |
| Replay trainer | Import OHLC candles (TradingView, MT4/MT5 or any CSV) or generate practice data; start at a random point, call the bias, place an order (click the chart to set prices), step candle by candle (→ / Space), and score the drill in R. Kept separate from the journal. **Targeted drills** start right after a sweep → displacement, a fresh FVG, a new order block or equal highs/lows (results by drill type). **Show ICT structures** overlays FVGs, order blocks, liquidity, sweeps, swings and premium/discount, drawn from candles up to now only. **AI drill review** reads the candles you saw and judges your read |
| Playbook | Per setup: your written definition, your stats, and your model trades (winners taken by the plan, checklist 8+, no mistakes) with screenshots |
| Tools | NY session clock and killzones, setup checklist, position-size calculator (30% allocation and the halving rule), IPDA 20/40/60-day calculator, seasonal calendar |
| News desk | Market snapshot and news items, each linked to the ICT lessons that apply |
| Psychology | Daily check-in (sleep, mood, focus, stress, fear, emotions, intention), tilt guard (reads your journal), personal rules with daily adherence, weekly review, insights (results by emotion and mistake, sleep effect) |
| Practice plan | 12-week task plan built from ICT's homework |
| AI tutor | Claude answers questions from the lesson notes, using your own Anthropic API key (Settings). The same key powers the trade review and the weekly coach (Psychology → Weekly review → "Draft with AI coach") |
| Settings | Account and risk defaults, theme, video folder path, API key, full backup and restore, erase all data |

## Your data

- Everything is stored in your browser's IndexedDB **on this computer** (database `trading-academy`).
- **Automatic backups:** Settings → Automatic backups → choose a folder (ideally one synced by OneDrive, Google Drive or Dropbox). Chrome and Edge then write one backup a day while the app is open and keep the newest 14; after a browser restart, click "Resume backups" on the Dashboard. Other browsers: use Download backup; the Dashboard reminds you after 7 days. Backups include screenshots and attachments but **never your API key**. Clearing browser data deletes the local database, so keep backups.
- The AI features send data to `api.anthropic.com` only when you click them, using the key you enter: the tutor sends your question and the relevant lesson notes; a trade review sends that trade, your active rules and up to 4 of its screenshots; the weekly coach sends that week's trades, check-ins, daily logs, rule check-ins and replay drills; a drill review sends that drill's candles, call, order and notes; a bias review sends that one day of the Daily log. A pre-trade check sends that plan, the model's rules and your ticks, the computed context, your active rules and up to 2 screenshots. Nothing else leaves your machine.

## Adding things

- **New courses, lessons, quizzes, news, reference pages, plans, glossary terms:** add files under `content/`. See [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
- **Your own material without code:** use *My library* in the app.
- **New features:** see "Project layout" below.

## Project layout

```
content/                  all course material (Markdown + JSON), loaded at build time
  courses/<id>/course.json, lessons/*.md, quiz.json
  news/*.json, market-snapshot.json, reference/*.md, plans/*.json, glossary.json
src/
  App.tsx                 navigation + routes (add new pages here)
  pages/                  one file per screen
  components/             shared UI (ui.tsx) and charts
  lib/
    content.ts            loads /content
    db.ts                 local database schema (add tables here; bump the version)
    stats.ts              journal statistics + tilt guard
    learning.ts           concepts, mastery, mistake → lesson fixes, bias scorecard, spaced repetition, go-live gates
    replay.ts             replay trainer: CSV import, practice data, order simulation
    detect.ts             ICT structure detector (swings, FVGs, liquidity, sweeps, order blocks, dealing range)
    exercises.ts          chart drill exercises · scenarios.ts targeted drills · overlay.ts chart overlays
    edge.ts               edge finder statistics
    importTrades.ts       broker statement import
    tradeMath.ts          R from prices
    ipda.ts, time.ts      IPDA trading-day maths, NY clock and killzones
    constants.ts          setups, sessions, emotions, mistakes, checklist, seasonals, tutor model
    ai.ts                 Claude tutor, trade review, weekly coach (Anthropic TypeScript SDK)
    backup.ts             export / import / CSV
tests/
  logic.test.ts           unit tests (npm test)
  e2e.mjs                 browser workflow test (npm run e2e, needs `npm run preview` running)
```

**To add a feature:** create `src/pages/MyFeature.tsx`, add a `<Route>` and a `NAV` entry in `src/App.tsx`. If it stores data, add a table in `src/lib/db.ts` with a new `this.version(2).stores({...})` block and add its name to `TABLES` so backups include it.

**XP, levels and achievements** live in `src/lib/xp.ts` (change point values or add achievements there). Animations and the look are in `src/styles/theme.css` and `src/components/fx.tsx` (icons, confetti, course covers); they switch off automatically when Windows "reduce motion" is on.

**To change your trading vocabulary** (setups, sessions, emotions, mistakes, checklist items, starter rules): edit `src/lib/constants.ts`.

## Disclaimer

Education only, not financial advice. ICT's views (for example, an algorithm "controlling" price) are his opinions, not established fact. Practise on a demo account.
