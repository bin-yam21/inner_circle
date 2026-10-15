import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, saveSetting, todayStr, uid } from "../lib/db";
import type { CheckIn, Rule, WeeklyReview } from "../lib/types";
import { DEFAULT_RULES, EMOTIONS, RULE_CATEGORIES } from "../lib/constants";
import { fmtR, groupBy, pct, tiltAdvice } from "../lib/stats";
import { Chips, ConfirmButton, Empty, PageHead, SavedCheckbox, Scale, Tabs, toast, useSettings } from "../components/ui";

type Tab = "checkin" | "tilt" | "rules" | "review" | "insights";

export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

export default function Psychology() {
  const [tab, setTab] = useState<Tab>("checkin");
  return (
    <div className="stack">
      <PageHead eyebrow="Mind" title="Psychology" lede={<>Daily check-ins, a tilt guard that reads your journal, your personal rules, and weekly reviews. Study the ideas in the <Link to="/courses/trading-psychology">Trading Psychology course</Link>.</>} />
      <Tabs<Tab> label="Psychology sections" value={tab} onChange={setTab} tabs={[["checkin", "Daily check-in"], ["tilt", "Tilt guard"], ["rules", "My rules"], ["review", "Weekly review"], ["insights", "Insights"]]} />
      {tab === "checkin" && <CheckInPanel />}
      {tab === "tilt" && <TiltPanel />}
      {tab === "rules" && <RulesPanel />}
      {tab === "review" && <ReviewPanel />}
      {tab === "insights" && <InsightsPanel />}
    </div>
  );
}

export const emptyCheckIn = (date: string): CheckIn => ({ date, sleep: 3, mood: 3, focus: 3, stress: 3, fear: 2, emotions: [], intention: "", updatedAt: 0 });

function CheckInPanel() {
  const date = todayStr();
  const saved = useLiveQuery(async () => (await db.checkins.get(date)) ?? null, [date]);
  const history = useLiveQuery(() => db.checkins.orderBy("date").reverse().limit(14).toArray(), [], []);
  const [c, setC] = useState<CheckIn | null>(null);
  useEffect(() => { if (saved !== undefined && !c) setC(saved ?? emptyCheckIn(date)); }, [saved, c, date]);
  if (!c) return null;
  const set = <K extends keyof CheckIn>(k: K, v: CheckIn[K]) => setC({ ...c, [k]: v });
  const warn = c.sleep <= 2 || c.stress >= 4 || c.fear >= 4 || c.emotions.some((e) => ["Revengeful", "FOMO", "Greedy", "Frustrated", "Tired"].includes(e));
  async function save() { await db.checkins.put({ ...c!, updatedAt: Date.now() }); await markActivity(); toast("Check-in saved"); }
  return (
    <div className="stack">
      <section className="card stack">
        <h3 style={{ margin: 0 }}>How are you today? <span className="muted small">{date}</span></h3>
        <div className="grid g3">
          {([["sleep", "Sleep quality"], ["mood", "Mood"], ["focus", "Focus"], ["stress", "Stress"], ["fear", "Fear of losing"]] as const).map(([k, l]) => (
            <div key={k}><p className="small muted" style={{ margin: "0 0 6px" }}>{l} (1 low – 5 high)</p><Scale label={l} value={c[k]} onChange={(n) => set(k, n)} /></div>
          ))}
        </div>
        <div><p className="small muted" style={{ margin: "0 0 6px" }}>What are you feeling?</p><Chips label="Emotions" options={EMOTIONS} value={c.emotions} onChange={(v) => set("emotions", v)} /></div>
        <label className="field"><span>Today's intention (one sentence)</span><input value={c.intention} onChange={(e) => set("intention", e.target.value)} placeholder="e.g. Only trade London open, only A+ setups, stop at −2R" /></label>
        {warn && <div className="alert warn"><b>Caution.</b> <span className="small">Low sleep, high stress or fear, or hot emotions make rule-breaks more likely. Consider half risk, or just studying today.</span></div>}
        <div><button type="button" className="btn" onClick={save}>Save check-in</button></div>
      </section>
      <h2 className="section-title">Last 14 check-ins</h2>
      {history.length ? <div className="tw"><table><thead><tr><th>Date</th><th>Sleep</th><th>Mood</th><th>Focus</th><th>Stress</th><th>Fear</th><th>Emotions</th><th>Intention</th></tr></thead>
        <tbody>{history.map((h) => <tr key={h.date}><td className="n">{h.date}</td><td className="n">{h.sleep}</td><td className="n">{h.mood}</td><td className="n">{h.focus}</td><td className="n">{h.stress}</td><td className="n">{h.fear}</td><td className="small">{h.emotions.join(", ")}</td><td className="small">{h.intention}</td></tr>)}</tbody></table></div>
        : <Empty>Your first check-in will appear here.</Empty>}
    </div>
  );
}

