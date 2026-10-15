import { useState } from "react";
import { db } from "../lib/db";
import { parseStatement, toTrade, type ImportResult } from "../lib/importTrades";
import { SESSIONS, SETUPS } from "../lib/constants";
import { fmtR } from "../lib/stats";
import type { Trade } from "../lib/types";
import { toast, useSettings } from "./ui";

/** Import closed trades from a broker CSV, with a preview before anything is saved. */
export function ImportTrades({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const risk = settings.accountSize * (settings.allocationPct / 100) * (settings.riskPct / 100);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [account, setAccount] = useState<Trade["account"]>("Demo");
  const [res, setRes] = useState<(ImportResult & { existing: Set<string> }) | null>(null);

  async function load(f: File) {
    const text = await f.text();
    const parsed = parseStatement(text, risk);
    const existing = new Set((await db.trades.bulkGet(parsed.rows.map((r) => r.id))).filter(Boolean).map((t) => t!.id));
    setFile({ name: f.name, text }); setRes({ ...parsed, existing });
  }
  async function save() {
    if (!res || !file) return;
    const fresh = res.rows.filter((r) => !res.existing.has(r.id));
    await db.trades.bulkPut(fresh.map((r) => toTrade(r, account, file.name, { setup: SETUPS[SETUPS.length - 1], session: SESSIONS[1], timeframe: "15m" })));
    toast(`Imported ${fresh.length} trade${fresh.length === 1 ? "" : "s"}`);
    onClose();
  }
  const fresh = res ? res.rows.filter((r) => !res.existing.has(r.id)) : [];

  return (
    <section className="card stack">
      <div className="spread"><h3 style={{ margin: 0 }}>Import trades from your broker</h3><button type="button" className="btn ghost sm" onClick={onClose}>Close</button></div>
      <p className="small" style={{ margin: 0 }}>Export your closed-trade history as CSV: <b>MT4</b> Account History → right-click → <i>Save as Report</i> then open it in Excel and save as CSV · <b>MT5</b> History → right-click → <i>Report</i> → Excel, saved as CSV · <b>cTrader</b> History → <i>Export</i> CSV · or any CSV with symbol, type (buy/sell), open time and prices.</p>
      <div className="form three">
        <label className="field"><span>Statement file (.csv)</span><input type="file" accept=".csv,.txt,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }} /></label>
        <label className="field"><span>Account</span><select value={account} onChange={(e) => setAccount(e.target.value as Trade["account"])}><option>Demo</option><option>Live</option></select></label>
        <div className="field"><span>R without a stop price</span><p className="small muted" style={{ margin: "6px 0 0" }}>{risk > 0 ? `P/L ÷ your planned risk of ${settings.currency} ${risk.toFixed(2)} (Settings)` : "Set account size and risk in Settings to estimate R from P/L"}</p></div>
      </div>
      {res && (res.rows.length ? (
        <>
          <p className="small" style={{ margin: 0 }}>Found <b>{res.rows.length}</b> trades{res.existing.size ? `, ${res.existing.size} already in your journal` : ""}{res.skipped ? `; skipped ${res.skipped} rows (deposits, pending orders, unreadable)` : ""}. Columns used: {Object.entries(res.columns).map(([k, v]) => `${k} = "${v}"`).join(", ")}.</p>
          <div className="tw"><table className="wide"><thead><tr><th>Date</th><th>Market</th><th>Dir</th><th>Entry</th><th>Stop</th><th>Exit</th><th>P/L</th><th>R</th><th></th></tr></thead>
            <tbody>{res.rows.slice(0, 12).map((r) => (
              <tr key={r.id} className={res.existing.has(r.id) ? "muted" : ""}><td className="n">{r.date} {r.time}</td><td>{r.market}</td><td>{r.direction}</td><td className="n">{r.entry ?? "–"}</td><td className="n">{r.stop ?? "–"}</td><td className="n">{r.exit ?? "–"}</td><td className="n">{r.pnl ?? "–"}</td>
                <td className={`n ${(r.r ?? 0) >= 0 ? "pos" : "neg"}`}>{r.r == null ? "–" : fmtR(r.r)}{r.rSource === "pnl" && " *"}</td><td className="small">{res.existing.has(r.id) ? "already imported" : ""}</td></tr>))}</tbody></table></div>
          {res.rows.length > 12 && <p className="small muted" style={{ margin: 0 }}>…and {res.rows.length - 12} more. * = R estimated from P/L.</p>}
          <div className="row"><button type="button" className="btn" disabled={!fresh.length} onClick={save}>Import {fresh.length} trade{fresh.length === 1 ? "" : "s"}</button><span className="small muted">Then open each one to add the setup, session, emotions and screenshots.</span></div>
        </>
      ) : <p className="alert warn small" style={{ margin: 0 }}>No trades found in this file. It needs a header row with at least symbol, type (buy/sell) and open time columns.</p>)}
    </section>
  );
}
