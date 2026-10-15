import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "../lib/db";
import { quiz } from "../lib/content";
import { conceptMastery, isDue } from "../lib/learning";
import { buildStudyPlan, pickFocus } from "../lib/studyPlan";
import { Bar } from "./ui";

/** The day's focus is chosen once and kept (settings key "studyFocus"), so finishing tasks doesn't reshuffle the plan. */
interface StoredFocus { date: string; id: string; reason: string }

export function StudyPlanCard() {
  const today = todayStr();
  const data = useLiveQuery(async () => {
    const [progress, answers, trades, drills, spots, cardsDue, cards, stored] = await Promise.all([
      db.progress.toArray(), db.quizAnswers.toArray(), db.trades.toArray(), db.drills.toArray(), db.spotAnswers.toArray(),
      db.cards.where("due").belowOrEqual(today).count(), db.cards.toArray(), db.settings.get("studyFocus"),
    ]);
    return { progress, answers, trades, drills, spots, cardsDue, cards, stored: stored?.value as StoredFocus | undefined };
  }, [today]);
  const mastery = data ? conceptMastery(data.progress, data.answers, quiz, data.trades, data.drills, data.spots) : null;
  const stored = data && data.stored?.date === today ? data.stored : null;
  // Render with today's stored focus, or pick one now; the effect saves a new pick for the rest of the day.
  const focus = stored ?? (mastery ? { date: today, ...pickFocus(mastery) } : null);

  useEffect(() => {
    if (data && focus && !stored) db.settings.put({ key: "studyFocus", value: focus satisfies StoredFocus });
  }, [data, focus?.id, stored, today]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data || !mastery || !focus) return null;

  const dayOf = (ms: number) => todayStr(new Date(ms));
  const plan = buildStudyPlan({
    focus, mastery,
    lessonsDone: new Set(data.progress.filter((p) => p.done).map((p) => p.lessonId)),
    lessonsDoneToday: new Set(data.progress.filter((p) => p.done && p.doneAt && dayOf(p.doneAt) === today).map((p) => p.lessonId)),
    dueQuiz: data.answers.filter((a) => isDue(a, today)).length, dueCards: data.cardsDue,
    quizToday: data.answers.filter((a) => dayOf(a.at) === today).length, cardsToday: data.cards.filter((c) => dayOf(c.at) === today).length,
    chartToday: data.spots.filter((s) => dayOf(s.at) === today), drillsToday: data.drills.filter((d) => dayOf(d.at) === today),
  });
  const active = plan.tasks.filter((t) => !t.idle);
  const done = active.filter((t) => t.done).length;

  return (
    <section className="card study">
      <div className="spread"><h3 style={{ margin: 0 }}>Today's study plan · {plan.focusName}</h3><span className="small muted">{done}/{active.length} done</span></div>
      <p className="small muted" style={{ margin: "4px 0 10px" }}>{plan.reason}</p>
      <Bar value={active.length ? done / active.length : 1} />
      <ul className="tasks">
        {plan.tasks.map((t) => (
          <li key={t.id} className={t.done ? "done" : t.idle ? "idle" : ""}>
            <span className="tick" aria-label={t.done ? "done" : t.idle ? "nothing to do today" : "to do"}>{t.done ? "✓" : t.idle ? "–" : ""}</span>
            <span><Link to={t.link}>{t.title}</Link>{t.progress && <span className="small muted"> · {t.progress[0]}/{t.progress[1]}</span>}<br /><span className="small muted">{t.detail}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