function TiltPanel() {
  const settings = useSettings();
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const today = todayStr();
  const adv = tiltAdvice(trades, today, settings.dailyLossLimitR);
  const todays = trades.filter((t) => t.date === today);
  const risk = settings.accountSize * (settings.allocationPct / 100) * (settings.riskPct / 100);
  return (
    <div className="stack">
      <div className={`alert ${adv.level}`}><b>{adv.level === "ok" ? "All clear." : adv.level === "warn" ? "Reduce risk." : "Stop trading today."}</b> <span>{adv.message}</span></div>
      <div className="grid g3">
        <div className="card stat"><div className="k">Today</div><div className="v">{fmtR(todays.reduce((a, t) => a + t.r, 0))}</div><div className="s">{todays.length} trade{todays.length === 1 ? "" : "s"}</div></div>
        <div className="card stat"><div className="k">Risk for next trade</div><div className="v">${(risk * adv.riskFactor).toFixed(2)}</div><div className="s">Normal ${risk.toFixed(2)} × {adv.riskFactor}</div></div>
        <div className="card"><label className="field"><span>Daily loss limit (R)</span><input type="number" min={0} step={0.5} value={settings.dailyLossLimitR} onChange={(e) => saveSetting("dailyLossLimitR", Number(e.target.value))} /></label></div>
      </div>
      <div className="card"><h3>ICT's recovery rules</h3><ul className="small">
        <li>After a loss, halve the risk on the next trade (2% → 1% → 0.5%). At half size, 2R recovers the loss.</li>
        <li>Late in the week, once a loss is recovered: take it off and close the week flat.</li>
        <li>"Equity preservation is the number one rule." Never increase size to win it back.</li>
      </ul><Link to="/courses/trading-psychology/psy-04" className="btn ghost sm">Lesson: Revenge trading and tilt</Link></div>
    </div>
  );
}

