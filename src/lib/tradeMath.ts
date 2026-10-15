import type { Trade } from "./types";

/** Result in R from entry, stop and exit prices, or null when one is missing or the stop equals the entry. */
export function calcRFromPrices(t: Pick<Trade, "direction" | "entry" | "stop" | "exit">): number | null {
  if (t.entry == null || t.stop == null || t.exit == null) return null;
  const risk = Math.abs(t.entry - t.stop);
  if (!risk) return null;
  const move = t.direction === "Long" ? t.exit - t.entry : t.entry - t.exit;
  return Math.round((move / risk) * 100) / 100;
}
