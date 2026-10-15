import { Link, useNavigate, useParams } from "react-router-dom";
import { reference } from "../lib/content";
import { Empty, Markdown, PageHead } from "../components/ui";

export default function Reference() {
  const { pageId } = useParams();
  const nav = useNavigate();
  const page = reference.find((r) => r.id === pageId) ?? reference[0];
  if (!page) return <Empty>No reference pages yet. Add Markdown files to content/reference.</Empty>;
  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Study reference" lede="The core model on a few pages: rules, drawn concepts, the PD array hierarchy, time of day, IPDA ranges, macro, risk, ICT's worked trades and 2026 case studies." />
      <div className="seg" role="group" aria-label="Reference pages">
        {reference.map((r) => <button key={r.id} type="button" className="btn ghost" aria-pressed={r.id === page.id} onClick={() => nav(`/reference/${r.id}`)}>{r.title}</button>)}
      </div>
      <section className="card"><h2 style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>{page.title}</h2><Markdown md={page.body} /></section>
      <p className="small muted">Pages live in <span className="mono">content/reference/*.md</span>. Edit them or add new ones. <Link to="/glossary">Glossary</Link></p>
    </div>
  );
}
