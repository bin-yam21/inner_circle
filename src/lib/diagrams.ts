/** Draws the four concept diagrams into <svg id="c1".."c4"> elements found in reference content. */
type Candle = [number, number, number, number];
interface Ann {
  zones?: { top: number; bot: number; from?: number; to?: number; cls: string; label?: string; tcls?: string }[];
  lines?: { v: number; cls: string; label?: string; tcls?: string; below?: boolean; from?: number; to?: number }[];
  notes?: { i: number; v: number; dy?: number; dx?: number; text: string; cls?: string; anchor?: string }[];
}
const NS = "http://www.w3.org/2000/svg";
function el(tag: string, attrs: Record<string, string | number>, parent: Element, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
function draw(root: ParentNode, id: string, candles: Candle[], lo: number, hi: number, ann: Ann) {
  const svg = root.querySelector<SVGSVGElement>("#" + id);
  if (!svg || svg.childElementCount) return;
  const W = 560, H = 300, L = 20, R = 150, T = 18, B = 18;
  const n = candles.length, step = (W - L - R) / n, bw = step * 0.56;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B), x = (i: number) => L + step * i + step / 2;
  (ann.zones || []).forEach((z) => {
    const x0 = z.from != null ? x(z.from) - step / 2 : L, x1 = z.to != null ? x(z.to) + step / 2 : W - R + 130;
    el("rect", { x: x0, y: y(z.top), width: x1 - x0, height: y(z.bot) - y(z.top), class: z.cls }, svg);
    if (z.label) el("text", { x: x1 - 6, y: y(z.top) + 14, "text-anchor": "end", class: z.tcls || "lb" }, svg, z.label);
  });
  (ann.lines || []).forEach((l) => {
    const x0 = l.from != null ? x(l.from) - step / 2 : L, x1 = l.to != null ? x(l.to) + step / 2 : W - R + 130;
    el("line", { x1: x0, x2: x1, y1: y(l.v), y2: y(l.v), class: l.cls }, svg);
    if (l.label) el("text", { x: x1 - 4, y: y(l.v) + (l.below ? 14 : -5), "text-anchor": "end", class: l.tcls || "lb" }, svg, l.label);
  });
  candles.forEach(([o, h, l, c], i) => {
    el("line", { x1: x(i), x2: x(i), y1: y(h), y2: y(l), class: "wick" }, svg);
    el("rect", { x: x(i) - bw / 2, y: y(Math.max(o, c)), width: bw, height: Math.max(1.5, Math.abs(y(o) - y(c))), class: c >= o ? "up" : "dn", rx: 1 }, svg);
  });
  (ann.notes || []).forEach((t) => el("text", { x: x(t.i) + (t.dx || 0), y: y(t.v) + (t.dy || 0), "text-anchor": t.anchor || "middle", class: t.cls || "lb" }, svg, t.text));
}
export function drawConceptDiagrams(root: ParentNode) {
  draw(root, "c1", [[12,16,10,15],[15,25,14,24],[24,36,22,35],[35,48,33,46],[46,60,44,58],[58,72,55,70],[70,85,68,83],[83,90,78,80],[80,81,62,64],[64,66,48,50],[50,52,33,36],[36,44,31,42],[42,58,40,56],[56,70,55,68]], 2, 96, {
    zones: [{ top: 90, bot: 50, cls: "z-bear", label: "PREMIUM", tcls: "t-bear" }, { top: 50, bot: 10, cls: "z-bull", label: "DISCOUNT", tcls: "t-bull" }, { top: 40.4, bot: 26.8, cls: "z-acc", label: "OTE 62–79%", tcls: "t-acc" }],
    lines: [{ v: 50, cls: "ln-ink", label: "Equilibrium 50%" }, { v: 90, cls: "ln-acc", label: "Swing high", tcls: "t-acc" }, { v: 10, cls: "ln-acc", label: "Impulse low (stop below)", tcls: "t-acc", below: true }],
    notes: [{ i: 7, v: 90, dy: -8, text: "swing high" }, { i: 11, v: 31, dy: 16, text: "buy zone", cls: "t-bull" }] });
  draw(root, "c2", [[50,54,44,46],[46,48,30,33],[33,42,31,40],[40,46,36,38],[38,40,30,32],[32,38,31,36],[36,37,29.8,31],[31,32,24,29],[29,40,28,39],[39,50,38,49],[49,56,47,55],[55,62,53,61]], 18, 62, {
    zones: [{ top: 30.6, bot: 23.5, from: 7, to: 7, cls: "z-liq" }],
    lines: [{ v: 30, cls: "ln-liq", label: "SSL · equal lows", tcls: "t-liq", below: true, from: 1 }, { v: 46, cls: "ln-acc", label: "Short-term high", tcls: "t-acc", from: 3 }],
    notes: [{ i: 7, v: 24, dy: 14, text: "raid 10–20 pips", cls: "t-liq" }, { i: 9, v: 50, dy: -10, text: "MSS", cls: "t-bull" }] });
  draw(root, "c3", [[66,67,60,61],[61,62,54,55],[55,57,50,51],[51,52,44,45],[45,60,44,59],[59,72,58,71],[71,74,66,68],[68,69,61,62],[62,63,56,58],[58,70,57,69],[69,80,67,78],[78,86,76,85]], 38, 90, {
    zones: [{ top: 58, bot: 52, from: 3, cls: "z-acc", label: "FVG", tcls: "t-acc" }, { top: 51, bot: 45, from: 3, cls: "z-bull", label: "Bullish OB (body)", tcls: "t-bull" }],
    lines: [{ v: 48, cls: "ln-ink", label: "mean threshold", from: 3, below: true }],
    notes: [{ i: 8, v: 56, dy: 16, text: "entry", cls: "t-bull" }, { i: 4, v: 60, dy: -8, text: "displacement" }] });
  draw(root, "c4", [[60,61,50,52],[52,53,40,42],[42,50,41,49],[49,55,48,54],[54,55,45,46],[46,47,35,37],[37,50,36,49],[49,60,48,59],[59,62,52,53],[53,66,52,65],[65,72,63,71]], 30, 76, {
    zones: [{ top: 55, bot: 48, from: 3, cls: "z-bull", label: "Bullish breaker", tcls: "t-bull" }],
    lines: [{ v: 40, cls: "ln-liq", label: "SSL (old low)", tcls: "t-liq", from: 1, to: 6, below: true }],
    notes: [{ i: 5, v: 35, dy: 14, text: "lower low", cls: "t-liq" }, { i: 7, v: 60, dy: -8, text: "breaks high" }, { i: 8, v: 52, dy: 16, text: "retest", cls: "t-bull" }] });
}
