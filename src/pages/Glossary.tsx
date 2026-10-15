import { useState } from "react";
import { glossary } from "../lib/content";
import { Empty, PageHead } from "../components/ui";

export default function Glossary() {
  const [q, setQ] = useState("");
  const shown = glossary.filter((g) => !q || (g.term + " " + g.definition).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack">
      <PageHead eyebrow="More" title="Glossary" lede={<>{glossary.length} terms. Add more in <span className="mono">content/glossary.json</span>.</>} />
      <label className="field" style={{ maxWidth: 420 }}><span>Filter terms</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. mitigation" /></label>
      {shown.length ? <dl className="gloss">{shown.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.definition}</dd></div>)}</dl> : <Empty>No term matches "{q}".</Empty>}
    </div>
  );
}
