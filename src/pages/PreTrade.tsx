import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, todayStr, uid } from "../lib/db";
import { modelById, models } from "../lib/content";
import { TIMEFRAMES } from "../lib/constants";
import { planContext, planText } from "../lib/precheck";
import { tiltAdvice } from "../lib/stats";
import { nyNow } from "../lib/time";
import type { Direction, PreCheck, PreCheckVerdict } from "../lib/types";
import { ConfirmButton, Empty, PageHead, toast, useSettings } from "../components/ui";
import { useNow } from "./Tools";

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const DECISION: Record<PreCheckVerdict["decision"], { label: string; cls: string }> = {
  meets_plan: { label: "Meets your plan", cls: "ok" }, partly: { label: "Partly meets your plan", cls: "warn" }, does_not_meet: { label: "Doesn't meet your plan", cls: "stop" },
};
const STATUS_ICON = { pass: "✓", fail: "✗", unclear: "?" } as const;

export default function PreTrade() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const settings = useSettings();
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const rules = useLiveQuery(() => db.rules.toArray(), [], []);
  const todayLog = useLiveQuery(() => db.dailyLogs.get(todayStr()), []);
  const history = useLiveQuery(() => db.preChecks.orderBy("at").reverse().limit(20).toArray(), [], []);
  const now = useNow(30000);

  const [modelId, setModelId] = useState(() => (modelById(params.get("model") ?? "") ? params.get("model")! : models[0]?.id ?? ""));
  const [market, setMarket] = useState("");
  const [direction, setDirection] = useState<Direction>(todayLog?.biasDir === "Bearish" ? "Short" : "Long");
  const [timeframe, setTimeframe] = useState("15m");
  const [prices, setPrices] = useState({ entry: "", stop: "", target: "" });
  const [notes, setNotes] = useState("");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [shots, setShots] = useState<Blob[]>([]);
  const [saved, setSaved] = useState<PreCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ctl = useRef<AbortController | null>(null);

  const model = modelById(modelId);
  const ny = nyNow(now);
  const tilt = tiltAdvice(trades, todayStr(), settings.dailyLossLimitR);
  const ctx = planContext({ ny, model, direction, bias: todayLog?.biasDir, tilt, entry: num(prices.entry), stop: num(prices.stop), target: num(prices.target) });
  const urls = useMemo(() => shots.map((b) => URL.createObjectURL(b)), [shots]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  useEffect(() => { setTicks({}); }, [modelId]);

  // Paste chart screenshots (Ctrl+V / Win+Shift+S).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); setShots((s) => [...s, ...files].slice(0, 2)); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function record(): PreCheck {
    return {
      id: saved?.id ?? uid("pc"), at: Date.now(), date: todayStr(), market: market.trim().toUpperCase(), direction, model: model?.id, timeframe,
      entry: num(prices.entry), stop: num(prices.stop), target: num(prices.target), notes, ticks, context: ctx.lines.join("\n"),
      shot1: shots[0], shot2: shots[1], verdict: saved?.verdict, outcome: "open",
    };
  }
  async function check(useAi: boolean) {
    if (!market.trim()) { toast("Add the market first"); return; }
    if (ctx.rr == null) { toast("Enter entry, stop and target (stop on the losing side)"); return; }
    setErr("");
    const r = record();
    await db.preChecks.put(r);
    setSaved(r);
    await markActivity();
    if (!useAi) { toast("Plan saved"); return; }
    setBusy(true);
    ctl.current = new AbortController();
    try {
      const { preTradeCheck } = await import("../lib/ai");
      const verdict = await preTradeCheck(settings.apiKey, planText(r, model, rules.filter((x) => x.active).map((x) => x.text)), shots, ctl.current.signal);
      await db.preChecks.update(r.id, { verdict });
      setSaved({ ...r, verdict });
    } catch (e) {
      const { tutorErrorMessage } = await import("../lib/ai");
      setErr(tutorErrorMessage(e));
    } finally { setBusy(false); }
  }
  async function skip() {
    if (!saved) return;
    await db.preChecks.update(saved.id, { outcome: "skipped" });
    toast("Recorded as skipped. Skipping a plan that doesn't fit is a good trade too.");
    setSaved(null); setPrices({ entry: "", stop: "", target: "" }); setNotes(""); setTicks({}); setShots([]);
  }

  const v = saved?.verdict;
  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Pre-trade check" lede="Before you enter: write the plan, tick your model's checklist, paste the chart. The app adds the time, your bias and your risk state, and Claude checks whether the plan follows YOUR rules. It's a process check, not a signal: it never says where price will go." />

      <div className="grid g2">
        <section className="card stack">
          <h3 style={{ margin: 0 }}>The plan</h3>
          <div className="form">
            <label className="field" style={{ gridColumn: "span 2" }}><span>Model</span><select value={modelId} onChange={(e) => setModelId(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}<option value="">None</option></select></label>
            <label className="field"><span>Market</span><input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="EUR/USD" /></label>
            <label className="field"><span>Direction</span><select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}><option>Long</option><option>Short</option></select></label>
            <label className="field"><span>Timeframe</span><select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select></label>
            {(["entry", "stop", "target"] as const).map((k) => (
              <label key={k} className="field"><span>{k[0].toUpperCase() + k.slice(1)}</span><input type="number" step="any" value={prices[k]} onChange={(e) => setPrices({ ...prices, [k]: e.target.value })} /></label>
            ))}
          </div>
          <label className="field"><span>Why: bias, draw on liquidity, PD array, time</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Daily bullish, London swept Asian low, entering the 15m FVG in discount, target previous day high" /></label>
          <div className="stack" style={{ gap: 6 }}>
            <div className="spread"><b className="small">Chart screenshots ({shots.length}/2)</b><span className="small muted">Paste with Ctrl+V or choose</span></div>
            <div className="row">
              {urls.map((u, i) => <span key={u} className="thumb"><img src={u} alt={`Chart screenshot ${i + 1}`} /><span className="cap"><span>chart {i + 1}</span><button type="button" className="linkbtn" onClick={() => setShots(shots.filter((_, j) => j !== i))}>remove</button></span></span>)}
              {shots.length < 2 && <label className="btn ghost sm">Add screenshot<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setShots([...shots, f].slice(0, 2)); e.target.value = ""; }} /></label>}
            </div>
          </div>
        </section>

        <section className="card stack">
          <h3 style={{ margin: 0 }}>Checklist{model ? `: ${model.name}` : ""}</h3>
          {model ? (
            <ul className="check">{model.checklist.map((c, i) => (
              <li key={c}><input type="checkbox" id={`pc-${i}`} checked={!!ticks[c]} onChange={(e) => setTicks({ ...ticks, [c]: e.target.checked })} /><label htmlFor={`pc-${i}`}>{c}</label></li>
            ))}</ul>
          ) : <p className="small muted" style={{ margin: 0 }}>No model selected: the check uses your personal rules only.</p>}
          <h3 style={{ margin: "6px 0 0" }}>Context</h3>
          <ul className="small ctx">{ctx.lines.map((l) => <li key={l} className={/AGAINST|CLOSED|STOP|WARN|can't compute/.test(l) ? "neg" : ""}>{l}</li>)}</ul>
          <div className="row">
            {settings.apiKey
              ? (busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Checking… (stop)</button> : <button type="button" className="btn" onClick={() => check(true)}>Check my plan</button>)
              : <><button type="button" className="btn" onClick={() => check(false)}>Save plan</button><span className="small muted">Add an API key in <Link to="/settings">Settings</Link> for the AI check.</span></>}
          </div>
          {err && <p className="alert stop small" style={{ margin: 0 }}>{err}</p>}
        </section>
      </div>

      {saved && (
        <section className={`card stack verdict ${v ? DECISION[v.decision].cls : ""}`}>
          {v ? (
            <>
              <div className="spread"><h3 style={{ margin: 0 }}>{DECISION[v.decision].label}</h3><span className="pill">Process grade {v.grade}</span></div>
              <p style={{ margin: 0 }}>{v.summary}</p>
              <ul className="checks">{v.checks.map((c) => <li key={c.item} className={c.status}><span className="st">{STATUS_ICON[c.status]}</span><span><b>{c.item}</b><br /><span className="small muted">{c.note}</span></span></li>)}</ul>
              {v.concerns.length > 0 && <div className="small"><b>Also watch:</b><ul>{v.concerns.map((c) => <li key={c}>{c}</li>)}</ul></div>}
            </>
          ) : <p style={{ margin: 0 }}>Plan saved{busy ? "; checking…" : "."}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={() => nav(`/journal/new?precheck=${saved.id}`)}>I took it: log the trade</button>
            <button type="button" className="btn ghost" onClick={skip}>I skipped it</button>
          </div>
        </section>
      )}

      <h2 className="section-title">Recent checks</h2>
      {history.length ? (
        <div className="tw"><table className="wide"><thead><tr><th>When</th><th>Plan</th><th>Model</th><th>Check</th><th>Outcome</th><th></th></tr></thead>
          <tbody>{history.map((h) => (
            <tr key={h.id}>
              <td className="n">{new Date(h.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              <td>{h.direction} {h.market}</td><td className="small">{h.model ? modelById(h.model)?.name ?? h.model : "—"}</td>
              <td>{h.verdict ? <span className={`pill ${h.verdict.decision === "meets_plan" ? "g" : h.verdict.decision === "partly" ? "y" : "r"}`}>{DECISION[h.verdict.decision].label} · {h.verdict.grade}</span> : <span className="pill">saved, no AI</span>}</td>
              <td>{h.outcome === "taken" && h.tradeId ? <Link to={`/journal/${h.tradeId}`}>taken</Link> : h.outcome}</td>
              <td><ConfirmButton onConfirm={() => db.preChecks.delete(h.id)}>Delete</ConfirmButton></td>
            </tr>))}</tbody></table></div>
      ) : <Empty>Your checked plans appear here, with whether you took or skipped them.</Empty>}
    </div>
  );
}
