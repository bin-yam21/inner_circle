/** IPDA data ranges (ICT Month 5): count trading days (Mon–Fri) back and forward from an anchor date. */
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const isTradingDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** Move `n` trading days from `date` (negative = back). The anchor day itself counts as day 0. */
export function addTradingDays(date: string, n: number): string {
  const d = parse(date); const step = n < 0 ? -1 : 1; let left = Math.abs(n);
  while (left > 0) { d.setDate(d.getDate() + step); if (isTradingDay(d)) left--; }
  return fmt(d);
}

/** ICT anchors on the first trading day of the most recent COMPLETED month. */
export function ipdaAnchor(today: string): string {
  const t = parse(today); const d = new Date(t.getFullYear(), t.getMonth() - 1, 1, 12);
  while (!isTradingDay(d)) d.setDate(d.getDate() + 1);
  return fmt(d);
}

export function ipdaRanges(anchor: string) {
  return [20, 40, 60].map((n) => ({ days: n, back: addTradingDays(anchor, -n), forward: addTradingDays(anchor, n) }));
}

export function tradingDaysBetween(a: string, b: string): number {
  let d = parse(a), end = parse(b), sign = 1;
  if (d > end) { [d, end] = [end, d]; sign = -1; }
  let n = 0;
  while (fmt(d) !== fmt(end)) { d.setDate(d.getDate() + 1); if (isTradingDay(d)) n++; }
  return n * sign;
}
