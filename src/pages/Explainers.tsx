import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courseById, explainerById, explainers, lessonById } from "../lib/content";
import { buildTimeline, fmtTime, type Explainer } from "../lib/explainer";
import { db } from "../lib/db";
import { ExplainerPlayer } from "../components/ExplainerPlayer";
import { ExplainerStage } from "../components/ExplainerStage";
import { Empty, PageHead } from "../components/ui";
import { Icon } from "../components/fx";

export default function Explainers() {
  const { explainerId } = useParams();
  const watched = useLiveQuery(() => db.watched.toArray(), [], []);
  const seen = new Set(watched.map((w) => w.id));
  const ex = explainerId ? explainerById(explainerId) : undefined;
  const [params] = useSearchParams();
  const frame = params.get("t");

  if (explainerId && !ex) return <Empty>Explainer not found. <Link to="/explainers">All explainers</Link></Empty>;
  if (ex && frame !== null) return <FreezeFrame ex={ex} t={Number(frame)} />;
  if (ex) {
    const idx = explainers.indexOf(ex), next = explainers[idx + 1];
    return (
      <div className="stack">
        <p className="crumb"><Link to="/explainers">Explainers</Link> · {courseById(ex.course)?.title}</p>
        <h1 style={{ margin: 0 }}>{ex.title}</h1>
        {ex.subtitle && <p className="lede" style={{ marginTop: -6 }}>{ex.subtitle}</p>}
        <ExplainerPlayer key={ex.id} ex={ex} endActions={next && <Link className="btn" to={`/explainers/${next.id}`}>Next: {next.title}</Link>} />
        <div className="card">
          <h3>Go deeper</h3>
          <p className="small muted">This explainer summarises these lessons. The full notes, quizzes and the original video paths are on each lesson page.</p>
          <div className="btns">
            {ex.lessons.map((l) => { const ls = lessonById(ex.course, l); return ls && <Link key={l} className="btn ghost" to={`/courses/${ex.course}/${l}`}>{ls.title}</Link>; })}
          </div>
        </div>
      </div>
    );
  }

  const groups = [...new Set(explainers.map((e) => e.course))];
  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Explainers" lede={<>Two-minute animated videos with narration for the main concepts. Watch one before the lesson, then read the notes. {seen.size}/{explainers.length} watched. Add your own as JSON files in <span className="mono">content/explainers</span>.</>} />
      {!explainers.length && <Empty>No explainers yet.</Empty>}
      {groups.map((g) => (
        <section key={g} className="stack" style={{ gap: 12 }}>
          <h2 className="section-title">{courseById(g)?.title ?? g}</h2>
          <div className="grid g3">
            {explainers.filter((e) => e.course === g).map((e) => <Thumb key={e.id} ex={e} seen={seen.has(e.id)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Thumb({ ex, seen }: { ex: Explainer; seen: boolean }) {
  const tl = useMemo(() => buildTimeline(ex), [ex]);
  // freeze-frame from the middle of the second scene, where the first chart is drawn
  const s = tl.scenes[Math.min(2, tl.scenes.length - 1)];
  return (
    <Link to={`/explainers/${ex.id}`} className="card ccard xthumb">
      <div className="xthumb-img">
        <ExplainerStage ex={ex} tl={tl} t={s.start + s.dur * 0.85} />
        <span className="xthumb-play"><Icon name="play" size={22} /></span>
        <span className="xthumb-dur">{fmtTime(tl.total)}</span>
        {seen && <span className="xthumb-seen"><Icon name="check" size={13} /> Watched</span>}
      </div>
      <h3>{ex.title}</h3>
      {ex.subtitle && <span className="small muted">{ex.subtitle}</span>}
    </Link>
  );
}

/** /explainers/:id?t=42 shows a single frozen frame (for checking scenes or linking to a moment). */
function FreezeFrame({ ex, t }: { ex: Explainer; t: number }) {
  const tl = useMemo(() => buildTimeline(ex), [ex]);
  return <div className="xthumb-img" style={{ maxWidth: 1280 }}><ExplainerStage ex={ex} tl={tl} t={Math.min(t, tl.total - 0.01)} /></div>;
}
