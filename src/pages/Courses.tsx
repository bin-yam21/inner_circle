import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courses, lessonKey, lessonsOf, quiz } from "../lib/content";
import { db } from "../lib/db";
import { Bar, PageHead } from "../components/ui";
import { CourseCover } from "../components/fx";

export default function Courses() {
  const progress = useLiveQuery(() => db.progress.toArray(), [], []);
  const done = new Set(progress.filter((p) => p.done).map((p) => p.key));
  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Courses" lede={<>Every course is a folder in <span className="mono">content/courses</span>. Add a folder with a <span className="mono">course.json</span> and Markdown lessons and it appears here (see CONTENT_GUIDE.md). For your own notes, links and PDFs, use <Link to="/library">My library</Link>.</>} />
      <div className="grid g2">
        {courses.map((c) => {
          const ls = lessonsOf(c.id); const d = ls.filter((l) => done.has(lessonKey(l))).length;
          return (
            <Link key={c.id} to={`/courses/${c.id}`} className="card ccard">
              <CourseCover id={c.id} icon={c.icon ?? "book-open"} />
              <p className="eyebrow">{c.subtitle}</p>
              <h3>{c.title}</h3>
              <p className="small" style={{ margin: 0 }}>{c.description}</p>
              <div className="tagrow">{(c.tags ?? []).map((t) => <span key={t} className="pill">{t}</span>)}<span className="pill y">{ls.length} lessons</span><span className="pill">{quiz.filter((q) => q.courseId === c.id).length} quiz questions</span></div>
              <div className="spread small"><span>{d} of {ls.length} complete</span><span>{ls.length ? Math.round((d / ls.length) * 100) : 0}%</span></div>
              <Bar value={ls.length ? d / ls.length : 0} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
