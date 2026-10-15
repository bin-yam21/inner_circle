/**
 * Motion-graphics explainers: short narrated animations defined as JSON in content/explainers.
 * A script is a list of scenes; each scene has narration (`say`) and timed visual elements (`els`).
 * Element times (`at`) are seconds from the start of their scene. Chart coordinates: x = candle index,
 * y = price (any units; the view auto-fits). See CONTENT_GUIDE.md → "Explainer videos".
 */
export type Color = "bull" | "bear" | "liq" | "accent" | "muted" | "ink";
export type XY = [number, number];
export type OHLC = [number, number, number, number];

export type El =
  | { type: "candles"; at?: number; stagger?: number; x?: number; ohlc?: OHLC[]; walk?: XY[]; vol?: number; seed?: number }
  | { type: "level"; at?: number; y: number; label?: string; color?: Color; x1?: number; x2?: number; solid?: boolean }
  | { type: "zone"; at?: number; y1: number; y2: number; x1?: number; x2?: number; label?: string; color?: Color }
  | { type: "arrow"; at?: number; from: XY; to: XY; label?: string; color?: Color; dur?: number; bend?: number }
  | { type: "marker"; at?: number; x: number; y: number; label?: string; color?: Color; below?: boolean; /** shift the label sideways, in pixels */ dx?: number }
  | { type: "stops"; id?: string; at?: number; x1: number; x2: number; y: number; side: "buy" | "sell"; takenAt?: number; label?: string }
  | { type: "focus"; at?: number; x1: number; x2: number; y1?: number; y2?: number; label?: string; color?: Color }
  | { type: "text"; at?: number; x: number; y: number; text: string; color?: Color; size?: number; anchor?: "start" | "middle" | "end" }
  | { type: "flow"; at?: number; stagger?: number; items: { label: string; sub?: string; color?: Color }[] }
  | { type: "bars"; at?: number; stagger?: number; max?: number; items: { label: string; value: number; text?: string; color?: Color }[] }
  | { type: "sessions"; at?: number; sweep?: boolean; items: { from: number; to: number; label: string; color?: Color }[] }
  | { type: "big"; at?: number; text: string; sub?: string; color?: Color }
  /** Sweep stops drawn in an earlier scene (match by id). The scene must carry them. */
  | { type: "take"; id: string; at?: number };

export interface Scene {
  title?: string;
  layout?: "title" | "chart";
  say: string;
  dur?: number;
  /** true: keep every element of the previous scene; "chart": keep only candles, levels, zones and stops. */
  carry?: boolean | "chart";
  points?: string[];
  pointsAt?: number[];
  view?: { x?: [number, number]; y?: [number, number] };
  els?: El[];
}

export interface Explainer {
  id: string;
  title: string;
  subtitle?: string;
  course: string;
  lessons: string[];
  order: number;
  scenes: Scene[];
}

export interface Candle { x: number; o: number; h: number; l: number; c: number }
export type TEl = El & { at: number; candles?: Candle[] };
export interface TScene extends Scene { index: number; start: number; dur: number; end: number; resolved: TEl[]; sentences: { text: string; start: number; end: number }[] }
export interface Timeline { scenes: TScene[]; total: number }

