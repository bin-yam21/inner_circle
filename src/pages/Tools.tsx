import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "../lib/db";
import { CHECKLIST, SEASONALS } from "../lib/constants";
import { ipdaAnchor, ipdaRanges, tradingDaysBetween } from "../lib/ipda";
import { activeZone, fmtMinutes, nextZone, nyNow, ZONES } from "../lib/time";
import { tiltAdvice } from "../lib/stats";
import { PageHead, SavedCheckbox, Tabs, useSettings } from "../components/ui";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

type T = "clock" | "checklist" | "size" | "ipda" | "seasonal";
export default function Tools() {
  const [tab, setTab] = useState<T>("clock");
  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Tools" lede="Session clock, the setup checklist, a position-size calculator with ICT's risk rules, an IPDA data-range calculator and the seasonal calendar." />
      <Tabs<T> label="Tools" value={tab} onChange={setTab} tabs={[["clock", "Session clock"], ["checklist", "Checklist"], ["size", "Position size"], ["ipda", "IPDA calculator"], ["seasonal", "Seasonals"]]} />
      {tab === "clock" && <Clock />}
      {tab === "checklist" && <Checklist />}
      {tab === "size" && <PositionSize />}
      {tab === "ipda" && <Ipda />}
      {tab === "seasonal" && <Seasonal />}
    </div>
  );
}

function Clock() {
  const now = useNow(1000);
  const ny = nyNow(now);
  const zone = activeZone(ny.minutes), nz = nextZone(ny.minutes);
  // Timeline from 18:00 to 14:00 next day (20 hours) so the trading night reads left to right.
  const start = 18 * 60, span = 20 * 60;
  const pos = (m: number) => (((m - start + 1440) % 1440) / span) * 100;
  return (
    <div className="stack">
      <div className="card clock">
        <div><div className="t">{ny.label}<span className="muted" style={{ fontSize: 20 }}>:{String(ny.s).padStart(2, "0")}</span></div><div className="small muted">New York · {ny.weekday}</div></div>
        <div>{zone ? <p style={{ margin: 0 }}><b>{zone.name}</b> is open. {zone.note}.</p> : <p style={{ margin: 0 }}>No killzone open. Next: <b>{nz.zone.name}</b> in {fmtMinutes(nz.inMinutes)}.</p>}
          {(ny.weekday === "Sat" || ny.weekday === "Sun") && <p className="small muted" style={{ margin: "4px 0 0" }}>Weekend: ICT's day for big-picture and intermediate homework.</p>}</div>
      </div>
      <div className="dayline" role="img" aria-label="Killzones from 18:00 to 14:00 New York time">
        {ZONES.map((z) => <div key={z.name} className={`z ${z.tone}`} style={{ left: `${pos(z.start)}%`, width: `${((z.end - z.start) / span) * 100}%` }}>{z.name}</div>)}
        {pos(ny.minutes) <= 100 && <div className="now" style={{ left: `${pos(ny.minutes)}%` }} />}
        <div className="hrs"><span>18:00</span><span>22:00</span><span>02:00</span><span>06:00</span><span>10:00</span><span>14:00</span></div>
      </div>
      <div className="card small"><b>Daily template (bullish day):</b> Asian consolidation → Judas swing after midnight makes the London low → expansion to ~05:00 → 05:00–08:00 consolidation → 8:30 news retracement → New York continuation or reversal → London close (10–11:00) reversal → afternoon consolidation. Day traders exit by 14:00.</div>
    </div>
  );
}

function Checklist() {
  const row = useLiveQuery(() => db.settings.get("checklist"), []);
  const state = (row?.value as boolean[] | undefined) ?? [];
  const set = (i: number, v: boolean) => { const next = [...state]; next[i] = v; db.settings.put({ key: "checklist", value: next }); };
  const c = CHECKLIST.filter((_, i) => state[i]).length;
  const verdict = c === CHECKLIST.length ? "High-reward setup: everything agrees" : c >= 8 ? "Good: check what's missing" : c >= 5 ? "Weak: ICT would wait" : "No trade";
  return (
    <div className="card">
      <h3>High-reward setup checklist</h3>
      <p className="small muted">ICT's "seven things in agreement" plus his entry rules. Copy the score into your trade.</p>
      <ul className="check">{CHECKLIST.map((t, i) => <li key={i}><SavedCheckbox id={`ck${i}`} checked={!!state[i]} onChange={(v) => set(i, v)} /><label htmlFor={`ck${i}`}>{t}</label></li>)}</ul>
      <p className="score"><b>{c}/{CHECKLIST.length}</b> · {verdict}</p>
      <button type="button" className="btn ghost" onClick={() => db.settings.put({ key: "checklist", value: [] })}>Clear</button>
    </div>
  );
}

function PositionSize() {
  const s = useSettings();
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const adv = tiltAdvice(trades, todayStr(), s.dailyLossLimitR);
  const [stop, setStop] = useState(20), [target, setTarget] = useState(60), [pipValue, setPipValue] = useState<number | null>(null), [useTilt, setUseTilt] = useState(true);
  const pv = pipValue ?? s.pipValue;
  const base = s.accountSize * (s.allocationPct / 100) * (s.riskPct / 100);
  const risk = useTilt ? base * adv.riskFactor : base;
  const lots = stop > 0 && pv > 0 ? Math.floor((risk / (stop * pv)) * 100) / 100 : 0;
  return (
    <div className="panel">
      <h3>Position size</h3>
      <p className="small muted">Account ${s.accountSize.toLocaleString()} · {s.allocationPct}% allocation · {s.riskPct}% risk (change these in Settings).</p>
      <div className="calc">
        <label htmlFor="ps-stop">Stop distance (pips)<input id="ps-stop" type="number" min={0.1} step={0.1} value={stop} onChange={(e) => setStop(Number(e.target.value))} /></label>
        <label htmlFor="ps-tp">Target distance (pips)<input id="ps-tp" type="number" min={0} step={0.1} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
        <label htmlFor="ps-pv">Pip value per 1.00 lot ($)<input id="ps-pv" type="number" min={0} step="any" value={pv} onChange={(e) => setPipValue(Number(e.target.value))} /></label>
        <label htmlFor="ps-tilt" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input id="ps-tilt" type="checkbox" checked={useTilt} onChange={(e) => setUseTilt(e.target.checked)} style={{ width: "auto" }} /> Apply the halving rule (×{adv.riskFactor})</label>
      </div>
      <div className="out">
        <div><span>Risk $</span><b>${risk.toFixed(2)}</b></div>
        <div><span>Lots</span><b>{lots.toFixed(2)}</b></div>
        <div><span>Reward</span><b>{stop > 0 ? (target / stop).toFixed(1) + "R" : "–"}</b></div>
      </div>
      <p className="score">{adv.message}</p>
    </div>
  );
}

function Ipda() {
  const today = todayStr();
  const [anchor, setAnchor] = useState(ipdaAnchor(today));
  const ranges = ipdaRanges(anchor);
  return (
    <div className="stack">
      <div className="card">
        <h3>IPDA data ranges</h3>
        <p className="small muted">ICT (Month 5): anchor on the first trading day of the most recently completed month, look back 20/40/60 trading days for the liquidity (highs, lows, FVGs), and cast forward 20/40/60 days for the window of the next shift. Weekends are skipped; holidays aren't.</p>
        <div className="form three">
          <label className="field"><span>Anchor date</span><input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} /></label>
          <div className="field"><span>Today</span><div className="mono" style={{ padding: "9px 0" }}>{today} · {tradingDaysBetween(anchor, today)} trading days after anchor</div></div>
          <div className="field"><span>&nbsp;</span><button type="button" className="btn ghost" onClick={() => setAnchor(ipdaAnchor(today))}>Reset to ICT anchor</button></div>
        </div>
      </div>
      <div className="tw"><table><thead><tr><th>Range</th><th>Look back to</th><th>Cast forward to</th><th>Use it for</th></tr></thead>
        <tbody>{ranges.map((r) => <tr key={r.days}><td className="n">{r.days} days</td><td className="n">{r.back}</td><td className="n">{r.forward}</td><td className="small">{r.days === 20 ? "Near-term pools: day trades, scalps" : r.days === 40 ? "Short-term pools; position trailing stop (40-day low/high)" : "Intermediate pools: quarterly shift window"}</td></tr>)}</tbody></table></div>
      <p className="small muted">Mark the highest high and lowest low between each look-back date and the anchor on your daily chart. If all of them have already been run, ICT expects an expansion to the next level outside the 60 days.</p>
    </div>
  );
}

