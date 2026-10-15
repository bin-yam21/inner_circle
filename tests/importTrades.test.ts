import { describe, expect, it } from "vitest";
import { parseStatement, splitRows, toTrade } from "../src/lib/importTrades";

describe("splitRows", () => {
  it("handles quoted fields with delimiters and quotes", () => {
    expect(splitRows('a,"b, c","say ""hi"""\n1,2,3')).toEqual([["a", "b, c", 'say "hi"'], ["1", "2", "3"]]);
  });
});

describe("parseStatement", () => {
  it("reads an MT4 history export (two Price columns, title line, balance rows)", () => {
    const csv = [
      "Closed Transactions:",
      "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit",
      "1001,2026.10.01 08:15:00,buy,0.50,eurusd,1.10000,1.09800,1.10600,2026.10.01 11:00:00,1.10600,0,0,0,300.00",
      "1002,2026.10.02 09:00:00,sell,0.50,gbpusd,1.30000,1.30200,1.29400,2026.10.02 10:00:00,1.30200,0,0,0,-100.00",
      "1003,2026.10.02 12:00:00,balance,,,,,,,,,,,5000.00",
    ].join("\n");
    const r = parseStatement(csv, 100);
    expect(r.skipped).toBe(1);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ id: "imp-1001", date: "2026-10-01", time: "08:15", market: "EUR/USD", direction: "Long", entry: 1.1, stop: 1.098, exit: 1.106, pnl: 300, r: 3, rSource: "prices" });
    expect(r.rows[1]).toMatchObject({ direction: "Short", r: -1 });
  });
  it("reads a cTrader-style export and estimates R from P/L when there's no stop", () => {
    const csv = 'ID,Symbol,Opening Direction,Opening Time,Closing Time,Entry price,Closing Price,Closing Quantity,"Net USD"\n'
      + 'P55,XAUUSD,Sell,2026-10-03 14:30:00,2026-10-03 15:10:00,2650.5,2640.5,"1,000",250.00';
    const r = parseStatement(csv, 125);
    expect(r.rows[0]).toMatchObject({ id: "imp-P55", market: "XAU/USD", direction: "Short", entry: 2650.5, exit: 2640.5, size: 1000, pnl: 250, r: 2, rSource: "pnl" });
  });
  it("returns nothing for a file without a symbol column", () => {
    expect(parseStatement("a,b\n1,2", 100).rows).toEqual([]);
  });
  it("builds a journal trade with notes about what to fill in", () => {
    const row = parseStatement("Symbol,Type,Time,Profit\nUS30,buy,2026-10-05 15:00,-50", 0).rows[0];
    expect(row.r).toBeNull();
    const t = toTrade(row, "Demo", "x.csv", { setup: "Other", session: "London open", timeframe: "15m" });
    expect(t.r).toBe(0);
    expect(t.notes).toMatch(/enter R yourself/);
  });
});
