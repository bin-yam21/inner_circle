import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, todayStr } from "../lib/db";
import type { BiasDir, CheckIn, DailyLog } from "../lib/types";
import { CHECKLIST, EMOTIONS } from "../lib/constants";
import { tiltAdvice } from "../lib/stats";
import { activeZone, fmtMinutes, nextZone, nyNow } from "../lib/time";
import { news } from "../lib/content";
import { Bar, Chips, PageHead, SavedNote, Scale, toast, useAutosave, useSettings } from "../components/ui";
import { celebrate } from "../components/fx";
import { emptyCheckIn } from "./Psychology";
import { useNow } from "./Tools";

const emptyLog = (date: string): DailyLog => ({ date, markets: "", bias: "", waitingFor: "", dailyHigh: "", dailyHighTime: "", dailyLow: "", dailyLowTime: "", notes: "", processGrade: "", missed: "", updatedAt: 0, biasDir: "", actualDir: "", levelHit: "" });
const RED_FLAGS = ["Revengeful", "FOMO", "Greedy", "Frustrated", "Tired"];

/** One guided flow before the session: mind → risk state → bias → levels → news → time → rules. */
export default function Routine() {
  const date = todayStr();
  const settings = useSettings();
  const savedCheckin = useLiveQuery(async () => (await db.checkins.get(date)) ?? null, [date]);
  const savedLog = useLiveQuery(async () => (await db.dailyLogs.get(date)) ?? null, [date]);
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const rules = useLiveQuery(() => db.rules.orderBy("order").toArray(), [], []);
  const [c, setC] = useState<CheckIn | null>(null);
  const [log, setLog] = useState<DailyLog | null>(null);
  const [rulesRead, setRulesRead] = useState(false);
  const [logDirty, setLogDirty] = useState(false);
  const [checkDirty, setCheckDirty] = useState(false);
  // Every field saves on its own, so leaving half-way through loses nothing.
  const logSaved = useAutosave(log, logDirty, (l) => (l ? db.dailyLogs.put({ ...l, updatedAt: Date.now() }) : undefined));
  const checkSaved = useAutosave(c, checkDirty, (v) => (v ? db.checkins.put({ ...v, updatedAt: Date.now() }) : undefined));
  const now = useNow(15000);
  useEffect(() => { if (savedCheckin !== undefined && !c) setC(savedCheckin ?? emptyCheckIn(date)); }, [savedCheckin, c, date]);
  useEffect(() => { if (savedLog !== undefined && !log) setLog(savedLog ?? emptyLog(date)); }, [savedLog, log, date]);
  if (!c || !log) return <p className="muted">Loading…</p>;

  const tilt = tiltAdvice(trades, date, settings.dailyLossLimitR);
  const ny = nyNow(now);
  const zone = activeZone(ny.minutes), nz = nextZone(ny.minutes);
  const flags = c.sleep <= 2 || c.stress >= 4 || c.fear >= 4 || c.emotions.some((e) => RED_FLAGS.includes(e));
  const todaysNews = news.filter((n) => n.date === date);
  const active = rules.filter((r) => r.active);
  const steps = [
    { id: "mind", done: !!savedCheckin?.updatedAt && !!c.intention.trim() },
    { id: "risk", done: true },
    { id: "bias", done: !!log.biasDir && !!log.bias.trim() && !!log.markets.trim() },
    { id: "levels", done: !!log.waitingFor.trim() },
    { id: "news", done: !!log.newsChecked },
    { id: "rules", done: rulesRead || !!savedLog?.routineDoneAt },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const setLogField = <K extends keyof DailyLog>(k: K, v: DailyLog[K]) => { setLog({ ...log, [k]: v }); setLogDirty(true); };
  const setC2 = <K extends keyof CheckIn>(k: K, v: CheckIn[K]) => { setC({ ...c, [k]: v }); setCheckDirty(true); };

  async function saveCheckin() { await db.checkins.put({ ...c!, updatedAt: Date.now() }); await markActivity(); toast("Check-in saved"); }
  async function saveLog(extra: Partial<DailyLog> = {}) { await db.dailyLogs.put({ ...log!, ...extra, updatedAt: Date.now() }); }
  async function finish() {
    if (!c!.intention.trim()) { toast("Write today's intention in step 1"); return; }
    if (!log!.biasDir) { toast("Pick a bias in step 3 (Range is a valid call)"); return; }
    await db.checkins.put({ ...c!, updatedAt: Date.now() });
    await saveLog({ routineDoneAt: Date.now() });
    await markActivity();
    setRulesRead(true);
    celebrate(0.6);
    toast(tilt.level === "stop" ? "Routine saved. The tilt guard says: no trading today." : "Routine done. Trade your plan.");
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Pre-session routine" lede="Do this before you open a chart. Every step saves into your check-in and Daily log, so your bias gets scored and your coach sees it." />
      <div className="card">
        <div className="spread"><b>{savedLog?.routineDoneAt ? `Done today at ${new Date(savedLog.routineDoneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : `${doneCount} of ${steps.length} steps`}</b><span className="small muted">{date} · New York {ny.label} · <SavedNote at={Math.max(logSaved ?? 0, checkSaved ?? 0) || null} /></span></div>
        <Bar value={doneCount / steps.length} />
      </div>

      <Step n={1} title="How am I today?" done={steps[0].done}>
        <div className="form three">
          {([["sleep", "Sleep"], ["mood", "Mood"], ["focus", "Focus"], ["stress", "Stress"], ["fear", "Fear"]] as const).map(([k, l]) => (
            <div key={k}><p className="small muted" style={{ margin: "0 0 6px" }}>{l} (1–5)</p><Scale label={l} value={c[k]} onChange={(n) => setC2(k, n)} /></div>
          ))}
        </div>
        <Chips label="Emotions" options={EMOTIONS} value={c.emotions} onChange={(v) => setC2("emotions", v)} />
        <label className="field"><span>Today's intention (one sentence)</span><input value={c.intention} onChange={(e) => setC2("intention", e.target.value)} placeholder="e.g. Only London open, only A+ setups, stop at −2R" /></label>
        {flags && <p className="alert warn small" style={{ margin: 0 }}>Red flags today (sleep, stress, fear or emotions). Consider half size, or observing only.</p>}
        <div><button type="button" className="btn ghost sm" onClick={saveCheckin}>Save check-in</button></div>
      </Step>

      <Step n={2} title="Risk state" done>
        <div className={`alert ${tilt.level}`}><span className="small">{tilt.message}</span></div>
        <p className="small muted" style={{ margin: 0 }}>Risk for the next trade: ×{tilt.riskFactor} of normal. Position size in <Link to="/tools">Tools</Link>.</p>
      </Step>

      <Step n={3} title="Higher-timeframe bias" done={steps[2].done}>
        <div className="form three">
          <label className="field"><span>Markets</span><input value={log.markets} onChange={(e) => setLogField("markets", e.target.value)} placeholder="EUR/USD, DXY" /></label>
          <label className="field"><span>Bias</span><select value={log.biasDir ?? ""} onChange={(e) => setLogField("biasDir", e.target.value as BiasDir)}><option value="">Choose…</option><option>Bullish</option><option>Bearish</option><option>Range</option></select></label>
          <label className="field"><span>Why</span><input value={log.bias} onChange={(e) => setLogField("bias", e.target.value)} placeholder="Daily OB held; draw = equal highs" /></label>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Ask: where is the draw on liquidity? Is price in premium or discount of the dealing range? What did the last displacement say?</p>
      </Step>

      <Step n={4} title="Levels I'm waiting for" done={steps[3].done}>
        <label className="field"><span>PD arrays and liquidity, with prices</span><textarea value={log.waitingFor} onChange={(e) => setLogField("waitingFor", e.target.value)} placeholder="Bullish OB 1.1195–1.1205 · equal highs 1.1290 · NY open FVG…" /></label>
        <div><button type="button" className="btn ghost sm" onClick={async () => { await saveLog(); toast("Saved to today's Daily log"); }}>Save bias &amp; levels</button></div>
      </Step>

      <Step n={5} title="News check" done={steps[4].done}>
        {todaysNews.length ? <ul className="small">{todaysNews.map((n) => <li key={n.id}><b>{n.title}</b>{n.tag ? ` · ${n.tag}` : ""}</li>)}</ul>
          : <p className="small muted" style={{ margin: 0 }}>No items for today in the News desk. Check your economic calendar for high-impact releases (CPI, NFP, FOMC, rate decisions).</p>}
        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={!!log.newsChecked} onChange={async (e) => { setLogField("newsChecked", e.target.checked); await db.dailyLogs.put({ ...log, newsChecked: e.target.checked, updatedAt: Date.now() }); }} />
          I checked today's calendar and I won't trade the release candle
        </label>
      </Step>

      <Step n={6} title="Time" done>
        <p className="small" style={{ margin: 0 }}>{zone ? <><b>{zone.name}</b> is open now. {zone.note}.</> : <>No killzone now. Next: <b>{nz.zone.name}</b> in {fmtMinutes(nz.inMinutes)}. Wait for it.</>}</p>
      </Step>

      <Step n={7} title="Read my rules and checklist" done={steps[5].done}>
        {active.length ? <ul className="small">{active.map((r) => <li key={r.id}>{r.text}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>No rules yet. Write them in <Link to="/psychology">Psychology → My rules</Link>.</p>}
        <details><summary className="small">Setup checklist ({CHECKLIST.length} items)</summary><ol className="small">{CHECKLIST.map((x) => <li key={x}>{x}</li>)}</ol></details>
        <div><button type="button" className="btn" onClick={finish}>{savedLog?.routineDoneAt ? "Save routine again" : "I've read them: I'm ready"}</button></div>
      </Step>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <section className={`card stack step ${done ? "done" : ""}`}>
      <h3 style={{ margin: 0 }}><span className="stepno">{done ? "✓" : n}</span>{title}</h3>
      {children}
    </section>
  );
}