const WPS = 2.4; // narration speed, words per second
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const sentencesOf = (s: string) => s.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Turn an `ohlc` list or a `walk` of waypoints into candles. Deterministic. */
export function buildCandles(el: Extract<El, { type: "candles" }>): Candle[] {
  if (el.ohlc) return el.ohlc.map(([o, h, l, c], i) => ({ x: (el.x ?? 0) + i, o, h, l, c }));
  const w = el.walk ?? [];
  if (w.length < 2) return [];
  const span = Math.max(...w.map((p) => p[1])) - Math.min(...w.map((p) => p[1])) || 10;
  const vol = el.vol ?? span * 0.035;
  const r = rng((el.seed ?? 7) * 9973 + w[0][0] * 31 + Math.round(w[0][1] * 13));
  const out: Candle[] = [];
  let prev = w[0][1];
  for (let s = 0; s < w.length - 1; s++) {
    const [x0, y0] = w[s], [x1, y1] = w[s + 1];
    for (let x = x0 + (s === 0 ? 0 : 1); x <= x1; x++) {
      const k = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
      const target = y0 + (y1 - y0) * k;
      const c = x === x1 ? y1 : target + (r() - 0.5) * vol * 1.4;
      const o = s === 0 && x === x0 ? y0 - (y1 - y0) / Math.max(1, x1 - x0) * 0.6 : prev;
      const h = Math.max(o, c) + r() * vol * 0.9, l = Math.min(o, c) - r() * vol * 0.9;
      out.push({ x, o, h, l, c }); prev = c;
    }
  }
  return out;
}

export function buildTimeline(ex: Explainer): Timeline {
  let t = 0;
  const scenes: TScene[] = [];
  ex.scenes.forEach((sc, index) => {
    const n = words(sc.say);
    const speech = n / WPS;
    const dur = sc.dur ?? Math.max(5, speech + 2);
    const own: TEl[] = (sc.els ?? []).map((e) => ({
      ...e, at: t + (e.at ?? 0),
      ...(e.type === "candles" ? { candles: buildCandles(e) } : {}),
      ...(e.type === "stops" && e.takenAt != null ? { takenAt: t + e.takenAt } : {}),
    }) as TEl);
    const prev = scenes[index - 1];
    let carried = !sc.carry || !prev ? [] : sc.carry === true ? prev.resolved
      : prev.resolved.filter((e) => ["candles", "level", "zone", "stops"].includes(e.type));
    for (const tk of own) if (tk.type === "take")
      carried = carried.map((e) => (e.type === "stops" && e.id === tk.id && e.takenAt == null ? { ...e, takenAt: tk.at } : e));
    // captions: sentence timing proportional to word count across the estimated speech
    const sents = sentencesOf(sc.say);
    let acc = t + 0.3;
    const scale = Math.min(1, (dur - 0.6) / Math.max(speech, 0.1));
    const sentences = sents.map((text) => { const d = (words(text) / WPS) * scale; const s = { text, start: acc, end: acc + d }; acc += d; return s; });
    scenes.push({ ...sc, index, start: t, dur, end: t + dur, resolved: [...carried, ...own], sentences });
    t += dur;
  });
  return { scenes, total: t };
}

export function sceneAt(tl: Timeline, t: number): TScene {
  return tl.scenes.find((s) => t < s.end) ?? tl.scenes[tl.scenes.length - 1];
}

export interface View { x0: number; x1: number; y0: number; y1: number }

export function viewOf(s: TScene): View {
  const cs = s.resolved.flatMap((e) => e.candles ?? []);
  const ys: number[] = [];
  for (const c of cs) ys.push(c.h, c.l);
  for (const e of s.resolved) {
    if (e.type === "level" || e.type === "stops") ys.push(e.y);
    if (e.type === "zone") ys.push(e.y1, e.y2);
    if (e.type === "marker") ys.push(e.y);
    if (e.type === "arrow") ys.push(e.from[1], e.to[1]);
  }
  const xs = cs.map((c) => c.x);
  let x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) + 1 : 100;
  if (xs.length) x1 += 5; // room on the right for labels
  let y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : 100;
  const pad = (y1 - y0 || 10) * 0.12; y0 -= pad; y1 += pad;
  // stops draw chips and a label beyond their level: make room so they never reach the title
  const room = (y1 - y0) * 0.2;
  for (const e of s.resolved) if (e.type === "stops") { if (e.side === "buy") y1 = Math.max(y1, e.y + room); else y0 = Math.min(y0, e.y - room); }
  if (s.view?.x) [x0, x1] = s.view.x;
  if (s.view?.y) [y0, y1] = s.view.y;
  return { x0, x1, y0, y1 };
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
