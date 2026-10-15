import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, markActivity, uid } from "../lib/db";
import { EXERCISE_KINDS, EXERCISES, VIEW, exerciseStats, grade, makeExercise, type Exercise, type ExerciseKind, type Graded } from "../lib/exercises";
import { exerciseOverlay } from "../lib/overlay";
import { decimalsFor, syntheticCandles } from "../lib/replay";
import type { Zone } from "../lib/detect";
import type { ReplayDataset } from "../lib/types";
import { pct } from "../lib/stats";
import { CandleChart } from "../components/Charts";
import { Bar, PageHead, Stat } from "../components/ui";
import { LessonLink } from "./Progress";
import { floatXp } from "../components/fx";
import { XP } from "../lib/xp";

type Mode = "mixed" | ExerciseKind;
/** Guards the one-time practice data creation (effects can run twice in development). */
let creatingPractice = false;

/** Mixed mode: half the time your weakest skill, otherwise any exercise type. */
function pickKind(mode: Mode, weakest: ExerciseKind | undefined): ExerciseKind {
  if (mode !== "mixed") return mode;
  if (weakest && Math.random() < 0.5) return weakest;
  return EXERCISE_KINDS[Math.floor(Math.random() * EXERCISE_KINDS.length)];
}

export default function ChartDrills() {
  const datasets = useLiveQuery(() => db.replayData.orderBy("createdAt").reverse().toArray(), []);
  const answers = useLiveQuery(() => db.spotAnswers.toArray(), [], []);
  const [dsId, setDsId] = useState("");
  const [mode, setMode] = useState<Mode>("mixed");
  const [cur, setCur] = useState<{ ex: Exercise; click?: { index: number; price: number }; result?: Graded } | null>(null);
  const [session, setSession] = useState({ right: 0, total: 0 });
  const [notFound, setNotFound] = useState(false);
  const ds: ReplayDataset | undefined = datasets?.find((d) => d.id === dsId) ?? datasets?.[0];
  const stats = useMemo(() => exerciseStats(answers), [answers]);
  const dec = ds ? decimalsFor(ds.candles) : 5;

  // No candle data yet: create practice data once so the drills work straight away.
  useEffect(() => {
    if (datasets && !datasets.length && !creatingPractice) {
      creatingPractice = true;
      db.replayData.put({ id: uid("rd"), name: "Practice data #1", market: "SYNTH", timeframe: "15m", candles: syntheticCandles(3000), createdAt: Date.now() });
    }
  }, [datasets]);

  const next = useCallback((m: Mode = mode) => {
    if (!ds) return;
    const kind = pickKind(m, stats.weakest);
    const ex = makeExercise(ds.candles, kind);
    setNotFound(!ex);
    setCur(ex ? { ex } : null);
  }, [ds, mode, stats.weakest]);

  useEffect(() => { if (ds && !cur && !notFound) next(); }, [ds, cur, notFound, next]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (cur?.result && (e.key === "Enter" || e.key === "n")) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function answer(a: { index: number; price: number } | { zone: Zone }) {
    if (!cur || cur.result || !ds) return;
    const result = grade(cur.ex, ds.candles, a);
    setCur({ ...cur, click: "index" in a ? a : undefined, result });
    setSession((s) => ({ right: s.right + (result.correct ? 1 : 0), total: s.total + 1 }));
    await db.spotAnswers.add({ kind: cur.ex.kind, correct: result.correct, at: Date.now(), datasetId: ds.id });
    await markActivity();
    if (result.correct) floatXp(`+${XP.spotCorrect} XP`);
  }

  if (!datasets || !ds) return <p className="muted">Preparing practice data…</p>;
  const info = cur ? EXERCISES[cur.ex.kind] : null;
  const first = cur ? Math.max(0, cur.ex.end - VIEW + 1) : 0;
  const view = cur ? ds.candles.slice(first, cur.ex.end + 1) : [];
  const total = answers.length, right = answers.filter((a) => a.correct).length;

  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="Chart drills" lede="Train your eye: find fair value gaps, liquidity, order blocks and sweeps on real charts, and judge premium vs discount. After each answer the chart shows what the detector found. The detector follows ICT's definitions mechanically; use it to practise, then apply judgement." />

      <div className="grid g4">
        <Stat icon="eye" k="This session" v={session.total ? `${session.right} / ${session.total}` : "–"} s={session.total ? pct(session.right / session.total) : "Answer to start scoring"} />
        <Stat k="All time" v={total ? pct(right / total) : "–"} s={`${total} answers`} />
        <Stat k="Weakest skill" v={stats.weakest ? EXERCISES[stats.weakest].title : "–"} s={stats.weakest ? <button type="button" className="linkbtn" onClick={() => { setMode(stats.weakest!); next(stats.weakest!); }}>Practise it</button> : "Needs 3+ answers per type"} />
        <div className="card stat"><div className="k">Chart data</div>
          <select value={ds.id} onChange={(e) => { setDsId(e.target.value); setCur(null); setNotFound(false); }} style={{ marginTop: 8 }}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <div className="s"><Link to="/replay">Import real candles</Link> in the Replay trainer</div>
        </div>
      </div>

      <div className="seg" role="group" aria-label="Exercise type">
        {(["mixed", ...EXERCISE_KINDS] as Mode[]).map((m) => (
          <button key={m} type="button" className="btn ghost" aria-pressed={mode === m} onClick={() => { setMode(m); next(m); }}>{m === "mixed" ? "Mixed (adaptive)" : EXERCISES[m].title}</button>
        ))}
      </div>

      {notFound ? (
        <div className="alert warn small">No {mode === "mixed" ? "" : EXERCISES[mode as ExerciseKind].title.toLowerCase() + " "}example found in this data set. Try another type or more candle data. <button type="button" className="linkbtn" onClick={() => next()}>Try again</button></div>
      ) : cur && info && (
        <>
          <div className={`card drill-q ${cur.result ? (cur.result.correct ? "ok" : "bad") : ""}`}>
            <div className="spread"><b>{info.title}</b><span className="small muted">{ds.market} · {ds.timeframe} · {new Date(ds.candles[cur.ex.end].t).toISOString().slice(0, 16).replace("T", " ")} UTC</span></div>
            <p style={{ margin: "6px 0 0" }}>{info.prompt}</p>
          </div>
          <CandleChart candles={view} firstIndex={first} decimals={dec} futureSlots={6}
            onPick={cur.ex.kind !== "pd" && !cur.result ? (price, index) => answer({ index, price }) : undefined}
            overlay={cur.result ? exerciseOverlay(cur.ex, ds.candles, cur.click) : undefined} />
          {cur.ex.kind === "pd" && !cur.result && (
            <div className="row">{(["premium", "equilibrium", "discount"] as Zone[]).map((z) => <button key={z} type="button" className="btn ghost" onClick={() => answer({ zone: z })}>{z[0].toUpperCase() + z.slice(1)}</button>)}</div>
          )}
          {cur.result && (
            <div className={`alert ${cur.result.correct ? "ok" : "stop"}`}>
              <p className="small" style={{ margin: 0 }}>{cur.result.message}</p>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn sm" onClick={() => next()}>Next <span className="kbd">Enter</span></button>
                <span className="small">Study: <LessonLink id={info.lesson} /></span>
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="section-title">Accuracy by skill <span className="small muted">(last 20 answers each)</span></h2>
      <div className="grid g4">
        {EXERCISE_KINDS.map((k) => {
          const s = stats.by.get(k)!;
          return (
            <button key={k} type="button" className="card skill" onClick={() => { setMode(k); next(k); }}>
              <div className="spread"><b className="small">{EXERCISES[k].title}</b><span className="small muted">{s.total ? `${s.right}/${s.total}` : "–"}</span></div>
              <Bar value={s.total ? s.right / s.total : 0} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
