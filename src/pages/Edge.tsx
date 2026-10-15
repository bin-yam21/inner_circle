import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { modelById } from "../lib/content";
import { aPlusSetups, byModel, byPreCheck, byAlignment, byChecklist, byHour, combos, heatmap, logsByDate, matchesAPlus, MIN_SAMPLE, rDistribution, cellOf, type Cell } from "../lib/edge";
import { fmtR, pct } from "../lib/stats";
import type { Trade } from "../lib/types";
import { Empty, PageHead, Stat, Tabs } from "../components/ui";

type Acct = "All" | "Demo" | "Live";
const ci = (c: Cell) => (Number.isFinite(c.ci) ? `±${c.ci.toFixed(2)}R` : "too few trades");
const tipText = (label: string, c: Cell) => `${label}: ${fmtR(c.expectancy)} per trade (${Number.isFinite(c.ci) ? `${ci(c)}, 95%` : "too few trades to judge"}) · ${c.n} trade${c.n === 1 ? "" : "s"} · ${pct(c.winRate)} wins · total ${fmtR(c.totalR)}`;

/** Diverging fill: green above 0, red below, neutral surface at 0; full strength at ±1R. Small samples get half strength. */
const heat = (e: number, thin = false) => {
  const p = Math.round((Math.min(1, Math.abs(e)) * 70 + (e === 0 ? 0 : 8)) * (thin ? 0.5 : 1));
  return `color-mix(in oklab, ${e >= 0 ? "var(--chart-pos)" : "var(--chart-neg)"} ${p}%, var(--sheet))`;
};

/** Hover tooltip shared by a chart's marks. */
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const bind = (text: string) => ({
    onMouseMove: (e: React.MouseEvent) => { const r = (e.currentTarget.closest(".edge-chart") as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text }); },
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent) => { const r = (e.currentTarget.closest(".edge-chart") as HTMLElement).getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left - r.left + b.width / 2, y: b.top - r.top, text }); },
    onBlur: () => setTip(null),
  });
  const el = tip ? <div className="edge-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">{tip.text}</div> : null;
  return { bind, el };
}

function TableView({ children }: { children: ReactNode }) {
  return <details className="tableview"><summary className="small">Table view</summary><div className="tw">{children}</div></details>;
}

export default function Edge() {
  const all = useLiveQuery(() => db.trades.toArray(), [], []);
  const logs = useLiveQuery(() => db.dailyLogs.toArray(), [], []);
  const [acct, setAcct] = useState<Acct>("All");
  const trades = useMemo(() => all.filter((t) => acct === "All" || t.account === acct), [all, acct]);
  const m = useMemo(() => logsByDate(logs), [logs]);
  const allCombos = useMemo(() => combos(trades, logs), [trades, logs]);
  const aplus = aPlusSetups(allCombos);
  const inside = trades.filter((t) => matchesAPlus(t, aplus, m)), outside = trades.filter((t) => !matchesAPlus(t, aplus, m));

  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Edge finder" lede={<>Where do you actually make money? Every figure shows its sample size and a 95% range; a combination is only called an edge when the whole range is above zero and it has {MIN_SAMPLE}+ trades. Small samples are mostly noise, so keep logging.</>}
        actions={<Tabs<Acct> label="Account" value={acct} onChange={setAcct} tabs={[["All", "All"], ["Demo", "Demo"], ["Live", "Live"]]} />} />

      {trades.length < 5 ? <Empty>Log at least 5 trades (with time, setup and session) and score your bias in the <Link to="/daily">Daily log</Link> to see your edge. You have {trades.length}.</Empty> : <>
        <div className="grid g4">
          <Stat icon="target" k="Trades" v={trades.length} s={`${pct(trades.filter((t) => t.r > 0).length / trades.length)} wins`} />
          <Stat k="A+ setups found" v={aplus.length} s={aplus.length ? "below" : `Needs ${MIN_SAMPLE}+ trades in one combination`} />
          <Stat k="Inside A+" v={inside.length ? fmtR(cellOf("in", inside).expectancy) : "–"} s={`${inside.length} trades, per trade`} />
          <Stat k="Outside A+" v={outside.length ? fmtR(cellOf("out", outside).expectancy) : "–"} s={`${outside.length} trades, per trade`} />
        </div>

        <h2 className="section-title">My A+ setups</h2>
        {aplus.length ? (
          <div className="grid g3">{aplus.map((c) => (
            <div key={c.key} className={`card aplus ${c.confirmed ? "confirmed" : ""}`}>
              <div className="spread"><b>{c.setup}</b><span className={`pill ${c.confirmed ? "g" : "y"}`}>{c.confirmed ? "edge" : "promising"}</span></div>
              <p className="small" style={{ margin: "6px 0" }}>{c.session} · {c.align.toLowerCase()}</p>
              <p style={{ margin: 0 }}><b>{fmtR(c.expectancy)}</b> <span className="small muted">per trade {ci(c)} · {c.n} trades · {pct(c.winRate)} wins</span></p>
              {!c.confirmed && <p className="small muted" style={{ margin: "6px 0 0" }}>Positive so far, but the range still includes zero. Keep sampling before sizing up.</p>}
            </div>
          ))}</div>
        ) : <Empty>No combination has {MIN_SAMPLE}+ trades with a clearly positive result yet. Trade fewer kinds of setups, so each one builds a sample faster.</Empty>}
        {aplus.length > 0 && outside.length > 0 && <p className="small muted" style={{ marginTop: -4 }}>Trades outside your A+ setups: {outside.length}, at {fmtR(cellOf("out", outside).expectancy)} per trade. Consider taking only A+ setups for a month and comparing.</p>}

        <h2 className="section-title">Weekday × session</h2>
        <Heatmap trades={trades} />

        <h2 className="section-title">By New York hour</h2>
        <HourBars trades={trades} />

        <h2 className="section-title">Result distribution</h2>
        <Distribution trades={trades} />

        <div className="grid g2">
          <div className="card"><h3>With or against my daily bias</h3><CellTable cells={byAlignment(trades, logs)} first="Alignment" /></div>
          <div className="card"><h3>By checklist score</h3><CellTable cells={byChecklist(trades)} first="Checklist" /></div>
        </div>

        {trades.some((t) => t.preCheckId) && <>
          <h2 className="section-title">By pre-trade check</h2>
          <CellTable cells={byPreCheck(trades)} first="Check" />
          <p className="small muted" style={{ marginTop: -6 }}>Do checked trades that meet your plan do better than the rest? That's the test of whether your rules work.</p>
        </>}

        {trades.some((t) => t.model) && <>
          <h2 className="section-title">By strategy model</h2>
          <CellTable cells={byModel(trades, (id) => modelById(id)?.name ?? id)} first="Model" />
        </>}

        <h2 className="section-title">Every combination <span className="small muted">(setup · session · bias, 3+ trades)</span></h2>
        {allCombos.length ? <CellTable cells={allCombos} first="Combination" /> : <Empty>No combination has 3+ trades yet.</Empty>}
      </>}
    </div>
  );
}

