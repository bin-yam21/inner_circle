import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courses, lessonById, quiz } from "../lib/content";
import type { QuizQuestion } from "../lib/types";
import { db, markActivity, todayStr } from "../lib/db";
import { Empty, PageHead } from "../components/ui";
import { celebrate, floatXp } from "../components/fx";
import { XP } from "../lib/xp";
import { isDue, scheduleReview, SRS_INTERVALS } from "../lib/learning";

const ROUND = 10;
const qKey = (q: QuizQuestion) => `${q.courseId}:${q.index}`;
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((x) => x[1]);

export default function Quiz() {
  const [params, setParams] = useSearchParams();
  const course = params.get("course") ?? "all";
  const lesson = params.get("lesson") ?? "";
  const missedOnly = params.get("missed") === "1";
  const dueOnly = params.get("due") === "1";
  const answers = useLiveQuery(() => db.quizAnswers.toArray(), [], []);
  const rounds = useLiveQuery(() => db.quizRounds.orderBy("id").reverse().limit(20).toArray(), [], []);
  const wrong = useMemo(() => new Set(answers.filter((a) => !a.correct).map((a) => a.key)), [answers]);
  const today = todayStr();
  const due = useMemo(() => new Set(answers.filter((a) => isDue(a, today)).map((a) => a.key)), [answers, today]);

  const pool = quiz.filter((q) => (course === "all" || q.courseId === course) && (!lesson || q.lesson === lesson) && (!missedOnly || wrong.has(qKey(q))) && (!dueOnly || due.has(qKey(q))));
  const [round, setRound] = useState<{ ids: string[]; i: number; score: number; picked: number | null; sig: string } | null>(null);
  const sig = `${course}|${lesson}|${missedOnly}|${dueOnly}`;
  const active = round && round.sig === sig ? round : null;

  const start = () => setRound({ ids: shuffle(pool).slice(0, ROUND).map(qKey), i: 0, score: 0, picked: null, sig });
  const cur = active && active.i < active.ids.length ? quiz.find((q) => qKey(q) === active.ids[active.i]) : undefined;

  async function pick(j: number) {
    if (!active || !cur || active.picked !== null) return;
    const ok = j === cur.answer;
    const prev = await db.quizAnswers.get(qKey(cur));
    await db.quizAnswers.put({ key: qKey(cur), courseId: cur.courseId, index: cur.index, correct: ok, wrongCount: (prev?.wrongCount ?? 0) + (ok ? 0 : 1), at: Date.now(), ...scheduleReview(prev, ok, todayStr()) });
    await markActivity();
    if (ok) floatXp(`+${XP.quizCorrect} XP`);
    setRound({ ...active, picked: j, score: active.score + (ok ? 1 : 0) });
  }
  async function nextQ() {
    if (!active) return;
    const i = active.i + 1;
    if (i >= active.ids.length) {
      const label = (lesson ? lessonById(course, lesson)?.title : course === "all" ? "All courses" : courses.find((c) => c.id === course)?.title) + (missedOnly ? " (missed)" : dueOnly ? " (review)" : "");
      await db.quizRounds.add({ date: todayStr(), label: label ?? "Quiz", score: active.score, total: active.ids.length });
      if (active.score / active.ids.length >= 0.8) celebrate(active.score === active.ids.length ? 1.4 : 0.8);
    }
    setRound({ ...active, i, picked: null });
  }
  const set = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k === "course") p.delete("lesson"); setParams(p); };
  const setMode = (m: string) => { const p = new URLSearchParams(params); p.delete("missed"); p.delete("due"); if (m) p.set(m, "1"); setParams(p); };
  const inCourse = (key: string) => course === "all" || key.startsWith(course + ":");
  const dueCount = [...due].filter(inCourse).length;

  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Quizzes" lede={`${quiz.length} questions across ${courses.length} courses. Spaced repetition brings each question back after ${SRS_INTERVALS.join(", ")} days as you keep getting it right; a miss resets it to tomorrow.`} />
      <div className="form three card">
        <label className="field"><span>Course</span>
          <select value={course} onChange={(e) => set("course", e.target.value === "all" ? null : e.target.value)}>
            <option value="all">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="field"><span>Questions</span>
          <select value={dueOnly ? "due" : missedOnly ? "missed" : ""} onChange={(e) => setMode(e.target.value)}>
            <option value="">All questions</option>
            <option value="due">Due for review today ({dueCount})</option>
            <option value="missed">Only ones I missed ({quiz.filter((q) => wrong.has(qKey(q)) && (course === "all" || q.courseId === course)).length})</option>
          </select>
        </label>
        <div className="field"><span>{lesson ? `Lesson: ${lessonById(course, lesson)?.title ?? lesson}` : `${pool.length} questions in this set`}</span>
          <div className="row">{lesson && <button type="button" className="btn ghost sm" onClick={() => set("lesson", null)}>All lessons</button>}<button type="button" className="btn" onClick={start} disabled={!pool.length}>Start a round</button></div>
        </div>
      </div>

      <div className="card qcard">
        {!active ? <p className="muted">{pool.length ? `Press "Start a round" for up to ${ROUND} random questions.` : missedOnly ? "No missed questions here. Nice work." : dueOnly ? "Nothing due today. Come back tomorrow, or start a normal round." : "No questions in this set."}</p>
          : cur ? (
            <>
              <div className="qtop"><span>Question {active.i + 1} of {active.ids.length} · score {active.score}</span><span>{courses.find((c) => c.id === cur.courseId)?.title}</span></div>
              <h3 style={{ marginTop: 10, fontSize: 18 }}>{cur.q}</h3>
              <div className="qopts">
                {cur.options.map((o, j) => {
                  const cls = active.picked === null ? "" : j === cur.answer ? "right" : j === active.picked ? "wrong" : "";
                  return <button key={j} type="button" className={`qopt ${cls}`} disabled={active.picked !== null} onClick={() => pick(j)}>{o}</button>;
                })}
              </div>
              {active.picked !== null && (
                <>
                  <div className="qexp"><b>{active.picked === cur.answer ? "Correct." : "Not quite."}</b> {cur.explain}</div>
                  <div className="btns">
                    <button type="button" className="btn" onClick={nextQ}>{active.i + 1 < active.ids.length ? "Next question" : "Finish round"}</button>
                    <Link className="btn ghost" to={`/courses/${cur.courseId}/${cur.lesson}`}>Open lesson: {lessonById(cur.courseId, cur.lesson)?.title}</Link>
                  </div>
                </>
              )}
            </>
          ) : (
            <><h3>Round complete: {active.score} / {active.ids.length}</h3><p className="muted">{active.score === active.ids.length ? "Perfect round." : "Missed questions are saved. Reread those lessons, then review them."}</p>
              <div className="btns"><button type="button" className="btn" onClick={start}>New round</button><button type="button" className="btn ghost" onClick={() => set("missed", "1")}>Review missed</button></div></>
          )}
      </div>

      <h2 className="section-title">History</h2>
      {rounds.length ? (
        <div className="tw"><table><thead><tr><th>Date</th><th>Set</th><th>Score</th></tr></thead>
          <tbody>{rounds.map((r) => <tr key={r.id}><td className="n">{r.date}</td><td>{r.label}</td><td className="n">{r.score}/{r.total} ({Math.round((r.score / r.total) * 100)}%)</td></tr>)}</tbody></table></div>
      ) : <Empty>Finish a round to see it here.</Empty>}
    </div>
  );
}
