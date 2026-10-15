import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, todayStr } from "../lib/db";
import { glossary } from "../lib/content";
import { cardQueue, CONCEPTS, conceptsOfTrade, scheduleReview, SRS_INTERVALS } from "../lib/learning";
import { fmtR } from "../lib/stats";
import type { Trade, TradeImage } from "../lib/types";
import { Empty, PageHead, Stat, Tabs } from "../components/ui";
import { celebrate } from "../components/fx";

type Deck = "all" | "glossary" | "charts";
const NEW_PER_SESSION = 10;

/** Trade screenshot cards: every trade with a "before" screenshot. */
function useChartCards() {
  return useLiveQuery(async () => {
    const imgs = (await db.images.toArray()).filter((i) => i.kind === "before");
    const first = new Map<string, TradeImage>();
    for (const im of imgs) if (!first.has(im.tradeId)) first.set(im.tradeId, im);
    const trades = await db.trades.bulkGet([...first.keys()]);
    const after = imgs.length ? await db.images.where("tradeId").anyOf([...first.keys()]).toArray() : [];
    return trades.filter((t): t is Trade => !!t).map((t) => ({ trade: t, before: first.get(t.id)!, after: after.find((a) => a.tradeId === t.id && a.kind === "after") }));
  }, [], []);
}