function CellTable({ cells, first }: { cells: Cell[]; first: string }) {
  return (
    <div className="tw"><table><thead><tr><th>{first}</th><th>Trades</th><th>Win rate</th><th>Per trade</th><th>95% range</th></tr></thead>
      <tbody>{cells.map((c) => (
        <tr key={c.key} className={c.n < MIN_SAMPLE ? "muted" : ""}>
          <td>{c.key}{c.confirmed && <span className="pill g" style={{ marginLeft: 6 }}>edge</span>}</td><td className="n">{c.n}</td><td className="n">{pct(c.winRate)}</td>
          <td className={`n ${c.expectancy >= 0 ? "pos" : "neg"}`}>{fmtR(c.expectancy)}</td><td className="n">{ci(c)}{c.n < MIN_SAMPLE && <span className="small"> · small sample</span>}</td>
        </tr>))}</tbody></table></div>
  );
}

function Heatmap({ trades }: { trades: Trade[] }) {
  const hm = heatmap(trades);
  const { bind, el } = useTip();
  return (
    <div className="card">
      <div className="edge-chart" style={{ position: "relative" }}>
        <div className="heat" style={{ gridTemplateColumns: `56px repeat(${hm.cols.length}, minmax(0, 1fr))` }} role="table" aria-label="Expectancy by weekday and session">
          <div role="row" style={{ display: "contents" }}><span />{hm.cols.map((c) => <span key={c} className="heat-h" role="columnheader">{c}</span>)}</div>
          {hm.rows.map((d, i) => (
            <div key={d} role="row" style={{ display: "contents" }}>
              <span className="heat-h" role="rowheader">{d}</span>
              {hm.cells[i].map((c, j) => c
                ? <span key={j} role="cell" tabIndex={0} className={`heat-c ${c.n < 3 ? "thin" : ""}`} style={{ background: heat(c.expectancy, c.n < 3) }} {...bind(tipText(`${d} · ${hm.cols[j]}`, c))}><b>{fmtR(c.expectancy)}</b><small>{c.n}</small></span>
                : <span key={j} role="cell" className="heat-c empty">–</span>)}
            </div>
          ))}
        </div>
        {el}
      </div>
      <div className="heat-legend small muted"><span>−1R</span><i /><span>+1R</span><span>· number = trades · dashed, paler = under 3 trades</span></div>
      <TableView><table><thead><tr><th>Day</th>{hm.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{hm.rows.map((d, i) => <tr key={d}><td>{d}</td>{hm.cells[i].map((c, j) => <td key={j} className="n">{c ? `${fmtR(c.expectancy)} (${c.n})` : "–"}</td>)}</tr>)}</tbody></table></TableView>
    </div>
  );
}

/** Bar with a 4px rounded data end and a square base on the zero line. */
function barPath(x: number, w: number, base: number, end: number) {
  const r = Math.min(4, w / 2, Math.abs(end - base));
  if (end < base) return `M${x},${base} V${end + r} Q${x},${end} ${x + r},${end} H${x + w - r} Q${x + w},${end} ${x + w},${end + r} V${base} Z`;
  return `M${x},${base} V${end - r} Q${x},${end} ${x + r},${end} H${x + w - r} Q${x + w},${end} ${x + w},${end - r} V${base} Z`;
}

function HourBars({ trades }: { trades: Trade[] }) {
  const hours = byHour(trades);
  const { bind, el } = useTip();
  const W = 720, H = 200, P = { l: 40, r: 8, t: 12, b: 24 };
  const max = Math.max(0.5, ...hours.map((c) => (c ? Math.abs(c.expectancy) : 0)));
  const y = (v: number) => P.t + ((max - v) / (2 * max)) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / 24, bw = Math.max(4, slot - 6);
  return (
    <div className="card">
      <div className="edge-chart chartbox" style={{ position: "relative", border: 0, padding: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Expectancy per trade by New York hour">
          {[max, 0, -max].map((v) => <g key={v}><line className={v === 0 ? "zero" : "axis"} x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} /><text x={P.l - 6} y={y(v) + 4} textAnchor="end">{(v > 0 ? "+" : "") + v.toFixed(1)}R</text></g>)}
          {hours.map((c, h) => (
            <g key={h}>
              {h % 3 === 0 && <text x={P.l + h * slot + slot / 2} y={H - 6} textAnchor="middle">{String(h).padStart(2, "0")}</text>}
              {c && <path className={`ebar ${c.expectancy >= 0 ? "pos" : "neg"} ${c.n < 3 ? "thin" : ""}`} d={barPath(P.l + h * slot + (slot - bw) / 2, bw, y(0), y(c.expectancy === 0 ? 0.001 : c.expectancy))} />}
              {c && <rect className="hit" x={P.l + h * slot} y={P.t} width={slot} height={H - P.t - P.b} tabIndex={0} {...bind(tipText(`${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 New York`, c))} />}
            </g>
          ))}
        </svg>
        {el}
      </div>
      <p className="small muted" style={{ margin: "6px 0 0" }}>Per-trade result by entry hour (New York). Faded bars have fewer than 3 trades. Hours without bars: no trades.</p>
      <TableView><table><thead><tr><th>Hour</th><th>Trades</th><th>Per trade</th><th>95% range</th></tr></thead>
        <tbody>{hours.map((c, h) => c && <tr key={h}><td className="n">{String(h).padStart(2, "0")}:00</td><td className="n">{c.n}</td><td className="n">{fmtR(c.expectancy)}</td><td className="n">{ci(c)}</td></tr>)}</tbody></table></TableView>
    </div>
  );
}

function Distribution({ trades }: { trades: Trade[] }) {
  const d = rDistribution(trades);
  const { bind, el } = useTip();
  const W = 720, H = 180, P = { l: 30, r: 8, t: 14, b: 24 };
  const max = Math.max(1, ...d.map((b) => b.n));
  const slot = (W - P.l - P.r) / d.length, bw = Math.min(56, slot - 12);
  const y = (n: number) => P.t + (1 - n / max) * (H - P.t - P.b);
  return (
    <div className="card">
      <div className="edge-chart chartbox" style={{ position: "relative", border: 0, padding: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Number of trades by result in R">
          <line className="zero" x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} />
          {d.map((b, i) => (
            <g key={b.label}>
              <text x={P.l + i * slot + slot / 2} y={H - 6} textAnchor="middle">{b.label}</text>
              {b.n > 0 && <path className={`ebar ${b.sign > 0 ? "pos" : b.sign < 0 ? "neg" : "flat"}`} d={barPath(P.l + i * slot + (slot - bw) / 2, bw, y(0), y(b.n))} />}
              {b.n > 0 && <text className="val" x={P.l + i * slot + slot / 2} y={y(b.n) - 5} textAnchor="middle">{b.n}</text>}
              <rect className="hit" x={P.l + i * slot} y={P.t} width={slot} height={H - P.t - P.b} tabIndex={0} {...bind(`${b.label}: ${b.n} trade${b.n === 1 ? "" : "s"} (${pct(b.n / Math.max(1, trades.length))})`)} />
            </g>
          ))}
        </svg>
        {el}
      </div>
      <p className="small muted" style={{ margin: "6px 0 0" }}>A healthy ICT-style profile: many small losses at −1R and fewer, larger wins at 2R+. A lot of trades between −1 and 0 often means moving stops or cutting early.</p>
    </div>
  );
}
