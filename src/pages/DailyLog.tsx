import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, todayStr } from "../lib/db";
import type { BiasDir, DailyLog as Log } from "../lib/types";
import { biasStats } from "../lib/learning";
import { pct, weekday } from "../lib/stats";
import { AiReview } from "../components/AiReview";
import { Empty, PageHead, SavedNote, Stat, toast, useAutosave } from "../components/ui";

const DIRS: BiasDir[] = ["Bullish", "Bearish", "Range"];

const empty = (date: string): Log => ({ date, markets: "", bias: "", waitingFor: "", dailyHigh: "", dailyHighTime: "", dailyLow: "", dailyLowTime: "", notes: "", processGrade: "", missed: "", updatedAt: 0, biasDir: "", actualDir: "", levelHit: "" });

export default function DailyLog() {
  const [date, setDate] = useState(todayStr());
  const saved = useLiveQuery(async () => (await db.dailyLogs.get(date)) ?? null, [date]);
  const all = useLiveQuery(() => db.dailyLogs.toArray(), [], []);
  const recent = all.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const bs = biasStats(all);
  const [log, setLog] = useState<Log | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setLog(null); }, [date]);
  useEffect(() => { if (saved !== undefined && !log) setLog(saved ?? empty(date)); }, [saved, log, date]);
  // Typing saves on its own; switching days saves the current one first.
  const persist = (l: Log | null) => (l ? db.dailyLogs.put({ ...l, updatedAt: Date.now() }) : undefined);
  const savedAt = useAutosave(log, dirty, persist);
  async function changeDate(d: string) { if (dirty) await persist(log); setDirty(false); setDate(d); }

  const set = (k: keyof Log, v: string) => { if (log) { setLog({ ...log, [k]: v }); setDirty(true); } };
  const dirSelect = (k: "biasDir" | "actualDir", label: string, blank: string) => (
    <label className="field"><span>{label}</span><select value={log?.[k] ?? ""} onChange={(e) => set(k, e.target.value)}><option value="">{blank}</option>{DIRS.map((d) => <option key={d}>{d}</option>)}</select></label>
  );
  async function save() { if (!log) return; await db.dailyLogs.put({ ...log, updatedAt: Date.now() }); await markActivity(); toast("Daily log saved"); }
  const f = (k: keyof Log, label: string, ph = "", type = "text") => (
    <label className="field"><span>{label}</span><input type={type} value={String(log?.[k] ?? "")} onChange={(e) => set(k, e.target.value)} placeholder={ph} /></label>
  );

  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Daily log" lede="ICT's Month 1 assignment: every day, record when the high and low formed, the levels you're waiting for, and what happened. It is the fastest way to learn price delivery." />
      <div className="grid g4">
        <Stat icon="target" k="Bias hit rate" v={bs.scored ? pct(bs.hitRate) : "–"} s={bs.scored ? `${bs.hits} right of ${bs.scored} scored day${bs.scored === 1 ? "" : "s"}` : "Set bias, then fill in what price did"} />
        <Stat k="Last 20 days" v={bs.last20.n ? pct(bs.last20.hitRate) : "–"} s={bs.streak ? `${bs.streak} right in a row` : "Is your read improving?"} />
        <Stat k="Price reached my level" v={bs.levelChecked ? pct(bs.levelHitRate) : "–"} s={bs.levelChecked ? `${bs.levelChecked} days checked` : "Answer after the session"} />
        <div className="card stat"><div className="k">Last 30 calls</div>
          <div className="dots" aria-label="Recent bias calls, oldest first">{bs.recent.length ? bs.recent.map((r) => <i key={r.date} className={r.hit ? "hit" : "miss"} title={`${r.date}: ${r.hit ? "right" : "wrong"}`} />) : <span className="s">No scored days yet</span>}</div>
        </div>
      </div>
      <section className="card stack">
        <div className="form">
          <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => changeDate(e.target.value)} /></label>
          {f("markets", "Markets studied", "EUR/USD, DXY")}
          {dirSelect("biasDir", "My bias (before the session)", "Choose…")}
          {f("bias", "Why (draw on liquidity, PD array)", "Daily OB held, draw = equal highs")}
          {f("processGrade", "Process grade (A–F)", "B")}
          {f("dailyHigh", "Day's high", "1.1265")}{f("dailyHighTime", "High formed at (NY)", "", "time")}
          {f("dailyLow", "Day's low", "1.1210")}{f("dailyLowTime", "Low formed at (NY)", "", "time")}
        </div>
        <label className="field"><span>Levels I'm waiting for (PD arrays, liquidity)</span><textarea value={log?.waitingFor ?? ""} onChange={(e) => set("waitingFor", e.target.value)} placeholder="Bullish OB 1.1195–1.1205 · equal highs 1.1290 · NY open FVG…" /></label>
        <div className="form three">
          {dirSelect("actualDir", "What price actually did (after close)", "Not known yet")}
          <label className="field"><span>Did price reach the level I expected?</span><select value={log?.levelHit ?? ""} onChange={(e) => set("levelHit", e.target.value)}><option value="">Not checked</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <div className="field"><span>Result</span><p className="small" style={{ margin: "8px 0 0" }}>{log?.biasDir && log.actualDir ? (log.biasDir === log.actualDir ? <span className="pos">✓ Bias was right</span> : <span className="neg">✗ Bias was wrong: review what you missed</span>) : <span className="muted">Scored once both directions are filled in</span>}</p></div>
        </div>
        <div className="form two">
          <label className="field"><span>What happened / notes</span><textarea value={log?.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Judas swing at 02:40 swept Asian low, London ran to…" /></label>
          <label className="field"><span>Missed or skipped trades</span><textarea value={log?.missed ?? ""} onChange={(e) => set("missed", e.target.value)} placeholder="Setups that worked without me, and why I didn't take them" /></label>
        </div>
        <div className="row"><button type="button" className="btn" onClick={save} disabled={!log}>Save day</button><SavedNote at={savedAt} /><span className="small muted">Changes save automatically.</span></div>
      </section>
      {saved?.biasDir && saved.actualDir && (
        <AiReview key={saved.date} title="AI review of my bias" saved={saved.aiReview} savedAt={saved.aiReviewAt}
          intro="Claude checks the reasoning behind your call (draw on liquidity, premium/discount, PD arrays, time of day) against what price did, and whether a wrong call came from weak reasoning or just the market. Sends this saved day only."
          run={async (key, onText, signal) => (await import("../lib/ai")).reviewBias(key, dayAsText(saved), onText, signal)}
          onDone={(text) => db.dailyLogs.update(saved.date, { aiReview: text, aiReviewAt: Date.now() })} />
      )}

      <h2 className="section-title">Recent days</h2>
      {recent.length ? (
        <div className="tw"><table className="wide"><thead><tr><th>Date</th><th>Markets</th><th>Call</th><th>Actual</th><th>Bias notes</th><th>High (time)</th><th>Low (time)</th><th>Grade</th><th>Notes</th></tr></thead>
          <tbody>{recent.map((l) => (
            <tr key={l.date} className="click" tabIndex={0} onClick={() => changeDate(l.date)} onKeyDown={(e) => e.key === "Enter" && changeDate(l.date)}>
              <td className="n">{l.date}</td><td>{l.markets}</td><td>{l.biasDir || "–"}</td><td className={l.biasDir && l.actualDir ? (l.biasDir === l.actualDir ? "pos" : "neg") : ""}>{l.actualDir || "–"}</td><td className="small">{l.bias}</td><td className="n">{l.dailyHigh} {l.dailyHighTime && `(${l.dailyHighTime})`}</td><td className="n">{l.dailyLow} {l.dailyLowTime && `(${l.dailyLowTime})`}</td><td className="n">{l.processGrade}</td><td className="small">{l.notes.slice(0, 120)}</td>
            </tr>))}</tbody></table></div>
      ) : <Empty>Your logged days will appear here. Click a row to reopen it.</Empty>}
    </div>
  );
}

/** One saved day as text for the AI bias review. */
export function dayAsText(l: Log): string {
  const v = (x?: string) => (x && x.trim()) || "—";
  return [
    `Date: ${l.date} (${weekday(l.date)}) · markets: ${v(l.markets)}`,
    `Bias called before the session: ${v(l.biasDir)} · why: ${v(l.bias)}`,
    `Levels I was waiting for: ${v(l.waitingFor)}`,
    `What price actually did: ${v(l.actualDir)} · price reached my level: ${l.levelHit === "yes" ? "yes" : l.levelHit === "no" ? "no" : "not checked"}`,
    `Day's high ${v(l.dailyHigh)} at ${v(l.dailyHighTime)} New York · low ${v(l.dailyLow)} at ${v(l.dailyLowTime)} New York`,
    `What happened: ${v(l.notes)}`,
    `Missed or skipped trades: ${v(l.missed)}`,
    `My process grade: ${v(l.processGrade)}`,
  ].join("\n");
}
