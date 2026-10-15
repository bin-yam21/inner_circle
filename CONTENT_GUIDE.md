# Content guide

Everything in `content/` is loaded automatically when the app builds. Add or edit files, then restart `npm run dev` (or run `start.bat` again). No code changes are needed.

## Add a course

Create a folder `content/courses/<course-id>/` with:

**`course.json`**
```json
{
  "id": "my-new-course",
  "title": "Course title",
  "subtitle": "Short line under the title",
  "description": "One paragraph about the course.",
  "author": "Who made it",
  "tags": ["price action"],
  "modules": [
    { "id": "m1", "title": "Module 1 · Basics" },
    { "id": "m2", "title": "Module 2 · Advanced" }
  ]
}
```

**`lessons/01-first-lesson.md`**: one file per lesson. The file name only sets sort order; `order` in the frontmatter decides it.
```markdown
---
id: my-01
module: m1
order: 1
title: First lesson
duration: 12 min
meta: Any short note (source, date)
video: optional-video-file-name.mp4
---
Lesson text in **Markdown**. Lists, tables, headings, quotes and even inline HTML work.

## A heading
- point one
- point two
```

**`quiz.json`** (optional)
```json
[
  {
    "lesson": "my-01",
    "q": "Question text?",
    "options": ["A", "B", "C", "D"],
    "answer": 1,
    "explain": "Why B is right."
  }
]
```
`answer` is the 0-based index of the correct option.

## Add news

One file per item in `content/news/`, for example `2026-10-14-cpi.json`:
```json
{
  "date": "2026-10-14",
  "tag": "Data",
  "markets": ["USD", "EUR/USD"],
  "title": "Headline",
  "summary": "What happened, with levels.",
  "ict": "How ICT's rules apply.",
  "lessons": ["ict-43", "psy-04"],
  "source": "Publisher",
  "url": "https://…"
}
```
`lessons` uses lesson ids (from the frontmatter). The market snapshot lives in `content/market-snapshot.json`.

**Tip:** in Claude Code, ask "update the news desk" and Claude will research and write these files for you.

## Reference pages, plans, glossary

- `content/reference/NN-name.md`: frontmatter `id`, `title`, `order`, then Markdown/HTML.
- `content/plans/<id>.json`: `{ "id", "title", "weeks": [{ "title", "tasks": ["…"] }] }`.
- `content/glossary.json`: `[{ "term": "…", "definition": "…" }]`.

## Lesson id conventions

- ICT course: `ict-01` … `ict-55` (teaching order).
- Psychology course: `psy-01` … `psy-10`.

Keep ids stable. Your progress, notes and quiz history are stored against them.

## Explainer videos (motion graphics)

Two-minute narrated animations live in `content/explainers/*.json`. They appear on the **Explainers** page and are embedded at the top of every lesson listed in `lessons`. Narration uses the computer's built-in voices (Microsoft Edge offers the most natural ones), and captions are generated from the same text.

```json
{
  "id": "order-blocks",
  "order": 3,
  "course": "ict-mentorship-2016",
  "lessons": ["ict-27"],
  "title": "Order blocks",
  "subtitle": "The footprint smart money leaves behind",
  "scenes": [
    { "layout": "title", "say": "Opening line spoken over the title card." },
    {
      "title": "Spot the candle",
      "say": "Narration for this scene. The scene lasts as long as it takes to read.",
      "els": [
        { "type": "candles", "walk": [[0, 50], [6, 70], [10, 60]] },
        { "type": "level", "at": 3, "y": 71, "label": "Old high" }
      ]
    }
  ]
}
```

**Scenes.** `say` (required) is the narration. Optional: `title`, `carry` (`true` keeps everything from the previous scene, `"chart"` keeps only candles, levels, zones and stops), `points` (a numbered list on the right), `dur` (seconds, if you want to override the automatic length), and `view` (`{"x":[0,30],"y":[0,100]}` to fix the chart's range).

**Elements.** Every element takes `at`: seconds after the scene starts. Chart coordinates are `x` = candle number and `y` = price, in any units.

| type | what it draws | key fields |
|---|---|---|
| `candles` | candles that form one by one | `walk` waypoints `[[x,y],…]` or exact `ohlc` `[[o,h,l,c],…]` starting at `x`; `stagger` seconds per candle |
| `level` | dashed price line with a label | `y`, `label`, `x1`, `x2`, `color`, `solid` |
| `zone` | shaded price band | `y1`, `y2`, `x1`, `x2`, `label`, `color` |
| `stops` | a pile of resting stop orders | `side` buy/sell, `y`, `x1`, `x2`, `id`, `takenAt` |
| `take` | sweep earlier stops (by `id`) | `id` — the scene must `carry` them |
| `arrow` | curved arrow that draws itself | `from`, `to`, `label`, `bend` |
| `marker` | pulsing dot with label | `x`, `y`, `label`, `below`, `dx` |
| `focus` | glowing box around candles | `x1`, `x2`, `label` |
| `text` | free text on the chart | `x`, `y`, `text`, `size` |
| `flow` | numbered step boxes with arrows | `items: [{label, sub, color}]`, `stagger` |
| `bars` | horizontal bars that grow | `items: [{label, value, text, color}]`, `max` |
| `sessions` | 24-hour New York time line | `items: [{from, to, label, color}]`, `sweep` |
| `big` | large centred statement | `text`, `sub` |

Colors: `bull`, `bear`, `liq`, `accent`, `muted`, `ink`.

**Check your work:** `npm test` validates every explainer: it runs 75–150 seconds, links to lessons that exist, every `take` has stops on screen, and every element starts inside its scene. To see any moment as a still frame, open `#/explainers/<id>?t=<seconds>` in the app.
