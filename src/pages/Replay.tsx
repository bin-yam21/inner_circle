import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, uid } from "../lib/db";
import type { BiasDir, Direction, Drill, ReplayDataset } from "../lib/types";
import { SETUPS } from "../lib/constants";
import { AiReview } from "../components/AiReview";
import { actualDirection, decimalsFor, drillAsText, parseCandlesCsv, rewardRisk, simulate, syntheticCandles, validateOrder, type Order } from "../lib/replay";
import { fmtR, pct, round } from "../lib/stats";
import { CandleChart } from "../components/Charts";
import { ConfirmButton, Empty, PageHead, Stat, toast } from "../components/ui";
import { Icon, floatXp } from "../components/fx";
import { XP } from "../lib/xp";
import { analyze } from "../lib/detect";
import { analysisOverlay, LAYERS, type Layer } from "../lib/overlay";

const WINDOW = 90;
/** Candles of history shown before the drill starts, and kept free after it. */
const LEAD = 120, TAIL = 60;
type Field = "entry" | "stop" | "target";
interface Session { datasetId: string; start: number; cursor: number; bias: BiasDir; order: Order | null; draft: { direction: Direction; entry: string; stop: string; target: string }; setup: string; notes: string }

const newSession = (ds: ReplayDataset): Session => {
  const max = Math.max(LEAD, ds.candles.length - TAIL);
  const start = LEAD + Math.floor(Math.random() * Math.max(1, max - LEAD));
  return { datasetId: ds.id, start, cursor: start, bias: "", order: null, draft: { direction: "Long", entry: "", stop: "", target: "" }, setup: SETUPS[0], notes: "" };
};
const nameFromFile = (f: string) => f.replace(/\.(csv|txt)$/i, "");
const guessMarket = (name: string) => (name.toUpperCase().match(/[A-Z]{3}[/_-]?[A-Z]{3}|US30|NAS100|SPX500|XAUUSD|DXY/)?.[0] ?? name).replace(/[_-]/, "/");
const guessTf = (name: string) => name.match(/\b(M1|M5|M15|M30|H1|H4|D1|1m|5m|15m|30m|1h|4h|1D|60|240)\b/i)?.[0] ?? "";

