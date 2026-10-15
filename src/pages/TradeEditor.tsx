import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, todayStr, uid } from "../lib/db";
import type { Trade, TradeImage } from "../lib/types";
import { EMOTIONS, MISTAKES, SESSIONS, SETUPS, TIMEFRAMES } from "../lib/constants";
import { CONCEPTS, conceptsOfTrade } from "../lib/learning";
import { CHECKLIST } from "../lib/constants";
import { lessons, modelById, models } from "../lib/content";
import { fmtR } from "../lib/stats";
import { Chips, ConfirmButton, Empty, PageHead, toast } from "../components/ui";
import { AiReview } from "../components/AiReview";

const conceptName = (id: string) => CONCEPTS.find((c) => c.id === id)?.name ?? id;
const conceptId = (name: string) => CONCEPTS.find((c) => c.name === name)?.id ?? name;

const blank = (): Trade => ({
  id: uid("t"), date: todayStr(), time: "", market: "", direction: "Long", setup: SETUPS[0], timeframe: "15m", session: SESSIONS[1],
  entry: null, stop: null, target: null, exit: null, size: null, r: 0, pnl: null, checklist: null,
  emotionsBefore: [], emotionsAfter: [], mistakes: [], notes: "", lesson: "", account: "Demo", followedPlan: null, mae: null, mfe: null, concepts: [], createdAt: Date.now(), updatedAt: Date.now(),
});
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export { calcRFromPrices as calcR } from "../lib/tradeMath";
import { calcRFromPrices as calcR } from "../lib/tradeMath";

