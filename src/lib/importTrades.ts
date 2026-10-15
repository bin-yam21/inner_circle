/**
 * Broker statement import: turns a CSV of closed trades into journal trades.
 * Recognises column names used by MetaTrader 4/5 history exports, cTrader, TradingView
 * paper trading and most broker CSVs. Tested in tests/importTrades.test.ts.
 */
import { parseTime } from "./replay";
import { calcRFromPrices } from "./tradeMath";
import type { Direction, Trade } from "./types";

export interface ImportedRow {
  id: string; date: string; time: string; market: string; direction: Direction;
  size: number | null; entry: number | null; stop: number | null; target: number | null; exit: number | null;
  pnl: number | null; r: number | null; rSource: "prices" | "pnl" | "none";
}
export interface ImportResult { rows: ImportedRow[]; skipped: number; columns: Partial<Record<Col, string>> }

type Col = "id" | "open" | "symbol" | "type" | "size" | "entry" | "stop" | "target" | "close" | "exit" | "pnl";
/** Header synonyms (lower-case, spaces and punctuation removed). Order matters: first match wins. */
const SYNONYMS: Record<Col, string[]> = {
  id: ["ticket", "positionid", "position", "orderid", "order", "id", "deal", "tradeid"],
  open: ["opentime", "openingtime", "timeopen", "entrytime", "opendate", "openingdate", "time", "date", "datetime"],
  symbol: ["symbol", "instrument", "market", "pair", "asset", "item"],
  type: ["type", "openingdirection", "direction", "side", "action", "buysell"],
  size: ["volume", "lots", "size", "quantity", "closingquantity", "qty", "amount"],
  entry: ["openprice", "entryprice", "openingprice", "price", "avgentryprice", "fillprice"],
  stop: ["sl", "stoploss", "stop", "s/l"],
  target: ["tp", "takeprofit", "target", "t/p"],
  close: ["closetime", "closingtime", "timeclose", "exittime", "closedate"],
  exit: ["closeprice", "closingprice", "exitprice", "price2", "avgexitprice"],
  pnl: ["profit", "netprofit", "pnl", "p&l", "pl", "netusd", "net", "realizedpnl", "grossprofit", "result"],
};
const norm = (h: string) => h.toLowerCase().replace(/[\s_.\-()/]/g, "").replace(/^<|>$/g, "");

