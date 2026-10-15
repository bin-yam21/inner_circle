/** Turns detector output into chart overlays (zones, levels, markers, shaded candles). */
import type { Analysis } from "./detect";
import { targets, type Exercise } from "./exercises";
import type { Candle } from "./types";

/** Overlay shapes, positioned by absolute candle index. Zones and levels extend to the last candle. */
export interface ChartOverlay {
  zones?: { from: number; top: number; bottom: number; cls: string; label?: string }[];
  levels?: { from: number; price: number; cls: string; label?: string }[];
  marks?: { index: number; price: number; cls: string; up: boolean }[];
  /** Candles to shade (e.g. a sweep or a clicked candle). */
  bands?: { index: number; cls: string }[];
}

export type Layer = "fvg" | "ob" | "liquidity" | "swings" | "range" | "sweeps";
export const LAYERS: [Layer, string][] = [["fvg", "FVGs"], ["ob", "Order blocks"], ["liquidity", "Liquidity"], ["sweeps", "Sweeps"], ["swings", "Swings"], ["range", "Premium / discount"]];

/** Everything still relevant at the analysis point, from candle `from` on. Filled gaps, mitigated OBs and swept pools are left out. */
export function analysisOverlay(a: Analysis, from: number, layers: Set<Layer>): ChartOverlay {
  const ov: Required<ChartOverlay> = { zones: [], levels: [], marks: [], bands: [] };
  if (layers.has("range") && a.range) {
    const r = a.range, start = Math.min(r.high.index, r.low.index);
    ov.zones.push({ from: start, top: r.high.price, bottom: r.eq + r.band, cls: "premium", label: "premium" });
    ov.zones.push({ from: start, top: r.eq - r.band, bottom: r.low.price, cls: "discount", label: "discount" });
    ov.levels.push({ from: start, price: r.eq, cls: "eq", label: "50%" });
  }
  if (layers.has("fvg")) for (const g of a.gaps) if (g.index >= from && g.filledAt == null)
    ov.zones.push({ from: g.index - 1, top: g.top, bottom: g.bottom, cls: `fvg-${g.kind}${g.mitigatedAt != null ? " touched" : ""}`, label: "FVG" });
  if (layers.has("ob")) for (const o of a.orderBlocks) if (o.index >= from && o.mitigatedAt == null)
    ov.zones.push({ from: o.index, top: o.high, bottom: o.low, cls: `ob-${o.kind}`, label: o.kind === "bull" ? "+OB" : "−OB" });
  if (layers.has("liquidity")) {
    // Equal highs/lows first, then single swings; skip a level that sits on top of one already drawn.
    const open = a.pools.filter((p) => p.indices[0] >= from && p.sweptAt == null).sort((p, q) => Number(q.equal) - Number(p.equal));
    const drawn: typeof open = [];
    for (const p of open) {
      if (drawn.some((d) => d.kind === p.kind && Math.abs(d.price - p.price) <= a.atr * 0.15)) continue;
      drawn.push(p);
      ov.levels.push({ from: p.indices[0], price: p.price, cls: `liq-${p.kind.toLowerCase()}${p.equal ? " equal" : ""}`, label: p.equal ? (p.kind === "BSL" ? "EQH · BSL" : "EQL · SSL") : p.kind });
    }
  }
  if (layers.has("sweeps")) for (const s of a.sweeps) if (s.index >= from) ov.marks.push({ index: s.index, price: s.level, cls: `sweep sweep-${s.kind.toLowerCase()}`, up: s.kind === "BSL" });
  if (layers.has("swings")) for (const s of a.swings) if (s.index >= from) ov.marks.push({ index: s.index, price: s.price, cls: s.kind === "high" ? "sh" : "sl", up: s.kind === "high" });
  return ov;
}

/** Feedback for one exercise: the right answers highlighted, plus where you clicked. */
export function exerciseOverlay(ex: Exercise, c: Candle[], click?: { index: number; price: number }): ChartOverlay {
  const ov: Required<ChartOverlay> = { zones: [], levels: [], marks: [], bands: [] };
  const t = targets(ex, c);
  for (const g of t.gaps ?? []) ov.zones.push({ from: g.index - 1, top: g.top, bottom: g.bottom, cls: `fvg-${g.kind} target`, label: "FVG" });
  for (const o of t.obs ?? []) ov.zones.push({ from: o.index, top: o.high, bottom: o.low, cls: `ob-${o.kind} target`, label: "OB" });
  for (const p of t.pools ?? []) ov.levels.push({ from: p.indices[0], price: p.price, cls: `liq-${p.kind.toLowerCase()} target`, label: p.equal ? (p.kind === "BSL" ? "equal highs" : "equal lows") : p.kind });
  for (const s of t.sweeps ?? []) ov.bands.push({ index: s.index, cls: "target" });
  if (ex.kind === "pd" && ex.analysis.range) {
    const r = ex.analysis.range, start = Math.min(r.high.index, r.low.index);
    ov.zones.push({ from: start, top: r.high.price, bottom: r.eq + r.band, cls: "premium", label: "premium" });
    ov.zones.push({ from: start, top: r.eq - r.band, bottom: r.low.price, cls: "discount", label: "discount" });
    ov.levels.push({ from: start, price: r.eq, cls: "eq target", label: "50% equilibrium" });
    ov.marks.push({ index: r.high.index, price: r.high.price, cls: "sh", up: true }, { index: r.low.index, price: r.low.price, cls: "sl", up: false });
  }
  if (click) ov.marks.push({ index: click.index, price: click.price, cls: "click", up: true });
  return ov;
}