export default function TradeEditor() {
  const { tradeId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const existing = useLiveQuery(async () => (tradeId ? (await db.trades.get(tradeId)) ?? null : null), [tradeId]);
  const preCheckId = tradeId ? null : params.get("precheck");
  const pre = useLiveQuery(async () => (preCheckId ? (await db.preChecks.get(preCheckId)) ?? null : null), [preCheckId]);
  const [t, setT] = useState<Trade | null>(null);
  const [rText, setRText] = useState("");
  const images = useLiveQuery(() => (t ? db.images.where("tradeId").equals(t.id).toArray() : []), [t?.id], []);
  const [zoom, setZoom] = useState<string | null>(null);
  const rules = useLiveQuery(() => db.rules.toArray(), [], []);

  useEffect(() => {
    if (tradeId && existing === undefined) return;
    if (preCheckId && pre === undefined) return;
    if (tradeId && existing === null) { setT(null); return; }
    // A new trade can be preset from a link: ?model=<id> (Models page) or ?precheck=<id> (pre-trade check).
    const preset = modelById(pre?.model ?? params.get("model") ?? "");
    const fromCheck: Partial<Trade> = pre ? {
      market: pre.market, direction: pre.direction, timeframe: pre.timeframe, entry: pre.entry, stop: pre.stop, target: pre.target, notes: pre.notes,
      preCheckId: pre.id, preCheckDecision: pre.verdict?.decision ?? "manual", checklist: preset ? Math.round((preset.checklist.filter((c) => pre.ticks[c]).length / preset.checklist.length) * 10) : null,
    } : {};
    const base = existing ?? { ...blank(), ...(preset ? { model: preset.id, setup: preset.setups[0] ?? SETUPS[0] } : {}), ...fromCheck };
    setT(base); setRText(existing ? String(existing.r) : "");
  }, [existing, tradeId, pre]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paste screenshots straight from the clipboard (Ctrl+V / Win+Shift+S).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!t) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addImages(files, "before"); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const urls = useMemo(() => new Map(images.map((im) => [im.id!, URL.createObjectURL(im.blob)])), [images]);
  useEffect(() => () => { urls.forEach((u) => URL.revokeObjectURL(u)); }, [urls]);

  if (tradeId && existing === null) return <Empty>Trade not found. <Link to="/journal">Back to journal</Link></Empty>;
  if (!t) return <p className="muted">Loading…</p>;

  const set = <K extends keyof Trade>(k: K, v: Trade[K]) => setT({ ...t, [k]: v });
  const auto = calcR(t);

  async function addImages(files: File[] | FileList, kind: TradeImage["kind"]) {
    if (!t) return;
    for (const f of [...files]) if (f.type.startsWith("image/")) await db.images.add({ tradeId: t.id, kind, blob: f, caption: f.name });
    toast("Screenshot added");
  }
  async function save() {
    if (!t) return;
    const r = rText.trim() === "" ? auto : Number(rText);
    if (!t.market.trim()) { toast("Add the market (e.g. EUR/USD)"); return; }
    if (r == null || Number.isNaN(r)) { toast("Enter the result in R, or entry, stop and exit prices"); return; }
    await db.trades.put({ ...t, market: t.market.trim().toUpperCase(), r, updatedAt: Date.now() });
    // First save of a trade from a pre-trade check: its screenshots become the "before" images, and the check is marked as taken.
    if (!existing && pre && t.preCheckId === pre.id) {
      for (const b of [pre.shot1, pre.shot2]) if (b) await db.images.add({ tradeId: t.id, kind: "before", blob: b, caption: "pre-trade check" });
      await db.preChecks.update(pre.id, { outcome: "taken", tradeId: t.id });
    }
    await markActivity();
    toast("Trade saved");
    nav("/journal");
  }
  async function remove() {
    if (!t) return;
    await db.images.where("tradeId").equals(t.id).delete();
    await db.trades.delete(t.id);
    toast("Trade deleted"); nav("/journal");
  }
  const numField = (label: string, k: "entry" | "stop" | "target" | "exit" | "size" | "pnl" | "mae" | "mfe") => (
    <label className="field"><span>{label}</span><input type="number" step="any" value={t[k] ?? ""} onChange={(e) => set(k, num(e.target.value))} /></label>
  );

  return (
    <div className="stack">
      <p className="crumb"><Link to="/journal">Journal</Link> · {existing ? "Edit trade" : "New trade"}</p>
      <PageHead eyebrow="Trade" title={existing ? `${t.market || "Trade"} · ${t.date}` : "Log a trade"} actions={existing ? <ConfirmButton onConfirm={remove}>Delete trade</ConfirmButton> : undefined} />

      <section className="card">
        <h3>Trade</h3>
        <div className="form">
          <label className="field"><span>Date</span><input type="date" value={t.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="field"><span>Time (NY)</span><input type="time" value={t.time ?? ""} onChange={(e) => set("time", e.target.value)} /></label>
          <label className="field"><span>Market</span><input value={t.market} onChange={(e) => set("market", e.target.value)} placeholder="EUR/USD" /></label>
          <label className="field"><span>Direction</span><select value={t.direction} onChange={(e) => set("direction", e.target.value as Trade["direction"])}><option>Long</option><option>Short</option></select></label>
          <label className="field"><span>Setup</span><select value={t.setup} onChange={(e) => set("setup", e.target.value)}>{SETUPS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Model</span><select value={t.model ?? ""} onChange={(e) => set("model", e.target.value || undefined)}><option value="">None</option>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="field"><span>Timeframe</span><select value={t.timeframe} onChange={(e) => set("timeframe", e.target.value)}>{TIMEFRAMES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Session</span><select value={t.session} onChange={(e) => set("session", e.target.value)}>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Account</span><select value={t.account} onChange={(e) => set("account", e.target.value as Trade["account"])}><option>Demo</option><option>Live</option></select></label>
        </div>
      </section>

      <section className="card">
        <h3>Prices &amp; result</h3>
        <div className="form">
          {numField("Entry", "entry")}{numField("Stop", "stop")}{numField("Target", "target")}{numField("Exit", "exit")}
          {numField("Size (lots)", "size")}{numField("P/L (money)", "pnl")}
          <label className="field"><span>Result (R){auto != null ? ` · calculated ${auto}R` : ""}</span><input type="number" step="0.01" value={rText} onChange={(e) => setRText(e.target.value)} placeholder={auto != null ? String(auto) : "e.g. 3 or -1"} /></label>
          <label className="field"><span>Checklist score (0–10)</span><input type="number" min={0} max={10} value={t.checklist ?? ""} onChange={(e) => set("checklist", num(e.target.value))} /></label>
        </div>
        <p className="keynote">Leave Result empty to use the value calculated from entry, stop and exit.</p>
      </section>

      <section className="card stack">
        <h3>Execution</h3>
        <div className="form">
          <label className="field"><span>Did I follow my plan?</span>
            <select value={t.followedPlan == null ? "" : t.followedPlan ? "yes" : "no"} onChange={(e) => set("followedPlan", e.target.value === "" ? null : e.target.value === "yes")}>
              <option value="">Not recorded</option><option value="yes">Yes, as planned</option><option value="no">No, I broke it</option>
            </select>
          </label>
          {numField("Max against me (MAE, R)", "mae")}
          {numField("Max in my favour (MFE, R)", "mfe")}
        </div>
        <p className="keynote">MAE/MFE: the furthest price went against you and in your favour while the trade was open, in R (e.g. 0.4 and 2.5). They show whether your stops are too tight and how much you leave on the table.</p>
        <div><p className="small muted" style={{ margin: "0 0 6px" }}>ICT concepts used {t.setup !== "Other" && <>(your setup already counts toward {conceptsOfTrade({ setup: t.setup, concepts: [] }).map(conceptName).join(", ") || "none"})</>}</p>
          <Chips label="Concepts used" options={CONCEPTS.map((c) => c.name)} value={(t.concepts ?? []).map(conceptName)} onChange={(v) => set("concepts", v.map(conceptId))} />
        </div>
      </section>

      <section className="card stack">
        <h3>Mind</h3>
        <div><p className="small muted" style={{ margin: "0 0 6px" }}>Emotions before entry</p><Chips label="Emotions before" options={EMOTIONS} value={t.emotionsBefore} onChange={(v) => set("emotionsBefore", v)} /></div>
        <div><p className="small muted" style={{ margin: "0 0 6px" }}>Emotions after exit</p><Chips label="Emotions after" options={EMOTIONS} value={t.emotionsAfter} onChange={(v) => set("emotionsAfter", v)} /></div>
        <div><p className="small muted" style={{ margin: "0 0 6px" }}>Mistakes</p><Chips label="Mistakes" options={MISTAKES} value={t.mistakes} onChange={(v) => set("mistakes", v)} /></div>
        <label className="field"><span>Why I took it / what I learned</span><textarea value={t.notes} onChange={(e) => set("notes", e.target.value)} placeholder="HTF bias, draw on liquidity, PD array, time of day, what I'd do differently…" /></label>
      </section>

      <section className="card stack">
        <div className="spread"><h3 style={{ margin: 0 }}>Screenshots</h3><span className="small muted">Paste with Ctrl+V, or choose files</span></div>
        <div className="row">
          <label className="btn ghost sm">Add "before" image<input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addImages(e.target.files, "before")} /></label>
          <label className="btn ghost sm">Add "after" image<input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addImages(e.target.files, "after")} /></label>
        </div>
        {images.length ? (
          <div className="thumbs">{images.map((im) => (
            <div className="thumb" key={im.id}>
              <img src={urls.get(im.id!)} alt={`${im.kind} screenshot`} onClick={() => setZoom(urls.get(im.id!) ?? null)} />
              <div className="cap"><span>{im.kind}</span><button type="button" className="linkbtn" onClick={() => db.images.delete(im.id!)}>remove</button></div>
            </div>))}
          </div>
        ) : <p className="small muted">No screenshots yet.</p>}
      </section>

      {existing && (
        <AiReview saved={existing.aiReview} savedAt={existing.aiReviewAt}
          intro="Claude grades the process (not the result) against your checklist and rules, reads your screenshots, and names the lessons to restudy. Sends the saved trade, your active rules and up to 4 screenshots. Save the trade first if you changed it."
          run={async (key, onText, signal) => (await import("../lib/ai")).reviewTrade(key, {
            summary: tradeSummary(existing, rules.filter((r) => r.active).map((r) => r.text)),
            images: images.map((im) => ({ kind: im.kind, blob: im.blob })),
            lessonTitles: lessons.map((l) => l.title),
          }, onText, signal)}
          onDone={(text) => db.trades.update(existing.id, { aiReview: text, aiReviewAt: Date.now() })} />
      )}

      <div className="row"><button type="button" className="btn" onClick={save}>Save trade</button><Link className="btn ghost" to="/journal">Cancel</Link></div>
      {zoom && <div className="lightbox" onClick={() => setZoom(null)} role="button" tabIndex={0} onKeyDown={() => setZoom(null)}><img src={zoom} alt="Screenshot full size" /></div>}
    </div>
  );
}

/** Plain-text description of a trade for the AI coach. */
export function tradeSummary(t: Trade, rules: string[]): string {
  const v = (x: unknown) => (x == null || x === "" ? "—" : String(x));
  return [
    `Trade: ${t.direction} ${t.market} on ${t.date}${t.time ? ` at ${t.time} New York` : ""} (${t.account} account)`,
    `Setup: ${t.setup} · model ${t.model ? modelById(t.model)?.name ?? t.model : "none"} · timeframe ${t.timeframe} · session ${t.session}`,
    `Prices: entry ${v(t.entry)}, stop ${v(t.stop)}, target ${v(t.target)}, exit ${v(t.exit)} · result ${fmtR(t.r)}`,
    `Checklist score: ${t.checklist == null ? "not scored" : `${t.checklist}/10`} · followed plan: ${t.followedPlan == null ? "not recorded" : t.followedPlan ? "yes" : "no"}`,
    `MAE ${v(t.mae)}R · MFE ${v(t.mfe)}R`,
    `Concepts: ${conceptsOfTrade(t).map(conceptName).join(", ") || "—"}`,
    `Emotions before: ${t.emotionsBefore.join(", ") || "—"} · after: ${t.emotionsAfter.join(", ") || "—"}`,
    `Mistakes the trader tagged: ${t.mistakes.filter((m) => m !== "None").join(", ") || "none"}`,
    `Trader's notes: ${t.notes || "(none)"}`,
    "",
    "The trader's checklist:", ...CHECKLIST.map((c, i) => `${i + 1}. ${c}`),
    "",
    "The trader's active rules:", ...(rules.length ? rules.map((r) => `- ${r}`) : ["(none written)"]),
  ].join("\n");
}