export default function Flashcards() {
  const today = todayStr();
  const states = useLiveQuery(() => db.cards.toArray(), [], []);
  const charts = useChartCards();
  const [deck, setDeck] = useState<Deck>("all");
  const [session, setSession] = useState<{ queue: string[]; i: number; shown: boolean; right: number } | null>(null);

  const glossaryKeys = useMemo(() => glossary.map((g) => `g:${g.term}`), []);
  const chartKeys = useMemo(() => charts.map((c) => `t:${c.trade.id}`), [charts]);
  const keys = deck === "glossary" ? glossaryKeys : deck === "charts" ? chartKeys : [...chartKeys, ...glossaryKeys];
  const queue = cardQueue(keys, states, today, NEW_PER_SESSION);
  const dueCount = queue.filter((k) => states.some((s) => s.key === k)).length;
  const seen = new Set(states.map((s) => s.key));
  const mastered = states.filter((s) => s.box >= 4 && keys.includes(s.key)).length;

  useEffect(() => { setSession(null); }, [deck]);
  const key = session && session.i < session.queue.length ? session.queue[session.i] : null;

  async function grade(knew: boolean) {
    if (!session || !key) return;
    const prev = await db.cards.get(key);
    const next = scheduleReview(prev, knew, today);
    await db.cards.put({ key, ...next, correct: knew, at: Date.now(), reviews: (prev?.reviews ?? 0) + 1 });
    await markActivity();
    const right = session.right + (knew ? 1 : 0);
    if (session.i + 1 >= session.queue.length && right / session.queue.length >= 0.8) celebrate(0.7);
    setSession({ ...session, i: session.i + 1, shown: false, right });
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session || !key || (e.target as HTMLElement).closest("input, textarea, select")) return;
      if (!session.shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setSession({ ...session, shown: true }); }
      else if (session.shown && e.key === "1") grade(false);
      else if (session.shown && e.key === "2") grade(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Flashcards" lede={`Glossary terms and your own chart screenshots, on a spaced schedule: a card you know comes back after ${SRS_INTERVALS.join(", ")} days; one you miss comes back tomorrow. Up to ${NEW_PER_SESSION} new cards a session.`} />
      <div className="grid g4">
        <Stat icon="zap" k="Due today" v={dueCount} s={`${Math.max(0, queue.length - dueCount)} new cards ready`} />
        <Stat k="Seen" v={`${keys.filter((k) => seen.has(k)).length} / ${keys.length}`} s="cards in this deck" />
        <Stat k="Well known" v={mastered} s="reached the 14-day box or later" />
        <Stat k="Chart cards" v={charts.length} s={charts.length ? "from trades with a \"before\" screenshot" : <Link to="/journal/new">Add screenshots to trades</Link>} />
      </div>
      <Tabs<Deck> label="Deck" value={deck} onChange={setDeck} tabs={[["all", "All cards"], ["glossary", `Glossary (${glossaryKeys.length})`], ["charts", `My charts (${chartKeys.length})`]]} />

      {!session ? (
        <div className="card stack">
          {queue.length ? <p style={{ margin: 0 }}><b>{queue.length}</b> card{queue.length > 1 ? "s" : ""} to study: {dueCount} due for review, {queue.length - dueCount} new.</p>
            : <p className="muted" style={{ margin: 0 }}>{keys.length ? "Nothing due. Come back tomorrow." : deck === "charts" ? "No chart cards yet. Add a \"before\" screenshot to a trade in the journal." : "No cards in this deck."}</p>}
          <div><button type="button" className="btn" disabled={!queue.length} onClick={() => setSession({ queue, i: 0, shown: false, right: 0 })}>Start studying</button></div>
        </div>
      ) : key ? (
        <div className="card flash stack">
          <div className="qtop"><span>Card {session.i + 1} of {session.queue.length} · {session.right} known</span><span>{seen.has(key) ? "review" : "new"}</span></div>
          <CardView cardKey={key} shown={session.shown} charts={charts} />
          {!session.shown
            ? <div><button type="button" className="btn" onClick={() => setSession({ ...session, shown: true })}>Show answer <span className="kbd">Space</span></button></div>
            : <div className="row"><button type="button" className="btn ghost" onClick={() => grade(false)}>Didn't know <span className="kbd">1</span></button><button type="button" className="btn ok" onClick={() => grade(true)}>Knew it <span className="kbd">2</span></button></div>}
        </div>
      ) : (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Session done: {session.right} / {session.queue.length} known</h3>
          <p className="small muted" style={{ margin: 0 }}>Missed cards come back tomorrow.</p>
          <div className="row"><button type="button" className="btn ghost" onClick={() => setSession(null)}>Back to decks</button></div>
        </div>
      )}
      {!session && !glossary.length && <Empty>No glossary terms found in content/glossary.json.</Empty>}
    </div>
  );
}

function CardView({ cardKey, shown, charts }: { cardKey: string; shown: boolean; charts: { trade: Trade; before: TradeImage; after?: TradeImage }[] }) {
  if (cardKey.startsWith("g:")) {
    const term = glossary.find((g) => g.term === cardKey.slice(2));
    if (!term) return <p className="muted">This term is no longer in the glossary.</p>;
    return (
      <>
        <p className="eyebrow" style={{ margin: 0 }}>Define</p>
        <h2 className="flash-front">{term.term}</h2>
        {shown && <p className="flash-back">{term.definition}</p>}
      </>
    );
  }
  const c = charts.find((x) => x.trade.id === cardKey.slice(2));
  if (!c) return <p className="muted">This trade or its screenshot was deleted.</p>;
  const t = c.trade;
  return (
    <>
      <p className="eyebrow" style={{ margin: 0 }}>{t.market} · {t.timeframe} · {t.session}</p>
      <h3 style={{ margin: 0 }}>What's the bias, the draw on liquidity, and the setup here?</h3>
      <BlobImg blob={c.before.blob} alt="Chart before the trade" />
      {shown && (
        <div className="flash-back stack">
          <p style={{ margin: 0 }}><b>{t.direction} · {t.setup}</b> → <span className={t.r >= 0 ? "pos" : "neg"}>{fmtR(t.r)}</span> · {t.date}</p>
          <p className="small" style={{ margin: 0 }}>Concepts: {conceptsOfTrade(t).map((id) => CONCEPTS.find((x) => x.id === id)?.name ?? id).join(", ") || "—"}</p>
          {t.notes && <p className="small" style={{ margin: 0 }}>{t.notes}</p>}
          {c.after && <BlobImg blob={c.after.blob} alt="Chart after the trade" />}
          <Link className="small" to={`/journal/${t.id}`}>Open the trade</Link>
        </div>
      )}
    </>
  );
}

function BlobImg({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className="flash-img" src={url} alt={alt} />;
}
