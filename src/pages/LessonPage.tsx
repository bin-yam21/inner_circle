import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courseById, explainersForLesson, lessonById, lessonKey, lessonsOf, quiz } from "../lib/content";
import { ExplainerPlayer } from "../components/ExplainerPlayer";
import { db, markActivity } from "../lib/db";
import { Empty, Markdown, toast, useDebounced, useSettings } from "../components/ui";
import { celebrate, floatXp, ReadingProgress } from "../components/fx";
import { XP } from "../lib/xp";

export default function LessonPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const course = courseById(courseId);
  const lesson = lessonById(courseId, lessonId);
  const settings = useSettings();
  const key = `${courseId}:${lessonId}`;
  // undefined = still loading, null = no record yet
  const prog = useLiveQuery(async () => (await db.progress.get(key)) ?? null, [key]);
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null);
  const debounced = useDebounced(draft, 700);
  const notes = draft && draft.key === key ? draft.text : null;
  const setNotes = (text: string) => setDraft({ key, text });

  useEffect(() => { if (notes === null && prog !== undefined) setDraft({ key, text: prog?.notes ?? "" }); }, [prog, notes, key]);
  useEffect(() => {
    if (!debounced || debounced.key !== key || !lesson || prog === undefined) return;
    if ((prog?.notes ?? "") === debounced.text) return;
    db.progress.put({ key, courseId, lessonId, done: prog?.done ?? false, doneAt: prog?.doneAt, notes: debounced.text, updatedAt: Date.now() });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!course || !lesson) return <Empty>Lesson not found. <Link to="/courses">Back to courses</Link></Empty>;
  const ls = lessonsOf(courseId), idx = ls.findIndex((l) => l.id === lessonId);
  const prev = ls[idx - 1], next = ls[idx + 1];
  const mod = course.modules.find((m) => m.id === lesson.module);
  const qs = quiz.filter((q) => q.courseId === courseId && q.lesson === lessonId);
  const done = !!prog?.done;

  async function toggleDone() {
    const now = !done;
    await db.progress.put({ key: lessonKey(lesson!), courseId, lessonId, done: now, doneAt: now ? Date.now() : undefined, notes: notes ?? prog?.notes ?? "", updatedAt: Date.now() });
    if (now) { await markActivity(); celebrate(); floatXp(`+${XP.lesson} XP`); toast("Lesson complete. Nice work!"); }
  }
  const videoPath = lesson.video ? `${settings.videoFolder.replace(/[\\/]+$/, "")}\\${lesson.video}` : "";

  return (
    <div className="stack">
      <ReadingProgress />
      <p className="crumb"><Link to="/courses">Courses</Link> · <Link to={`/courses/${courseId}`}>{course.title}</Link> · {mod?.title} · Lesson {idx + 1} of {ls.length}</p>
      <h1 style={{ margin: 0 }}>{lesson.title}</h1>
      <div className="lmeta">
        {lesson.duration && <span className="pill">{lesson.duration}</span>}
        {lesson.meta && <span className="pill">{lesson.meta}</span>}
        {done && <span className="pill g">Completed</span>}
      </div>
      {videoPath && (
        <p className="saved">Video: <span className="mono">{videoPath}</span>{" "}
          <button type="button" className="linkbtn" onClick={() => navigator.clipboard?.writeText(videoPath).then(() => toast("Path copied"), () => toast("Couldn't copy. Select the path instead."))}>Copy path</button>
        </p>
      )}
      <div className="lbody">
        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          {explainersForLesson(courseId, lessonId).map((ex) => (
            <section key={ex.id} className="lesson-video">
              <p className="eyebrow">2-minute explainer</p>
              <ExplainerPlayer ex={ex} compact endActions={qs.length > 0 && <Link className="btn" to={`/quiz?course=${courseId}&lesson=${lessonId}`}>Quiz this lesson</Link>} />
            </section>
          ))}
          <div className="card"><Markdown md={lesson.body} /></div>
        </div>
        <div className="aside">
          <div className="card"><h3>Progress</h3><button type="button" className={`btn ${done ? "ghost" : "ok"}`} onClick={toggleDone}>{done ? "Mark as not done" : "Mark lesson complete"}</button></div>
          <div className="card">
            <h3>My notes</h3>
            <label className="saved" htmlFor="lnotes">Saved automatically</label>
            <textarea id="lnotes" className="notes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Definitions in your own words, chart examples you found…" />
          </div>
          <div className="card">
            <h3>Practise</h3>
            {qs.length ? <p className="small">{qs.length} quiz question{qs.length > 1 ? "s" : ""} cover this lesson.</p> : <p className="small muted">No quiz questions for this lesson yet.</p>}
            <div className="btns">
              {qs.length > 0 && <Link className="btn ghost" to={`/quiz?course=${courseId}&lesson=${lessonId}`}>Quiz this lesson</Link>}
              <Link className="btn ghost" to={`/tutor?lesson=${courseId}:${lessonId}`}>Ask the tutor</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="pager">
        {prev ? <Link className="btn ghost" to={`/courses/${courseId}/${prev.id}`}>← {prev.title}</Link> : <span />}
        {next && <Link className="btn" to={`/courses/${courseId}/${next.id}`}>{next.title} →</Link>}
      </div>
    </div>
  );
}