/** Minimal CSV/TSV row splitter that understands quoted fields. */
export function splitRows(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = [",", ";", "\t"].map((d) => [d, lines[0].split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  return lines.map((line) => {
    const out: string[] = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

const num = (s: string | undefined) => {
  if (s == null) return null;
  const t = s.replace(/[\s$€£]/g, "").replace(/,(?=\d{3}\b)/g, "");
  if (t === "" || t === "-") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The clock a statement's times are written in:
 *  - "ny+7": most MetaTrader brokers (server time = New York + 7h, GMT+2 winter / GMT+3 summer)
 *  - "utc", "local" (this computer's zone), or "ny" (already New York time)
 */
export type SourceZone = "ny+7" | "utc" | "local" | "ny";
export const SOURCE_ZONES: [SourceZone, string][] = [
  ["ny+7", "Broker server time, New York + 7h (most MT4/MT5 brokers)"],
  ["utc", "UTC / GMT"],
  ["local", "This computer's time zone"],
  ["ny", "Already New York time"],
];
const nyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** `wall` is the statement's clock reading encoded as if it were UTC (what parseTime returns). Returns the New York date and time. */
export function toNewYork(wall: number, zone: SourceZone): { date: string; time: string } {
  const fromWall = (ms: number) => { const d = new Date(ms); return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }; };
  if (zone === "ny") return fromWall(wall);
  if (zone === "ny+7") return fromWall(wall - 7 * 3_600_000);
  const w = new Date(wall);
  const instant = zone === "utc" ? wall : new Date(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes()).getTime();
  const parts = Object.fromEntries(nyFmt.formatToParts(instant).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}` };
}

/**
 * Session for a New York time, using the app's session names. Times between the
 * killzones go to the session they follow (e.g. 12:00–18:00 counts as "London close").
 */
export function sessionForNyTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const min = h * 60 + m;
  if (min >= 18 * 60 || min < 2 * 60) return "Asia";
  if (min < 7 * 60) return "London open";
  if (min < 10 * 60) return "New York open";
  return "London close";
}

/**
 * @param riskPerTrade money risked per trade, used to estimate R from P/L when the
 *   statement has no stop price. 0 leaves R empty for those rows.
 */
export function parseStatement(text: string, riskPerTrade: number, zone: SourceZone = "ny"): ImportResult {
  const rows = splitRows(text);
  // The header is the first row that names a symbol column (statements often have title lines first).
  const hi = rows.findIndex((r) => r.some((h) => SYNONYMS.symbol.includes(norm(h))));
  if (hi < 0) return { rows: [], skipped: rows.length, columns: {} };
  const head = rows[hi].map(norm);
  // MT4 history has two "Price" columns: the first is the open price, the second the close price.
  const priceIdx = head.map((h, i) => (h === "price" ? i : -1)).filter((i) => i >= 0);
  if (priceIdx.length === 2) head[priceIdx[1]] = "price2";
  const idx = {} as Record<Col, number>;
  const used = new Set<number>();
  for (const col of Object.keys(SYNONYMS) as Col[]) {
    let found = -1;
    for (const syn of SYNONYMS[col]) { found = head.findIndex((h, i) => h === syn && !used.has(i)); if (found >= 0) break; }
    idx[col] = found;
    if (found >= 0) used.add(found);
  }
  const columns: ImportResult["columns"] = {};
  for (const c of Object.keys(idx) as Col[]) if (idx[c] >= 0) columns[c] = rows[hi][idx[c]];

  const out: ImportedRow[] = [];
  let skipped = 0;
  for (const cells of rows.slice(hi + 1)) {
    const get = (c: Col) => (idx[c] >= 0 ? cells[idx[c]] : undefined);
    const type = (get("type") ?? "").toLowerCase();
    const direction: Direction | null = /buy|long/.test(type) ? "Long" : /sell|short/.test(type) ? "Short" : null;
    const market = (get("symbol") ?? "").toUpperCase().replace(/\.[A-Z]+$|[+#]$/, "");
    const t = parseTime(get("open"));
    if (!direction || !market || t == null || /limit|stop$/.test(type) && get("exit") == null) { skipped++; continue; }
    // Unix timestamps are real instants, whatever clock the rest of the file uses.
    const ny = toNewYork(t, /^\d{9,13}$/.test(get("open")!.trim()) ? "utc" : zone);
    const entry = num(get("entry")), stop = num(get("stop")), target = num(get("target")), exit = num(get("exit")), pnl = num(get("pnl"));
    const fromPrices = calcRFromPrices({ direction, entry, stop: stop || null, exit });
    const r = fromPrices ?? (pnl != null && riskPerTrade > 0 ? Math.round((pnl / riskPerTrade) * 100) / 100 : null);
    out.push({
      id: "imp-" + (get("id") || `${market}-${t}`).replace(/\s+/g, ""),
      date: ny.date, time: ny.time,
      market: market.length === 6 && /^[A-Z]{6}$/.test(market) ? `${market.slice(0, 3)}/${market.slice(3)}` : market,
      direction, size: num(get("size")), entry, stop: stop || null, target: target || null, exit, pnl, r,
      rSource: fromPrices != null ? "prices" : r != null ? "pnl" : "none",
    });
  }
  return { rows: out, skipped, columns };
}

/** Journal trade for an imported row; setup, session and emotions are left for you to fill in. */
export function toTrade(row: ImportedRow, account: Trade["account"], source: string, defaults: { setup: string; timeframe: string }): Trade {
  const now = Date.now();
  return {
    id: row.id, date: row.date, time: row.time, market: row.market, direction: row.direction,
    setup: defaults.setup, timeframe: defaults.timeframe, session: sessionForNyTime(row.time),
    entry: row.entry, stop: row.stop, target: row.target, exit: row.exit, size: row.size, pnl: row.pnl, r: row.r ?? 0,
    checklist: null, emotionsBefore: [], emotionsAfter: [], mistakes: [], account, followedPlan: null, mae: null, mfe: null, concepts: [],
    notes: `Imported from ${source}${row.rSource === "pnl" ? " (R estimated from P/L ÷ your planned risk)" : row.rSource === "none" ? " (no stop or P/L: enter R yourself)" : ""}. Time converted to New York; session guessed from it. Add the setup, emotions and screenshots, and check the session.`,
    createdAt: now, updatedAt: now,
  };
}
