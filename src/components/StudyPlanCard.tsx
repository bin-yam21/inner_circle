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
    const [progress, answers, trades, drills, spots, cardsDue, stored] = await Promise.all([
      db.progress.toArray(), db.quizAnswers.toArray(), db.trades.toArray(), db.drills.toArray(), db.spotAnswers.toArray(),
      db.cards.where("due").belowOrEqual(today).count(), db.settings.get("studyFocus"),
    ]);
    return { progress, answers, trades, drills, spots, cardsDue, stored: stored?.value as StoredFocus | undefined };
  }, [today]);
  const mastery = data ? conceptMastery(data.progress, data.answers, quiz, data.trades, data.drills, data.spots) : null;
  const fresh = data && data.stored?.date === today ? data.stored : null;

  useEffect(() => {
    if (data && mastery && !fresh) {
      const f = pickFocus(mastery);
      db.settings.put({ key: "studyFocus", value: { date: today, ...f } satisfies StoredFocus });
    }
  }, [data, mastery, fresh, today]);
  if (!data || !mastery || !fresh) return null;

  const dayOf = (ms: number) => todayStr(new Date(ms));
  const plan = buildStudyPlan({
    focus: fresh, mastery,
    lessonsDone: new Set(data.progress.filter((p) => p.done).map((p) => p.lessonId)),
    lessonsDoneToday: new Set(data.progress.filter((p) => p.done && p.doneAt && dayOf(p.doneAt) === today).map((p) => p.lessonId)),
    dueQuiz: data.answers.filter((a) => isDue(a, today)).length, dueCards: data.cardsDue,
    chartToday: data.spots.filter((s) => dayOf(s.at) === today), drillsToday: data.drills.filter((d) => dayOf(d.at) === today),
  });
  const done = plan.tasks.filter((t) => t.done).length;

  return (
    <section className="card study">
      <div className="spread"><h3 style={{ margin: 0 }}>Today's study plan · {plan.focusName}</h3><span className="small muted">{done}/{plan.tasks.length} done</span></div>
      <p className="small muted" style={{ margin: "4px 0 10px" }}>{plan.reason}</p>
      <Bar value={done / plan.tasks.length} />
      <ul className="tasks">
        {plan.tasks.map((t) => (
          <li key={t.id} className={t.done ? "done" : ""}>
            <span className="tick" aria-label={t.done ? "done" : "to do"}>{t.done ? "✓" : ""}</span>
            <span><Link to={t.link}>{t.title}</Link>{t.progress && <span className="small muted"> · {t.progress[0]}/{t.progress[1]}</span>}<br /><span className="small muted">{t.detail}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