function Seasonal() {
  const month = new Date().getMonth() + 1;
  const markets = [...new Set(SEASONALS.map((s) => s.market))];
  const M = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  return (
    <div className="stack">
      <p className="small muted">From ICT's seasonal lessons (40- and 15-year futures averages). Green is a bullish tendency for the instrument, red bearish. The current month is outlined. ICT: "a roadmap, not a panacea": only use one when the market is already leaning that way.</p>
      <div className="tw"><table className="season"><thead><tr><th style={{ textAlign: "left" }}>Market</th>{M.map((m, i) => <th key={i} className={i + 1 === month ? "cur" : ""}>{m}</th>)}</tr></thead>
        <tbody>{markets.map((mk) => <tr key={mk}><td style={{ textAlign: "left", whiteSpace: "nowrap" }}>{mk}</td>{M.map((_, i) => {
          const hit = SEASONALS.find((s) => s.market === mk && s.months.includes(i + 1));
          return <td key={i} className={hit ? `m-${hit.dir}` : ""} title={hit?.note}>{hit ? (hit.dir === "up" ? "▲" : "▼") : ""}</td>;
        })}</tr>)}</tbody></table></div>
      <div className="card"><h3>This month</h3><ul className="small">{SEASONALS.filter((s) => s.months.includes(month)).map((s, i) => <li key={i}><b>{s.market}</b>: {s.note}</li>)}</ul></div>
    </div>
  );
}