export default function Replay() {
  const datasets = useLiveQuery(() => db.replayData.orderBy("createdAt").reverse().toArray(), [], []);
  const drills = useLiveQuery(() => db.drills.orderBy("at").reverse().toArray(), [], []);
  const [s, setS] = useState<Session | null>(null);
  const [picking, setPicking] = useState<Field | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showOv, setShowOv] = useState(false);
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(["fvg", "ob", "liquidity", "sweeps"]));
  const [selected, setSelected] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const reviewDrill = drills.find((d) => d.id === reviewId);
  const reviewData = reviewDrill ? datasets.find((x) => x.id === reviewDrill.datasetId) : undefined;
  const ds = datasets.find((d) => d.id === (s?.datasetId ?? selected)) ?? datasets[0];
  const dec = ds ? decimalsFor(ds.candles) : 5;

  const state = useMemo(() => (s?.order && ds ? simulate(s.order, ds.candles, s.cursor) : null), [s?.order, s?.cursor, ds]);
  const atEnd = !!(s && ds && s.cursor >= ds.candles.length - 1);
  const closed = state?.status === "win" || state?.status === "loss";

  function step(n: number) {
    if (!s || !ds) return;
    if (!s.bias) { toast("Call your bias first: bullish, bearish or range"); setPlaying(false); return; }
    setS({ ...s, cursor: Math.min(ds.candles.length - 1, s.cursor + n) });
  }
  // Autoplay and keyboard: → or Space = next candle.
  useEffect(() => {
    if (!playing) return;
    if (closed || atEnd) { setPlaying(false); return; }
    const t = setTimeout(() => step(1), 280);
    return () => clearTimeout(t);
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!s || (e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); step(e.shiftKey ? 10 : 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function importFile(file: File) {
    const { candles, skipped } = parseCandlesCsv(await file.text());
    if (candles.length < LEAD + TAIL) { toast(`Only ${candles.length} usable candles found; need at least ${LEAD + TAIL}.`); return; }
    const name = nameFromFile(file.name);
    const d: ReplayDataset = { id: uid("rd"), name, market: guessMarket(name), timeframe: guessTf(name), candles, createdAt: Date.now() };
    await db.replayData.put(d);
    setSelected(d.id); setS(null);
    toast(`Imported ${candles.length} candles${skipped ? ` (${skipped} rows skipped)` : ""}`);
  }
  async function generate() {
    const d: ReplayDataset = { id: uid("rd"), name: `Practice data #${(datasets.length || 0) + 1}`, market: "SYNTH", timeframe: "15m", candles: syntheticCandles(3000), createdAt: Date.now() };
    await db.replayData.put(d);
    setSelected(d.id); setS(null);
    toast("Generated 3,000 practice candles");
  }

  function placeOrder(market: boolean) {
    if (!s || !ds) return;
    const close = ds.candles[s.cursor].c;
    const o = { direction: s.draft.direction, entry: market ? close : Number(s.draft.entry), stop: Number(s.draft.stop), target: Number(s.draft.target) };
    if (!s.draft.stop || !s.draft.target || (!market && !s.draft.entry)) { toast("Set entry, stop and target first"); return; }
    const err = validateOrder(o);
    if (err) { toast(err); return; }
    setS({ ...s, order: { ...o, placedIndex: s.cursor, market } });
    setPicking(null);
    toast(market ? "Filled at market" : "Order placed. Step forward to see if it fills.");
  }
  function onPick(price: number) {
    if (!s || !picking || s.order) return;
    setS({ ...s, draft: { ...s.draft, [picking]: String(price) } });
    setPicking(picking === "entry" ? "stop" : picking === "stop" ? "target" : null);
  }

  async function finish() {
    if (!s || !ds) return;
    const moved = s.cursor - s.start;
    const actual = moved >= 8 ? actualDirection(ds.candles, s.start, s.cursor) : "";
    const outcome: Drill["outcome"] = !s.order ? "no-trade" : !state || state.status === "pending" ? "not-filled" : state.status === "open" ? "open" : state.status;
    const d: Drill = {
      id: uid("dr"), datasetId: ds.id, datasetName: ds.name, market: ds.market, timeframe: ds.timeframe,
      startIndex: s.start, endIndex: s.cursor, startTime: ds.candles[s.start].t,
      bias: s.bias, biasCorrect: actual ? actual === s.bias : null,
      direction: s.order?.direction, entry: s.order?.entry ?? null, stop: s.order?.stop ?? null, target: s.order?.target ?? null,
      outcome, r: state && state.status !== "pending" ? state.r : 0, setup: s.order ? s.setup : undefined, notes: s.notes, at: Date.now(),
    };
    await db.drills.put(d);
    await markActivity();
    floatXp(`+${XP.drill} XP`);
    toast(actual ? `Saved. Price was ${actual.toLowerCase()}: your bias was ${d.biasCorrect ? "right" : "wrong"}.` : "Saved. Step at least 8 candles next time to score your bias.");
    setS(null); setPlaying(false);
  }

  const st = useMemo(() => {
    const scored = drills.filter((d) => d.biasCorrect != null);
    const taken = drills.filter((d) => d.outcome === "win" || d.outcome === "loss" || d.outcome === "open");
    const totalR = round(taken.reduce((a, d) => a + d.r, 0));
    return { scored: scored.length, biasRate: scored.length ? scored.filter((d) => d.biasCorrect).length / scored.length : 0, taken: taken.length, wins: taken.filter((d) => d.r > 0).length, totalR, expectancy: taken.length ? round(totalR / taken.length) : 0 };
  }, [drills]);

  const view = s && ds ? ds.candles.slice(Math.max(0, s.cursor - WINDOW + 1), s.cursor + 1) : [];
  const first = s ? Math.max(0, s.cursor - WINDOW + 1) : 0;
  const draftNum = (k: Field) => (s?.draft[k] ? Number(s.draft[k]) : NaN);
  const lines = !s ? [] : (s.order
    ? [{ price: s.order.entry, label: "Entry", cls: "entry" }, { price: s.order.stop, label: "Stop", cls: "stop" }, { price: s.order.target, label: "Target", cls: "target" }]
    : (["entry", "stop", "target"] as Field[]).filter((k) => Number.isFinite(draftNum(k))).map((k) => ({ price: draftNum(k), label: k[0].toUpperCase() + k.slice(1), cls: `${k} draft` })));
  const cur = s && ds ? ds.candles[s.cursor] : null;
  const overlay = showOv && s && ds ? analysisOverlay(analyze(ds.candles, s.cursor, 150), first, layers) : undefined;
  const draftRR = s && !s.order ? (() => { const o = { entry: draftNum("entry"), stop: draftNum("stop"), target: draftNum("target") }; return [o.entry, o.stop, o.target].every(Number.isFinite) && o.entry !== o.stop ? rewardRisk(o) : null; })() : null;

  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Replay trainer" lede="Practise reading price without risking money. Start at a random point, call the bias, plan an order, then step forward candle by candle and see what happens. Dozens of reps a week, instead of a few live setups." />

      <div className="grid g4">
        <Stat icon="rewind" k="Drills" v={drills.length} s={`${st.taken} with a trade`} />
        <Stat icon="target" k="Bias right" v={st.scored ? pct(st.biasRate) : "–"} s={st.scored ? `${st.scored} scored drills` : "Step 8+ candles to score a bias"} />
        <Stat k="Practice result" v={st.taken ? fmtR(st.totalR) : "–"} s={st.taken ? `${pct(st.wins / st.taken)} wins · ${fmtR(st.expectancy)}/trade` : "Place orders in drills"} />
        <div className="card stat"><div className="k">Data</div>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="btn ghost sm"><Icon name="upload" size={14} /> Import CSV<input type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} /></label>
            <button type="button" className="btn ghost sm" onClick={generate}>Generate practice data</button>
          </div>
        </div>
      </div>

      {!datasets.length ? (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Add candle data to start</h3>
          <p className="small">Export OHLC candles as CSV and import the file. Recent 15-minute or 1-hour data for the pairs you study works best:</p>
          <ul className="small">
            <li><b>TradingView:</b> chart → ⋯ menu → <i>Export chart data</i>.</li>
            <li><b>MetaTrader 4/5:</b> Tools → History Center (MT4) or View → Symbols → Bars (MT5) → Export.</li>
            <li>Any CSV with time, open, high, low and close columns.</li>
          </ul>
          <p className="small muted">No data yet? <button type="button" className="linkbtn" onClick={generate}>Generate practice data</button>: random but structured candles, good for practising the workflow (not real market behaviour).</p>
        </div>
      ) : !s ? (
        <div className="card stack">
          <div className="form three">
            <label className="field"><span>Data set</span>
              <select value={ds?.id ?? ""} onChange={(e) => setSelected(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.candles.length} candles</option>)}</select>
            </label>
            <div className="field"><span>{ds && `${ds.market}${ds.timeframe ? ` · ${ds.timeframe}` : ""} · ${new Date(ds.candles[0].t).toISOString().slice(0, 10)} → ${new Date(ds.candles[ds.candles.length - 1].t).toISOString().slice(0, 10)}`}</span>
              <div className="row"><button type="button" className="btn" onClick={() => ds && setS(newSession(ds))}><Icon name="shuffle" size={16} /> Start a drill at a random point</button></div>
            </div>
            <div className="field"><span>&nbsp;</span><div className="row">{ds && <ConfirmButton onConfirm={() => db.replayData.delete(ds.id)}>Delete data set</ConfirmButton>}</div></div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>How a drill works: 1. read the chart and call the bias · 2. optionally plan an order (click the chart to set prices) · 3. step forward with → or Space (Shift+→ = 10 candles) · 4. finish to score it.</p>
        </div>
      ) : ds && cur && (
        <>
          <div className="replay-bar card">
            <div className="small"><b>{ds.market}</b> {ds.timeframe} · <span className="muted">{new Date(cur.t).toISOString().slice(0, 16).replace("T", " ")} UTC · candle {s.cursor - s.start} of drill</span></div>
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={() => step(1)} disabled={atEnd}>Next candle →</button>
              <button type="button" className="btn ghost sm" onClick={() => step(10)} disabled={atEnd}><Icon name="skip-forward" size={14} /> +10</button>
              <button type="button" className="btn ghost sm" onClick={() => (s.bias ? setPlaying(!playing) : toast("Call your bias first"))} disabled={atEnd}><Icon name={playing ? "pause" : "play"} size={14} /> {playing ? "Pause" : "Play"}</button>
              <button type="button" className="btn sm" onClick={finish}>Finish &amp; score</button>
              <ConfirmButton onConfirm={() => setS(null)}>Abandon</ConfirmButton>
            </div>
          </div>

          <div className="row small ovbar">
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={showOv} onChange={(e) => setShowOv(e.target.checked)} /> Show ICT structures</label>
            {showOv && LAYERS.map(([k, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={layers.has(k)} onClick={() => { const n = new Set(layers); if (n.has(k)) n.delete(k); else n.add(k); setLayers(n); }}>{l}</button>
            ))}
            {showOv && <span className="muted">Drawn from candles up to now only. Try your own read first.</span>}
          </div>
          <CandleChart candles={view} firstIndex={first} decimals={dec} lines={lines} markIndex={s.cursor > s.start ? s.start : undefined} onPick={picking && !s.order ? onPick : undefined} overlay={overlay} />
          {picking && !s.order && <p className="alert warn small" style={{ margin: 0 }}>Click the chart to set the <b>{picking}</b> price.</p>}

          <div className="grid g3">
            <div className="card stack">
              <h3 style={{ margin: 0 }}>1 · Bias</h3>
              <div className="seg" role="group" aria-label="Bias">
                {(["Bullish", "Bearish", "Range"] as BiasDir[]).map((b) => <button type="button" key={b} className="btn ghost" aria-pressed={s.bias === b} disabled={s.cursor > s.start} onClick={() => setS({ ...s, bias: b })}>{b}</button>)}
              </div>
              <p className="small muted" style={{ margin: 0 }}>{s.cursor > s.start ? "Locked once you start stepping forward." : "Where is price likely to go next? Think: draw on liquidity, premium/discount, recent displacement."}</p>
            </div>

            <div className="card stack">
              <div className="spread"><h3 style={{ margin: 0 }}>2 · Order</h3>{draftRR != null && <span className="pill">{draftRR.toFixed(1)} : 1</span>}</div>
              {s.order ? (
                <>
                  <p className="small" style={{ margin: 0 }}><b>{s.order.direction}</b> {s.order.market ? "at market" : "limit/stop"} {s.order.entry.toFixed(dec)} · stop {s.order.stop.toFixed(dec)} · target {s.order.target.toFixed(dec)} ({rewardRisk(s.order).toFixed(1)}:1)</p>
                  <div className={`alert ${state?.status === "win" ? "ok" : state?.status === "loss" ? "stop" : "warn"}`}>
                    <span className="small">{state?.status === "pending" ? "Waiting for price to reach your entry." : state?.status === "open" ? <>In the trade: <b>{fmtR(state.r)}</b> open.</> : state?.status === "win" ? <>Target hit: <b>{fmtR(state.r)}</b>. Finish to save.</> : <>Stopped out: <b>−1R</b>. Finish to save.</>}</span>
                  </div>
                  {state?.status === "pending" && <button type="button" className="btn ghost sm" onClick={() => setS({ ...s, order: null })}>Cancel order</button>}
                </>
              ) : (
                <>
                  <div className="form three">
                    <label className="field"><span>Direction</span><select value={s.draft.direction} onChange={(e) => setS({ ...s, draft: { ...s.draft, direction: e.target.value as Direction } })}><option>Long</option><option>Short</option></select></label>
                    <label className="field" style={{ gridColumn: "span 2" }}><span>Setup</span><select value={s.setup} onChange={(e) => setS({ ...s, setup: e.target.value })}>{SETUPS.map((x) => <option key={x}>{x}</option>)}</select></label>
                    {(["entry", "stop", "target"] as Field[]).map((k) => (
                      <div key={k} className="field"><span>{k[0].toUpperCase() + k.slice(1)} <button type="button" className="linkbtn" onClick={() => setPicking(k)} aria-pressed={picking === k} aria-label={`Pick ${k} on chart`}>{picking === k ? "click chart…" : "pick"}</button></span>
                        <input type="number" step="any" aria-label={k[0].toUpperCase() + k.slice(1)} value={s.draft[k]} onChange={(e) => setS({ ...s, draft: { ...s.draft, [k]: e.target.value } })} /></div>
                    ))}
                  </div>
                  <div className="row">
                    <button type="button" className="btn sm" onClick={() => placeOrder(false)}>Place order</button>
                    <button type="button" className="btn ghost sm" onClick={() => placeOrder(true)}>Enter at market ({cur.c.toFixed(dec)})</button>
                  </div>
                </>
              )}
            </div>

            <div className="card stack">
              <h3 style={{ margin: 0 }}>3 · Notes</h3>
              <label className="field"><span>What did you see? What would you do differently?</span><textarea value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} placeholder="Swept Asian low, displaced up, entered the FVG…" /></label>
            </div>
          </div>
        </>
      )}

      <h2 className="section-title">Drill history</h2>
      {drills.length ? (
        <div className="tw"><table className="wide"><thead><tr><th>When</th><th>Data</th><th>Bias</th><th>Trade</th><th>Result</th><th>Notes</th><th></th></tr></thead>
          <tbody>{drills.slice(0, 50).map((d) => (
            <tr key={d.id}>
              <td className="n">{new Date(d.at).toLocaleDateString()}</td>
              <td className="small">{d.datasetName}<br /><span className="muted">{new Date(d.startTime).toISOString().slice(0, 10)} · {d.endIndex - d.startIndex} candles</span></td>
              <td className={d.biasCorrect == null ? "" : d.biasCorrect ? "pos" : "neg"}>{d.bias || "–"}{d.biasCorrect != null && (d.biasCorrect ? " ✓" : " ✗")}</td>
              <td className="small">{d.direction ? `${d.direction} · ${d.setup ?? ""}` : "No trade"}</td>
              <td className={`n ${d.r > 0 ? "pos" : d.r < 0 ? "neg" : ""}`}>{d.outcome === "no-trade" ? "–" : d.outcome === "not-filled" ? "not filled" : `${fmtR(d.r)}${d.outcome === "open" ? " (open)" : ""}`}</td>
              <td className="small">{d.notes.slice(0, 100)}</td>
              <td><div className="row" style={{ flexWrap: "nowrap" }}><button type="button" className="btn ghost sm" aria-pressed={reviewId === d.id} onClick={() => setReviewId(reviewId === d.id ? null : d.id)}>{d.aiReview ? "Review ✓" : "Review"}</button><ConfirmButton onConfirm={() => db.drills.delete(d.id)}>Delete</ConfirmButton></div></td>
            </tr>))}</tbody></table></div>
      ) : null}
      {reviewDrill && (
        <AiReview key={reviewDrill.id} title={`AI review · ${reviewDrill.market} drill, ${new Date(reviewDrill.at).toLocaleDateString()}`} saved={reviewDrill.aiReview} savedAt={reviewDrill.aiReviewAt}
          disabledReason={reviewData ? undefined : "The candle data for this drill was deleted, so it can't be reviewed."}
          intro="Claude reads the candles you saw (80 before your call) and what came after, and checks whether your bias and order were justified by liquidity, premium/discount and PD arrays. Sends the candles, your call, order and notes."
          run={async (key, onText, signal) => (await import("../lib/ai")).reviewDrill(key, drillAsText(reviewDrill, reviewData!.candles), onText, signal)}
          onDone={(text) => db.drills.update(reviewDrill.id, { aiReview: text, aiReviewAt: Date.now() })} />
      )}
      {drills.length ? null : <Empty>Finished drills appear here. Practice results are kept separate from your <Link to="/journal">trade journal</Link>.</Empty>}
    </div>
  );
}
