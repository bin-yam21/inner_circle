import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { SETUPS } from "../lib/constants";
import { CONCEPTS } from "../lib/learning";
import { LessonLink } from "./Progress";
import { fmtR, groupBy, pct } from "../lib/stats";
import type { Trade, TradeImage } from "../lib/types";
import { Empty, PageHead, toast } from "../components/ui";

/** A trade worth studying again: a winner taken by the plan with a strong checklist score. */
export const isModelTrade = (t: Trade) => t.r > 0 && t.followedPlan !== false && (t.checklist == null || t.checklist >= 8) && !t.mistakes.some((m) => m !== "None");

export default function Playbook() {
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const images = useLiveQuery(() => db.images.toArray(), [], []);
  const notes = useLiveQuery(async () => Object.fromEntries((await db.settings.where("key").startsWith("playbook:").toArray()).map((r) => [r.key.slice(9), String(r.value)])), [], {} as Record<string, string>);
  const [open, setOpen] = useState<string | null>(null);
  const stats = useMemo(() => new Map(groupBy(trades, (t) => t.setup).map((g) => [g.key, g])), [trades]);
  const setups = SETUPS.filter((s) => s !== "Other" || stats.has(s));

  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Setup playbook" lede="One page per setup: your own definition, your numbers, and your best examples. Model trades are winners you took by the plan, with a checklist of 8+ and no mistakes. Read the playbook before the session." />
      {setups.map((s) => {
        const g = stats.get(s);
        const models = trades.filter((t) => t.setup === s && isModelTrade(t)).sort((a, b) => (b.checklist ?? 0) - (a.checklist ?? 0) || b.r - a.r);
        const concept = CONCEPTS.find((c) => c.setups.includes(s));
        const isOpen = open === s;
        return (
          <section key={s} className="card stack">
            <button type="button" className="spread playhead" onClick={() => setOpen(isOpen ? null : s)} aria-expanded={isOpen}>
              <h3 style={{ margin: 0 }}>{s}</h3>
              <span className="small muted">{g ? `${g.n} trades · ${pct(g.winRate)} wins · ${fmtR(g.expectancy)}/trade · ${models.length} model` : "no trades yet"} {isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <>
                <SetupNotes setup={s} value={notes[s] ?? ""} />
                {concept && <p className="small muted" style={{ margin: 0 }}>Study: {concept.lessons.slice(0, 3).map((id, i) => <span key={id}>{i ? " · " : ""}<LessonLink id={id} /></span>)}</p>}
                {models.length ? (
                  <div className="thumbs">{models.slice(0, 8).map((t) => <ModelCard key={t.id} t={t} img={images.find((im) => im.tradeId === t.id && im.kind === "before") ?? images.find((im) => im.tradeId === t.id)} />)}</div>
                ) : <Empty>No model trades for this setup yet. They appear here automatically once you log a winner taken by the plan (checklist 8+, no mistakes).</Empty>}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SetupNotes({ setup, value }: { setup: string; value: string }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <div className="stack">
      <label className="field"><span>My definition: what must be true, where I enter, where the stop and target go</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Context: HTF bias + draw on liquidity…\nTrigger: …\nEntry / stop / target: …\nInvalid if: …"} /></label>
      <div><button type="button" className="btn ghost sm" disabled={text === value} onClick={async () => { await db.settings.put({ key: `playbook:${setup}`, value: text }); toast("Playbook saved"); }}>Save definition</button></div>
    </div>
  );
}

function ModelCard({ t, img }: { t: Trade; img?: TradeImage }) {
  const url = useMemo(() => (img ? URL.createObjectURL(img.blob) : null), [img]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <Link to={`/journal/${t.id}`} className="thumb model">
      {url ? <img src={url} alt={`${t.market} ${t.date} chart`} /> : <div className="noimg small muted">No screenshot</div>}
      <div className="cap"><span>{t.market} · {t.date}</span><span className="pos">{fmtR(t.r)}</span></div>
      {t.notes && <p className="small" style={{ margin: "4px 6px 6px" }}>{t.notes.slice(0, 120)}</p>}
    </Link>
  );
}
