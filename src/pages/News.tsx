import { useState } from "react";
import { Link } from "react-router-dom";
import { findLessonAnywhere, news, snapshot } from "../lib/content";
import type { NewsItem } from "../lib/types";
import { Empty, PageHead } from "../components/ui";

export function NewsCard({ n, compact = false }: { n: NewsItem; compact?: boolean }) {
  const lessons = (n.lessons ?? []).map((id) => findLessonAnywhere(id)).filter(Boolean);
  return (
    <article className="nitem">
      <div className="nm"><span>{n.date}</span>{n.tag && <span className="pill y">{n.tag}</span>}{(n.markets ?? []).map((m) => <span key={m} className="pill">{m}</span>)}</div>
      <h3>{n.title}</h3>
      <p>{n.summary}</p>
      {!compact && n.ict && <div className="ict"><b>ICT lens.</b> {n.ict}</div>}
      {!compact && lessons.length > 0 && (
        <div className="links">{lessons.map((l) => <Link key={l!.id} className="btn ghost sm" to={`/courses/${l!.courseId}/${l!.id}`}>{l!.title}</Link>)}</div>
      )}
      {n.source && <p className="saved" style={{ marginTop: 8 }}>Source: {n.url ? <a href={n.url} target="_blank" rel="noopener noreferrer">{n.source}</a> : n.source}</p>}
    </article>
  );
}

export default function News() {
  const [tag, setTag] = useState("All");
  const tags = ["All", ...new Set(news.map((n) => n.tag).filter(Boolean) as string[])];
  const list = news.filter((n) => tag === "All" || n.tag === tag);
  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="News desk" lede={<>Market events, each linked to the ICT lessons that apply. Use every item as a charting exercise; this is not a signal service. News items are files in <span className="mono">content/news</span>; ask Claude to update them, or add your own.</>} />
      {snapshot && (
        <section>
          <h2 className="section-title">Market snapshot</h2>
          <div className="snap">{snapshot.items.map((x) => <div className="card" key={x.k}><div className="k">{x.k}</div><div className="v">{x.v}</div><div className="s">{x.s}</div></div>)}</div>
          <p className="saved">As of {snapshot.asOf}{snapshot.note ? ` · ${snapshot.note}` : ""}</p>
        </section>
      )}
      <h2 className="section-title">Latest</h2>
      <div className="seg" role="group" aria-label="Filter news">{tags.map((t) => <button key={t} type="button" className="btn ghost" aria-pressed={t === tag} onClick={() => setTag(t)}>{t}</button>)}</div>
      <div className="news">{list.length ? list.map((n) => <NewsCard key={n.id} n={n} />) : <Empty>No news items yet.</Empty>}</div>
    </div>
  );
}
