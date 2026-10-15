import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { chronological, fmtR, groupBy, pct, tradeStats, weekday } from "../lib/stats";
import { downloadText, tradesToCsv } from "../lib/backup";
import { MISTAKES, SESSIONS, SETUPS } from "../lib/constants";
import { CONCEPTS, conceptsOfTrade, executionStats } from "../lib/learning";
import { EquityChart, RBars } from "../components/Charts";
import { ImportTrades } from "../components/ImportTrades";
import { Empty, PageHead, Stat, Tabs } from "../components/ui";

type By = "setup" | "session" | "market" | "weekday" | "mistakes" | "emotionsBefore" | "timeframe" | "plan" | "concept";

export default function Journal() {
  const all = useLiveQuery(() => db.trades.toArray(), [], []);
  const nav = useNavigate();
  const [account, setAccount] = useState<"All" | "Demo" | "Live">("All");
  const [setup, setSetup] = useState("");
  const [session, setSession] = useState("");
  const [mistake, setMistake] = useState("");
  const [from, setFrom] = useState("");
  const [by, setBy] = useState<By>("setup");
  const [importing, setImporting] = useState(false);

  const trades = useMemo(() => all.filter((t) =>
    (account === "All" || t.account === account) && (!setup || t.setup === setup) && (!session || t.session === session) &&
    (!mistake || t.mistakes.includes(mistake)) && (!from || t.date >= from)), [all, account, setup, session, mistake, from]);
  const st = tradeStats(trades);
  const ex = executionStats(trades);
  const groups = groupBy(trades, (t) => (by === "weekday" ? weekday(t.date) : by === "mistakes" ? t.mistakes : by === "emotionsBefore" ? t.emotionsBefore
    : by === "plan" ? (t.followedPlan == null ? "Not recorded" : t.followedPlan ? "Followed plan" : "Broke plan")
    : by === "concept" ? conceptsOfTrade(t).map((id) => CONCEPTS.find((c) => c.id === id)?.name ?? id) : String(t[by] ?? "")));
  const list = chronological(trades).reverse();

  return (
    <div className="stack">
      <PageHead eyebrow="Trade" title="Trade journal" lede='ICT: "Every trade logged with screenshots." Record results in R (multiples of your risk) so different account sizes compare fairly.'
        actions={<><button type="button" className="btn ghost" onClick={() => setImporting(!importing)}>Import from broker</button><button type="button" className="btn ghost" onClick={() => downloadText("trades.csv", tradesToCsv(list as unknown as Record<string, unknown>[]), "text/csv")} disabled={!list.length}>Export CSV</button><Link className="btn" to="/journal/new">+ Log a trade</Link></>} />

      {importing && <ImportTrades onClose={() => setImporting(false)} />}

      <div className="card form filters">
        <label className="field"><span>Account</span><select value={account} onChange={(e) => setAccount(e.target.value as typeof account)}><option>All</option><option>Demo</option><option>Live</option></select></label>
        <label className="field"><span>Setup</span><select value={setup} onChange={(e) => setSetup(e.target.value)}><option value="">All setups</option>{SETUPS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>Session</span><select value={session} onChange={(e) => setSession(e.target.value)}><option value="">All sessions</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>Mistake</span><select value={mistake} onChange={(e) => setMistake(e.target.value)}><option value="">Any</option>{MISTAKES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>From date</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      </div>

      <div className="grid g4">
        <Stat k="Trades" v={st.n} s={`${st.wins} wins · ${st.losses} losses · ${st.breakeven} BE`} />
        <Stat k="Win rate" v={st.n ? pct(st.winRate) : "–"} s={st.n ? `Avg win ${fmtR(st.avgWin)} · avg loss ${fmtR(st.avgLoss)}` : ""} />
        <Stat k="Total" v={fmtR(st.totalR)} s={`Expectancy ${fmtR(st.expectancy)} per trade`} />
        <Stat k="Max drawdown" v={st.n ? `−${st.maxDrawdownR.toFixed(1)}R` : "–"} s={`Profit factor ${st.profitFactor ?? "–"} · worst run ${st.longestLossStreak} losses`} />
      </div>

      <div className="grid g4">
        <Stat k="Plan adherence" v={ex.recorded ? pct(ex.adherence) : "–"} s={ex.recorded ? `${ex.recorded} trades recorded` : 'Mark "Did I follow my plan?" on trades'} />
        <Stat k="Followed vs broke plan" v={ex.followed || ex.broken ? <>{ex.followed ? fmtR(ex.followed.expectancy) : "–"} <span className="muted small">vs</span> {ex.broken ? fmtR(ex.broken.expectancy) : "–"}</> : "–"} s="Expectancy per trade" />
        <Stat k="Left on the table" v={ex.withMfe ? fmtR(ex.leftOnTable) : "–"} s={ex.withMfe ? `Avg MFE − result on winners · avg MFE ${fmtR(ex.avgMfe)}` : "Record MFE on trades"} />
        <Stat k="Losers that were +1R first" v={ex.withMfe ? ex.losersThatWereUp : "–"} s={ex.withMfe ? `Winners needed ${ex.winnerHeat.toFixed(2)}R of heat on average` : "Record MAE / MFE on trades"} />
      </div>

      <h2 className="section-title">Equity curve (R)</h2>
      <EquityChart points={st.equity} />

      <h2 className="section-title">Breakdown</h2>
      <Tabs<By> label="Group trades by" value={by} onChange={setBy} tabs={[["setup", "Setup"], ["session", "Session"], ["market", "Market"], ["timeframe", "Timeframe"], ["weekday", "Weekday"], ["mistakes", "Mistakes"], ["emotionsBefore", "Emotion before"], ["plan", "Plan followed"], ["concept", "Concept"]]} />
      {groups.length ? <>
        <RBars data={groups.slice(0, 12)} />
        <div className="tw"><table><thead><tr><th>{by}</th><th>Trades</th><th>Win rate</th><th>Total R</th><th>Expectancy</th></tr></thead>
          <tbody>{groups.map((g) => <tr key={g.key}><td>{g.key}</td><td className="n">{g.n}</td><td className="n">{pct(g.winRate)}</td><td className={`n ${g.totalR >= 0 ? "pos" : "neg"}`}>{fmtR(g.totalR)}</td><td className="n">{fmtR(g.expectancy)}</td></tr>)}</tbody></table></div>
      </> : <Empty>Log trades to see which setups, sessions and habits make or cost you money.</Empty>}

      <h2 className="section-title">All trades</h2>
      {list.length ? (
        <div className="tw"><table className="wide"><thead><tr><th>Date</th><th>Market</th><th>Dir</th><th>Setup</th><th>TF · session</th><th>R</th><th>Checklist</th><th>Mistakes</th><th>Acct</th></tr></thead>
          <tbody>{list.map((t) => (
            <tr key={t.id} className="click" tabIndex={0} onClick={() => nav(`/journal/${t.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/journal/${t.id}`)}>
              <td className="n">{t.date}{t.time ? ` ${t.time}` : ""}</td><td>{t.market}</td><td>{t.direction}</td><td>{t.setup}</td><td>{t.timeframe} · {t.session}</td>
              <td className={`n ${t.r >= 0 ? "pos" : "neg"}`}>{fmtR(t.r)}</td><td className="n">{t.checklist ?? "–"}</td><td className="small">{t.mistakes.filter((m) => m !== "None").join(", ") || "–"}</td><td><span className={`pill ${t.account === "Live" ? "r" : ""}`}>{t.account}</span></td>
            </tr>))}</tbody></table></div>
      ) : <Empty>No trades match. <Link to="/journal/new">Log your first demo trade</Link>; ICT asks for 30+ before going live.</Empty>}
    </div>
  );
}
