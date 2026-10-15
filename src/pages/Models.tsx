import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { models } from "../lib/content";
import { cellOf, MIN_SAMPLE } from "../lib/edge";
import { fmtR, pct } from "../lib/stats";
import { fmtMinutes, nyNow, windowStatus } from "../lib/time";
import { SCENARIOS, type ScenarioKind } from "../lib/scenarios";
import { PageHead } from "../components/ui";
import { LessonLink } from "./Progress";
import { useNow } from "./Tools";

export default function Models() {
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const now = useNow(30000);
  const ny = nyNow(now);
  const [open, setOpen] = useState<string | null>(models[0]?.id ?? null);

  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Strategy models" lede="ICT's execution models as step-by-step playbooks: when to look, what must be true, where the entry, stop and target go. Tag trades with a model in the journal to see which model works for you. These are summaries of ICT's teaching; where sources differ, trust the lessons and ICT's own material." />
      {models.map((m) => {
        const st = windowStatus(m.windows, ny.minutes);
        const ts = trades.filter((t) => t.model === m.id);
        const c = ts.length ? cellOf(m.id, ts) : null;
        const isOpen = open === m.id;
        return (
          <section key={m.id} className={`card stack model ${st.active ? "live" : ""}`}>
            <button type="button" className="playhead" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}>
              <span><h3 style={{ margin: 0 }}>{m.name}</h3><span className="small muted">{m.source}</span></span>
              <span className="row" style={{ gap: 8 }}>
                <span className={`pill ${st.active ? "g" : ""}`}>{st.active ? `${st.active.label}: open now` : st.next ? `${st.next.window.label} in ${fmtMinutes(st.next.inMinutes)}` : "—"}</span>
                <span className="pill">{c ? `${c.n} trades · ${fmtR(c.expectancy)}` : "no trades yet"}</span>
                <span className="small muted">{isOpen ? "▾" : "▸"}</span>
              </span>
            </button>
            <p style={{ margin: 0 }}>{m.summary}</p>
            {isOpen && (
              <>
                <div className="grid g2">
                  <div>
                    <h4 className="model-h">Steps</h4>
                    <ol className="small">{m.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                    <h4 className="model-h">Time windows (New York)</h4>
                    <ul className="small">{m.windows.map((w) => <li key={w.label}><b>{w.start}–{w.end}</b> {w.label}</li>)}</ul>
                  </div>
                  <div>
                    <table className="small"><tbody>
                      <tr><th>Entry</th><td>{m.entry}</td></tr>
                      <tr><th>Stop</th><td>{m.stop}</td></tr>
                      <tr><th>Target</th><td>{m.target}</td></tr>
                      <tr><th>Invalid if</th><td>{m.invalidation}</td></tr>
                    </tbody></table>
                    <h4 className="model-h">Checklist</h4>
                    <ul className="check small">{m.checklist.map((x) => <li key={x}>☐ {x}</li>)}</ul>
                  </div>
                </div>
                <p className="small" style={{ margin: 0 }}>Study: {m.lessons.map((id, i) => <span key={id}>{i ? " · " : ""}<LessonLink id={id} /></span>)}</p>
                {c && <p className="small" style={{ margin: 0 }}>Your results: {c.n} trades · {pct(c.winRate)} wins · {fmtR(c.expectancy)} per trade{Number.isFinite(c.ci) ? ` (±${c.ci.toFixed(2)}R)` : ""}{c.n < MIN_SAMPLE ? " · small sample" : c.confirmed ? " · a confirmed edge" : ""}</p>}
                <div className="row">
                  <Link className="btn sm" to={`/pretrade?model=${m.id}`}>Pre-trade check with this model</Link>
                  {m.scenario && <Link className="btn ghost sm" to={`/replay?drill=${m.scenario}`}>Practise in replay ({SCENARIOS[m.scenario as ScenarioKind]?.title ?? m.scenario})</Link>}
                  <Link className="btn ghost sm" to={`/journal/new?model=${m.id}`}>Log a trade</Link>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
