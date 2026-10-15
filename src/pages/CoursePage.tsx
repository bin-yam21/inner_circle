import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courseById, lessonKey, lessonsOf, plainText, explainersForLesson } from "../lib/content";
import { db } from "../lib/db";
import { Empty, PageHead } from "../components/ui";

export default function CoursePage() {
  const { courseId = "" } = useParams();
  const course = courseById(courseId);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const progress = useLiveQuery(() => db.progress.where("courseId").equals(courseId).toArray(), [courseId], []);
  if (!course) return <Empty>Course not found. <Link to="/courses">Back to courses</Link></Empty>;
  const done = new Set(progress.filter((p) => p.done).map((p) => p.key));
  const ls = lessonsOf(courseId);
  const number = new Map(ls.map((l, i) => [l.id, i + 1]));
  const match = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase());
  const anyMatch = ls.some((l) => match(l.title + " " + (l.meta ?? "") + " " + plainText(l.body)));
  return (
    <div className="stack">
      <p className="crumb"><Link to="/courses">Courses</Link> · {course.title}</p>
      <PageHead eyebrow={course.subtitle ?? "Course"} title={course.title} lede={course.description} actions={<Link className="btn ghost" to={`/quiz?course=${courseId}`}>Quiz this course</Link>} />
      <label className="field" style={{ maxWidth: 420 }}><span>Search lessons</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. breaker, 0.7512, tilt" /></label>
      {course.modules.map((m) => {
        const items = ls.filter((l) => l.module === m.id);
        const shown = items.filter((l) => match(l.title + " " + (l.meta ?? "") + " " + plainText(l.body)));
        const d = items.filter((l) => done.has(lessonKey(l))).length;
        if (!shown.length) return null;
        return (
          <div className="mod" key={m.id}>
            <h3>{m.title}<span className={`pill ${d === items.length ? "g" : ""}`}>{d}/{items.length} done</span></h3>
            {shown.map((l) => {
              const isDone = done.has(lessonKey(l));
              return (
                <button type="button" key={l.id} className={`lrow ${isDone ? "done" : ""}`} onClick={() => nav(`/courses/${courseId}/${l.id}`)}>
                  <span className="chk" aria-hidden="true">{isDone ? "✓" : ""}</span>
                  <span className="no">{String(number.get(l.id)).padStart(2, "0")}</span>
                  <span className="tt">{l.title}<small>{l.meta}</small></span>
                  {explainersForLesson(courseId, l.id).length > 0 && <span className="pill vid" title="Has a 2-minute explainer video">▶ explainer</span>}
                  <span className="dur">{l.duration}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      {!anyMatch && <Empty>No lesson mentions "{q}".</Empty>}
    </div>
  );
}