function RulesPanel() {
  const rules = useLiveQuery(() => db.rules.orderBy("order").toArray(), [], []);
  const date = todayStr();
  const check = useLiveQuery(async () => (await db.ruleChecks.get(date)) ?? null, [date]);
  const checks = useLiveQuery(() => db.ruleChecks.toArray(), [], []);
  const [text, setText] = useState(""); const [cat, setCat] = useState(RULE_CATEGORIES[0]);
  const active = rules.filter((r) => r.active);
  async function add() { if (!text.trim()) return; await db.rules.put({ id: uid("r"), text: text.trim(), category: cat, active: true, order: Date.now() }); setText(""); }
  async function seed() { let o = Date.now(); for (const r of DEFAULT_RULES) await db.rules.put({ id: uid("r"), text: r.text, category: r.category, active: true, order: o++ }); toast("Starter rules added"); }
  async function toggleCheck(r: Rule, v: boolean) { await db.ruleChecks.put({ date, followed: { ...(check?.followed ?? {}), [r.id]: v } }); await markActivity(); }
  const adherence = (r: Rule) => { const xs = checks.filter((c) => r.id in c.followed); return xs.length ? pct(xs.filter((c) => c.followed[r.id]).length / xs.length) + ` of ${xs.length} days` : "not tracked yet"; };
  return (
    <div className="stack">
      <section className="card stack">
        <h3 style={{ margin: 0 }}>Did I follow my rules today? <span className="muted small">{date}</span></h3>
        {active.length ? <ul className="check">{active.map((r) => (
          <li key={r.id}><SavedCheckbox id={`rc-${r.id}`} checked={!!check?.followed[r.id]} onChange={(v) => toggleCheck(r, v)} /><label htmlFor={`rc-${r.id}`}>{r.text} <span className="pill">{r.category}</span></label></li>
        ))}</ul> : <Empty>No rules yet. Write your own below, or <button type="button" className="linkbtn" onClick={seed}>add ICT-based starter rules</button>.</Empty>}
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>My rules</h3>
        <div className="form" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,1fr) auto" }}>
          <label className="field"><span>New rule</span><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. I stop for the day at −2R" /></label>
          <label className="field"><span>Category</span><select value={cat} onChange={(e) => setCat(e.target.value)}>{RULE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <div className="field"><span>&nbsp;</span><button type="button" className="btn" onClick={add}>Add rule</button></div>
        </div>
        {rules.length > 0 && <div className="tw"><table><thead><tr><th>Rule</th><th>Category</th><th>Followed</th><th>Active</th><th></th></tr></thead>
          <tbody>{rules.map((r) => <tr key={r.id}><td>{r.text}</td><td>{r.category}</td><td className="small">{adherence(r)}</td>
            <td><SavedCheckbox id={`ra-${r.id}`} label="Active" checked={r.active} onChange={(v) => db.rules.update(r.id, { active: v })} /></td>
            <td><ConfirmButton onConfirm={() => db.rules.delete(r.id)} /></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function ReviewPanel() {
  const week = isoWeek();
  const saved = useLiveQuery(async () => (await db.reviews.get(week)) ?? null, [week]);
  const past = useLiveQuery(() => db.reviews.orderBy("week").reverse().limit(12).toArray(), [], []);
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const settings = useSettings();
  const [r, setR] = useState<WeeklyReview | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => { if (saved !== undefined && !r) setR(saved ?? { week, best: "", worst: "", mistakes: "", lessons: "", nextFocus: "", updatedAt: 0 }); }, [saved, r, week]);
  if (!r) return null;
  const weekTrades = trades.filter((t) => isoWeek(new Date(t.date + "T12:00:00")) === week);
  const set = (k: keyof WeeklyReview, v: string) => setR({ ...r, [k]: v });
  async function save() { await db.reviews.put({ ...r!, updatedAt: Date.now() }); await markActivity(); toast("Review saved"); }
  async function draft() {
    setDraftErr(""); setDrafting(true);
    ctl.current = new AbortController();
    try {
      const data = await weekDataFor(week);
      const { draftWeeklyReview } = await import("../lib/ai");
      const d = await draftWeeklyReview(settings.apiKey, data, ctl.current.signal);
      setR((cur) => cur && { ...cur, ...d });
      toast("Draft ready. Edit it, then save.");
    } catch (e) {
      const { tutorErrorMessage } = await import("../lib/ai");
      setDraftErr(tutorErrorMessage(e));
    } finally { setDrafting(false); }
  }
  return (
    <div className="stack">
      <section className="card stack">
        <div className="spread"><h3 style={{ margin: 0 }}>Week {week}</h3><span className="small muted">{weekTrades.length} trades · {fmtR(weekTrades.reduce((a, t) => a + t.r, 0))}</span></div>
        <div className="form two">
          {([["best", "Best decision this week"], ["worst", "Worst decision this week"], ["mistakes", "Mistakes that repeated"], ["lessons", "What I learned (market & self)"]] as const).map(([k, l]) => (
            <label className="field" key={k}><span>{l}</span><textarea value={r[k]} onChange={(e) => set(k, e.target.value)} /></label>
          ))}
          <label className="field wide"><span>One focus for next week</span><input value={r.nextFocus} onChange={(e) => set("nextFocus", e.target.value)} placeholder="e.g. No entries outside the London killzone" /></label>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={save}>Save review</button>
          {settings.apiKey
            ? (drafting ? <button type="button" className="btn ghost" onClick={() => ctl.current?.abort()}>Drafting… (stop)</button>
              : <button type="button" className="btn ghost" onClick={draft}>Draft with AI coach</button>)
            : <span className="small muted">Add an API key in <Link to="/settings">Settings</Link> to have the AI coach draft this from your week's data.</span>}
        </div>
        {draftErr && <p className="alert stop small" style={{ margin: 0 }}>{draftErr}</p>}
        {settings.apiKey && <p className="small muted" style={{ margin: 0 }}>The coach reads this week's trades, check-ins, bias calls, rule check-ins and replay drills, and fills in the fields above (replacing what's there) for you to edit.</p>}
      </section>
      <h2 className="section-title">Past reviews</h2>
      {past.filter((p) => p.week !== week).length ? past.filter((p) => p.week !== week).map((p) => (
        <details key={p.week} className="card"><summary><b>{p.week}</b>: {p.nextFocus || "no focus set"}</summary>
          <p className="small"><b>Best:</b> {p.best}<br /><b>Worst:</b> {p.worst}<br /><b>Mistakes:</b> {p.mistakes}<br /><b>Lessons:</b> {p.lessons}</p></details>
      )) : <Empty>Past weekly reviews will appear here.</Empty>}
    </div>
  );
}

function InsightsPanel() {
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const checkins = useLiveQuery(() => db.checkins.toArray(), [], []);
  if (trades.length < 3) return <Empty>Insights appear after a few journaled trades that include emotions and mistakes.</Empty>;
  const byEmotion = groupBy(trades, (t) => t.emotionsBefore);
  const byMistake = groupBy(trades, (t) => t.mistakes.filter((m) => m !== "None"));
  const clean = trades.filter((t) => !t.mistakes.length || (t.mistakes.length === 1 && t.mistakes[0] === "None"));
  const ci = new Map(checkins.map((c) => [c.date, c]));
  const withCi = trades.filter((t) => ci.has(t.date));
  const lowSleep = withCi.filter((t) => ci.get(t.date)!.sleep <= 2), goodSleep = withCi.filter((t) => ci.get(t.date)!.sleep >= 4);
  const avg = (xs: typeof trades) => (xs.length ? fmtR(xs.reduce((a, t) => a + t.r, 0) / xs.length) : "–");
  const costliest = byMistake.slice().sort((a, b) => a.totalR - b.totalR)[0];
  return (
    <div className="stack">
      <div className="grid g3">
        <div className="card stat"><div className="k">Rule-clean trades</div><div className="v">{avg(clean)}</div><div className="s">average R over {clean.length} trades with no mistakes</div></div>
        <div className="card stat"><div className="k">Costliest mistake</div><div className="v" style={{ fontSize: 20 }}>{costliest ? costliest.key : "–"}</div><div className="s">{costliest ? `${fmtR(costliest.totalR)} over ${costliest.n} trades` : "No mistakes tagged"}</div></div>
        <div className="card stat"><div className="k">Sleep effect</div><div className="v" style={{ fontSize: 20 }}>{avg(goodSleep)} vs {avg(lowSleep)}</div><div className="s">avg R on good-sleep vs low-sleep days</div></div>
      </div>
      <h2 className="section-title">Results by emotion before entry</h2>
      {byEmotion.length ? <div className="tw"><table><thead><tr><th>Emotion</th><th>Trades</th><th>Win rate</th><th>Expectancy</th></tr></thead><tbody>{byEmotion.map((g) => <tr key={g.key}><td>{g.key}</td><td className="n">{g.n}</td><td className="n">{pct(g.winRate)}</td><td className={`n ${g.expectancy >= 0 ? "pos" : "neg"}`}>{fmtR(g.expectancy)}</td></tr>)}</tbody></table></div> : <Empty>Tag emotions on trades to see this.</Empty>}
      <h2 className="section-title">Results by mistake</h2>
      {byMistake.length ? <div className="tw"><table><thead><tr><th>Mistake</th><th>Trades</th><th>Total R</th></tr></thead><tbody>{byMistake.map((g) => <tr key={g.key}><td>{g.key}</td><td className="n">{g.n}</td><td className={`n ${g.totalR >= 0 ? "pos" : "neg"}`}>{fmtR(g.totalR)}</td></tr>)}</tbody></table></div> : <Empty>No mistakes tagged yet.</Empty>}
    </div>
  );
}

/** This ISO week's data as plain text for the AI weekly coach. */
async function weekDataFor(week: string): Promise<string> {
  const inWeek = (date: string) => isoWeek(new Date(date + "T12:00:00")) === week;
  const [trades, checkins, logs, checks, rules, drills] = await Promise.all([
    db.trades.toArray(), db.checkins.toArray(), db.dailyLogs.toArray(), db.ruleChecks.toArray(), db.rules.toArray(), db.drills.toArray(),
  ]);
  const ts = trades.filter((t) => inWeek(t.date)).sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  const active = rules.filter((r) => r.active);
  const lines = [`Week ${week}`, "", `TRADES (${ts.length}, total ${fmtR(ts.reduce((a, t) => a + t.r, 0))}):`];
  for (const t of ts) lines.push(`- ${t.date} ${t.time ?? ""} ${t.account} ${t.direction} ${t.market} · ${t.setup} · ${t.session} · ${fmtR(t.r)} · checklist ${t.checklist ?? "–"}/10 · plan ${t.followedPlan == null ? "?" : t.followedPlan ? "followed" : "broken"} · emotions ${t.emotionsBefore.join("/") || "–"} · mistakes ${t.mistakes.filter((m) => m !== "None").join("/") || "none"} · notes: ${t.notes.slice(0, 300) || "–"}`);
  lines.push("", "DAILY CHECK-INS (1–5):");
  for (const c of checkins.filter((c) => inWeek(c.date))) lines.push(`- ${c.date}: sleep ${c.sleep}, mood ${c.mood}, focus ${c.focus}, stress ${c.stress}, fear ${c.fear} · ${c.emotions.join("/")} · intention: ${c.intention || "–"}`);
  lines.push("", "DAILY LOG / BIAS CALLS:");
  for (const l of logs.filter((l) => inWeek(l.date))) lines.push(`- ${l.date} ${l.markets}: called ${l.biasDir || "–"}, actual ${l.actualDir || "not recorded"}, level reached ${l.levelHit || "–"} · grade ${l.processGrade || "–"} · ${l.notes.slice(0, 200)} · missed: ${l.missed.slice(0, 150) || "–"}`);
  lines.push("", `RULE CHECK-INS (active rules: ${active.map((r) => r.text).join(" | ") || "none"}):`);
  for (const c of checks.filter((c) => inWeek(c.date))) lines.push(`- ${c.date}: followed ${active.filter((r) => c.followed[r.id]).length}/${active.length}; broken: ${active.filter((r) => !c.followed[r.id]).map((r) => r.text).join(" | ") || "none"}`);
  const ds = drills.filter((d) => inWeek(new Date(d.at).toISOString().slice(0, 10)));
  lines.push("", `REPLAY DRILLS (${ds.length}):`);
  for (const d of ds) lines.push(`- ${d.market}: bias ${d.bias} ${d.biasCorrect == null ? "" : d.biasCorrect ? "(right)" : "(wrong)"} · ${d.outcome}${d.outcome === "win" || d.outcome === "loss" ? " " + fmtR(d.r) : ""} · ${d.notes.slice(0, 150)}`);
  return lines.join("\n");
}
