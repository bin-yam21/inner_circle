import { useId, type ReactNode } from "react";
import { sceneAt, viewOf, type Color, type Explainer, type TEl, type TScene, type Timeline, type View } from "../lib/explainer";

/** Fixed "studio" palette so explainers look the same in light and dark app themes. */
const COL: Record<Color, string> = { bull: "#2fd3a4", bear: "#ff6b70", liq: "#ffc04d", accent: "#7aa2ff", muted: "#93a0b8", ink: "#eef2fa" };
const W = 1280, H = 720;
const FD = "var(--f-display, system-ui)", FM = "var(--f-mono, monospace)";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
const prog = (t: number, at: number, d = 0.6) => ease((t - at) / d);
const col = (c?: Color, d: Color = "accent") => COL[c ?? d];

export function wrap(text: string, max: number): string[] {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function Pill({ x, y, text, color, anchor = "start", size = 14 }: { x: number; y: number; text: string; color: string; anchor?: "start" | "end" | "middle"; size?: number }) {
  const w = text.length * size * 0.56 + 18, h = size + 12;
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return (
    <g>
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h / 2} fill={color} fillOpacity={0.16} stroke={color} strokeOpacity={0.55} />
      <text x={left + w / 2} y={y + size * 0.35} textAnchor="middle" fill={color} fontFamily={FD} fontWeight={600} fontSize={size}>{text}</text>
    </g>
  );
}

const RANK: Record<string, number> = { zone: 0, level: 1, stops: 2, candles: 3, focus: 4, arrow: 5, marker: 6, text: 7, flow: 8, bars: 8, sessions: 8, big: 9, take: 10 };

export function ExplainerStage({ ex, tl, t, className }: { ex: Explainer; tl: Timeline; t: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const sc = sceneAt(tl, t);
  const local = t - sc.start;
  return (
    <svg className={`xp-svg ${className ?? ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ex.title}: ${sc.title ?? ""}`}>
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0c1424" /><stop offset="1" stopColor="#0a0f1b" /></linearGradient>
        <radialGradient id={`gl${uid}`} cx=".85" cy="0" r=".8"><stop offset="0" stopColor="#3b5bdb" stopOpacity=".28" /><stop offset="1" stopColor="#3b5bdb" stopOpacity="0" /></radialGradient>
        <radialGradient id={`gl2${uid}`} cx=".05" cy="1" r=".7"><stop offset="0" stopColor="#12b886" stopOpacity=".18" /><stop offset="1" stopColor="#12b886" stopOpacity="0" /></radialGradient>
        <pattern id={`gr${uid}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity=".035" /></pattern>
        <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width={W} height={H} fill={`url(#bg${uid})`} />
      <rect width={W} height={H} fill={`url(#gr${uid})`} />
      <rect width={W} height={H} fill={`url(#gl${uid})`} />
      <rect width={W} height={H} fill={`url(#gl2${uid})`} />
      {sc.layout === "title" ? <TitleCard ex={ex} sc={sc} local={local} t={t} /> : <ChartScene ex={ex} tl={tl} sc={sc} t={t} local={local} glow={`url(#glow${uid})`} />}
      <text x={W - 28} y={H - 22} textAnchor="end" fill={COL.muted} fillOpacity={0.5} fontFamily={FM} fontSize={13} letterSpacing="2">TRADING ACADEMY</text>
    </svg>
  );
}

function TitleCard({ ex, sc, local, t }: { ex: Explainer; sc: TScene; local: number; t: number }) {
  const lines = wrap(sc.title ?? ex.title, 20);
  const deco = Array.from({ length: 34 }, (_, i) => {
    const b = 520 + Math.sin(i / 2.6) * 50 + Math.sin(i * 1.3) * 18 - i * 3;
    const up = Math.sin(i * 1.9) > -0.25;
    return { x: 40 + i * 36, y: b, h: 14 + Math.abs(Math.cos(i * 2.2)) * 36, up };
  });
  let wi = 0;
  return (
    <g>
      <g opacity={0.22}>
        {deco.map((d) => { const p = prog(local, d.x / 1400, 0.5); return (
          <g key={d.x} opacity={p}>
            <line x1={d.x} x2={d.x} y1={d.y - d.h / 2 - 16} y2={d.y + d.h / 2 + 16} stroke={COL.muted} strokeWidth={2} />
            <rect x={d.x - 9} y={d.y - (d.h / 2) * p} width={18} height={d.h * p} rx={3} fill={d.up ? COL.bull : COL.bear} />
          </g>); })}
      </g>
      <text x={110} y={210} fill={COL.accent} fontFamily={FM} fontSize={18} letterSpacing="4" opacity={prog(local, 0.1)}>{(sc.title ? ex.title : "EXPLAINER").toUpperCase()}</text>
      {lines.map((ln, li) => (
        <text key={li} x={110} y={300 + li * 86} fill={COL.ink} fontFamily={FD} fontWeight={700} fontSize={76} letterSpacing="-1.5"
          transform={`translate(0 ${(1 - prog(local, 0.25 + li * 0.3, 0.8)) * 34})`}>
          {ln.split(" ").map((w, i) => <tspan key={i} opacity={prog(local, 0.25 + wi++ * 0.12, 0.7)}>{w} </tspan>)}
        </text>
      ))}
      <rect x={110} y={300 + lines.length * 86 - 50} height={6} rx={3} width={260 * prog(local, 0.9, 1)} fill={COL.bull} />
      {(ex.subtitle || sc.title) && (
        <text x={110} y={300 + lines.length * 86 + 10} fill={COL.muted} fontFamily={FD} fontSize={28} opacity={prog(local, 1.2, 0.8)}>{ex.subtitle}</text>
      )}
      <circle cx={1150} cy={150} r={10 + Math.sin(t * 2) * 2} fill={COL.bull} opacity={0.8} />
    </g>
  );
}

function ChartScene({ ex, tl, sc, t, local, glow }: { ex: Explainer; tl: Timeline; sc: TScene; t: number; local: number; glow: string }) {
  const hasPoints = !!sc.points?.length;
  const R = { l: 80, r: hasPoints ? 800 : 1200, t: 150, b: 625 };
  let v: View = viewOf(sc);
  if (sc.carry && sc.index > 0 && local < 0.9) {
    const pv = viewOf(tl.scenes[sc.index - 1]); const k = ease(local / 0.9);
    v = { x0: pv.x0 + (v.x0 - pv.x0) * k, x1: pv.x1 + (v.x1 - pv.x1) * k, y0: pv.y0 + (v.y0 - pv.y0) * k, y1: pv.y1 + (v.y1 - pv.y1) * k };
  }
  const XE = (x: number) => R.l + ((x - v.x0) / (v.x1 - v.x0)) * (R.r - R.l);
  const XC = (x: number) => Math.max(R.l, Math.min(R.r, XE(x))); // clamped to the chart
  const X = (x: number) => XE(x + 0.5);
  const Y = (y: number) => R.b - ((y - v.y0) / (v.y1 - v.y0)) * (R.b - R.t);
  const step = (R.r - R.l) / (v.x1 - v.x0);
  const fade = sc.carry ? 1 : ease(local / 0.45);
  const hasCandles = sc.resolved.some((e) => e.type === "candles");
  const allCandles = sc.resolved.flatMap((e) => e.candles ?? []);
  const els = [...sc.resolved].filter((e) => t >= e.at).sort((a, b) => RANK[a.type] - RANK[b.type]);
  const ctx: Ctx = { t, X, XE, XC, Y, R, step, v, glow, allCandles, sc };

  return (
    <g opacity={fade}>
      <text x={80} y={66} fill={COL.accent} fontFamily={FM} fontSize={15} letterSpacing="3">{ex.title.toUpperCase()} · {sc.index}/{tl.scenes.length - 1}</text>
      <text x={80} y={110} fill={COL.ink} fontFamily={FD} fontWeight={700} fontSize={36} letterSpacing="-0.5" opacity={sc.carry ? prog(local, 0, 0.5) : 1}>{sc.title}</text>
      {hasCandles && [0, 1, 2, 3, 4].map((i) => <line key={i} x1={R.l} x2={R.r} y1={R.t + ((R.b - R.t) * i) / 4} y2={R.t + ((R.b - R.t) * i) / 4} stroke="#fff" strokeOpacity={0.05} />)}
      {els.map((e, i) => <Element key={i} e={e} c={ctx} />)}
      {hasPoints && <Points sc={sc} t={t} />}
    </g>
  );
}

interface Ctx { t: number; X: (x: number) => number; XE: (x: number) => number; XC: (x: number) => number; Y: (y: number) => number; R: { l: number; r: number; t: number; b: number }; step: number; v: View; glow: string; allCandles: { x: number; h: number; l: number }[]; sc: TScene }

function Element({ e, c }: { e: TEl; c: Ctx }): ReactNode {
  const { t, X, XE, XC, Y, R, step } = c;
  const p = prog(t, e.at);
  switch (e.type) {
    case "candles": {
      const stagger = e.stagger ?? 0.09;
      const bw = Math.max(3, step * 0.62);
      return <g>{(e.candles ?? []).map((k, i) => {
        const at = e.at + i * stagger;
        if (t < at) return null;
        const q = ease((t - at) / Math.max(0.25, stagger * 2.2));
        const cl = k.o + (k.c - k.o) * q;
        const hi = Math.max(k.o, cl) + (k.h - Math.max(k.o, k.c)) * q, lo = Math.min(k.o, cl) - (Math.min(k.o, k.c) - k.l) * q;
        const color = k.c >= k.o ? COL.bull : COL.bear;
        const top = Y(Math.max(k.o, cl)), bot = Y(Math.min(k.o, cl));
        return (
          <g key={k.x}>
            <line x1={X(k.x)} x2={X(k.x)} y1={Y(hi)} y2={Y(lo)} stroke={color} strokeOpacity={0.75} strokeWidth={Math.max(1.5, bw * 0.12)} />
            <rect x={X(k.x) - bw / 2} y={top} width={bw} height={Math.max(2, bot - top)} rx={Math.min(3, bw / 5)} fill={color} />
          </g>
        );
      })}</g>;
    }
    case "level": {
      const color = col(e.color, "liq");
      const x1 = e.x1 != null ? XC(e.x1) : R.l, x2 = e.x2 != null ? XC(e.x2 + 1) : R.r;
      const y = Y(e.y);
      return (
        <g>
          <line x1={x1} x2={x1 + (x2 - x1) * p} y1={y} y2={y} stroke={color} strokeWidth={2.2} strokeDasharray={e.solid ? undefined : "8 7"} />
          {e.label && <g opacity={prog(t, e.at + 0.3)}><Pill x={x2} y={y - 18} text={e.label} color={color} anchor="end" /></g>}
        </g>
      );
    }
    case "zone": {
      const color = col(e.color, "accent");
      const x1 = e.x1 != null ? XC(e.x1) : R.l, x2 = e.x2 != null ? XC(e.x2 + 1) : R.r;
      const ya = Y(Math.max(e.y1, e.y2)), yb = Y(Math.min(e.y1, e.y2));
      return (
        <g>
          <rect x={x1} y={ya} width={Math.max(0, (x2 - x1) * p)} height={yb - ya} fill={color} fillOpacity={0.15} stroke={color} strokeOpacity={0.5} strokeDasharray="4 4" rx={4} />
          {e.label && <text x={x1 + 10} y={ya + 22} fill={color} fontFamily={FD} fontWeight={600} fontSize={16} opacity={prog(t, e.at + 0.35)}>{e.label}</text>}
        </g>
      );
    }
    case "arrow": {
      const color = col(e.color, "accent");
      const [ax, ay] = [X(e.from[0]), Y(e.from[1])], [bx, by] = [X(e.to[0]), Y(e.to[1])];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const bend = e.bend ?? 0.18;
      const cx = mx - (dy / len) * len * bend, cy = my + (dx / len) * len * bend;
      const q = prog(t, e.at, e.dur ?? 1);
      const ang = Math.atan2(by - cy, bx - cx);
      const hs = 14;
      return (
        <g filter={c.glow}>
          <path d={`M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - q} />
          {q > 0.85 && <path d={`M${bx} ${by} L${bx - hs * Math.cos(ang - 0.45)} ${by - hs * Math.sin(ang - 0.45)} L${bx - hs * Math.cos(ang + 0.45)} ${by - hs * Math.sin(ang + 0.45)} Z`} fill={color} opacity={(q - 0.85) / 0.15} />}
          {e.label && <g opacity={prog(t, e.at + 0.6)}><Pill x={cx} y={cy + (cy < my ? -16 : 16)} text={e.label} color={color} anchor="middle" /></g>}
        </g>
      );
    }
    case "marker": {
      const color = col(e.color, "liq");
      const x = X(e.x), y = Y(e.y), ph = (t * 1.1) % 1;
      return (
        <g opacity={p}>
          <circle cx={x} cy={y} r={6 + ph * 22} fill="none" stroke={color} strokeOpacity={1 - ph} strokeWidth={2} />
          <circle cx={x} cy={y} r={7} fill={color} filter={c.glow} />
          {e.label && <Pill x={x + (e.dx ?? 0)} y={y + (e.below ? 34 : -34)} text={e.label} color={color} anchor="middle" />}
        </g>
      );
    }
    case "stops": {
      const color = COL.liq;
      const n = Math.max(3, Math.min(7, Math.round(e.x2 - e.x1 + 1)));
      const x1 = XE(e.x1), x2 = XE(e.x2 + 1), y = Y(e.y), dir = e.side === "buy" ? -1 : 1;
      const taken = e.takenAt != null && t >= e.takenAt ? ease((t - e.takenAt) / 0.8) : 0;
      const label = taken > 0.2 ? `${e.side === "buy" ? "Buy" : "Sell"} stops swept` : e.label ?? (e.side === "buy" ? "Buy stops (buy-side liquidity)" : "Sell stops (sell-side liquidity)");
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const pi = prog(t, e.at + i * 0.07, 0.4);
            const cx = x1 + ((x2 - x1) * (i + 0.5)) / n, cy = y + dir * (16 + (i % 2) * 17) + dir * taken * 50;
            return (
              <g key={i} opacity={pi * (1 - taken)} transform={`translate(${cx} ${cy}) scale(${(0.6 + 0.4 * pi) * (1 + taken * 0.6)})`}>
                <rect x={-15} y={-9} width={30} height={18} rx={5} fill={color} fillOpacity={0.2} stroke={color} />
                <text y={5} textAnchor="middle" fill={color} fontFamily={FM} fontWeight={700} fontSize={12}>$</text>
              </g>
            );
          })}
          <g opacity={prog(t, e.at + 0.4)}><Pill x={x1} y={y + dir * 70} text={label} color={taken > 0.2 ? COL.bull : color} anchor="start" size={13} /></g>
        </g>
      );
    }
    case "focus": {
      const color = col(e.color, "accent");
      const inR = c.allCandles.filter((k) => k.x >= e.x1 && k.x <= e.x2);
      const yt = e.y2 != null ? Y(e.y2) : Y(Math.max(...inR.map((k) => k.h), c.v.y0)) - 10;
      const yb = e.y1 != null ? Y(e.y1) : Y(Math.min(...inR.map((k) => k.l), c.v.y1)) + 10;
      const x1 = XE(e.x1) - 4, x2 = XE(e.x2 + 1) + 4;
      return (
        <g filter={c.glow}>
          <rect x={x1} y={yt} width={x2 - x1} height={yb - yt} rx={8} fill={color} fillOpacity={0.06 * p} stroke={color} strokeWidth={2.5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
          {e.label && <g opacity={prog(t, e.at + 0.5)}><Pill x={(x1 + x2) / 2} y={yt - 22} text={e.label} color={color} anchor="middle" /></g>}
        </g>
      );
    }
    case "text": {
      const color = col(e.color, "ink");
      return <text x={X(e.x)} y={Y(e.y) + (1 - p) * 14} opacity={p} textAnchor={e.anchor ?? "middle"} fill={color} fontFamily={FD} fontWeight={600} fontSize={e.size ?? 20}>{e.text}</text>;
    }
    case "flow": {
      const n = e.items.length, gap = 44, bw = (R.r - R.l - gap * (n - 1)) / n, bh = 190, top = (R.t + R.b) / 2 - bh / 2;
      const stagger = e.stagger ?? 1.4;
      return <g>{e.items.map((it, i) => {
        const pi = prog(t, e.at + i * stagger, 0.7);
        if (pi <= 0) return null;
        const x = R.l + i * (bw + gap), color = col(it.color, "accent");
        const lab = wrap(it.label, Math.floor(bw / 13)), sub = wrap(it.sub ?? "", Math.floor(bw / 8.6));
        return (
          <g key={i} opacity={pi} transform={`translate(0 ${(1 - pi) * 24})`}>
            {i > 0 && <path d={`M${x - gap + 8} ${top + bh / 2} L${x - 10} ${top + bh / 2} M${x - 18} ${top + bh / 2 - 7} L${x - 10} ${top + bh / 2} L${x - 18} ${top + bh / 2 + 7}`} stroke={COL.muted} strokeWidth={2.5} fill="none" />}
            <rect x={x} y={top} width={bw} height={bh} rx={16} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.6} strokeWidth={2} />
            <circle cx={x + 26} cy={top + 28} r={13} fill={color} />
            <text x={x + 26} y={top + 33} textAnchor="middle" fill="#0b1220" fontFamily={FD} fontWeight={700} fontSize={14}>{i + 1}</text>
            {lab.map((l, j) => <text key={j} x={x + 18} y={top + 76 + j * 26} fill={COL.ink} fontFamily={FD} fontWeight={700} fontSize={22}>{l}</text>)}
            {sub.map((l, j) => <text key={j} x={x + 18} y={top + 82 + lab.length * 26 + j * 21} fill={COL.muted} fontFamily={FD} fontSize={15.5}>{l}</text>)}
          </g>
        );
      })}</g>;
    }
    case "bars": {
      const n = e.items.length, rowH = Math.min(84, (R.b - R.t) / n), max = e.max ?? Math.max(...e.items.map((i) => i.value)), labelW = 250;
      const full = R.r - R.l - labelW - 150, stagger = e.stagger ?? 1.2;
      const top = (R.t + R.b) / 2 - (rowH * n) / 2;
      return <g>{e.items.map((it, i) => {
        const pi = prog(t, e.at + i * stagger, 0.9);
        if (pi <= 0) return null;
        const y = top + i * rowH + rowH / 2, color = col(it.color, "bull");
        return (
          <g key={i} opacity={Math.min(1, pi * 2)}>
            <text x={R.l + labelW - 18} y={y + 7} textAnchor="end" fill={COL.ink} fontFamily={FD} fontWeight={600} fontSize={21}>{it.label}</text>
            <rect x={R.l + labelW} y={y - rowH * 0.3} height={rowH * 0.6} rx={8} width={Math.max(4, (full * it.value * pi) / max)} fill={color} />
            <text x={R.l + labelW + (full * it.value * pi) / max + 14} y={y + 8} fill={color} fontFamily={FM} fontWeight={700} fontSize={22}>{it.text ?? it.value}</text>
          </g>
        );
      })}</g>;
    }
    case "sessions": {
      const span = R.r - R.l, hx = (h: number) => R.l + (((h - 18 + 24) % 24) / 24) * span;
      const mid = (R.t + R.b) / 2 + 10, bh = 110;
      const sweepX = R.l + clamp01((t - e.at) / Math.max(1, c.sc.end - e.at - 0.5)) * span;
      return (
        <g>
          <rect x={R.l} y={mid - bh / 2} width={span} height={bh} rx={12} fill="#fff" fillOpacity={0.03} stroke="#fff" strokeOpacity={0.08} />
          {Array.from({ length: 9 }, (_, i) => { const h = (18 + i * 3) % 24; const x = R.l + (i * 3 * span) / 24; return (
            <g key={i}><line x1={x} x2={x} y1={mid + bh / 2} y2={mid + bh / 2 + 8} stroke={COL.muted} /><text x={x} y={mid + bh / 2 + 28} textAnchor="middle" fill={COL.muted} fontFamily={FM} fontSize={14}>{String(h).padStart(2, "0")}:00</text></g>); })}
          {e.items.map((it, i) => {
            const pi = prog(t, e.at + 0.4 + i * 0.9, 0.7);
            const a = hx(it.from), b = it.to === 18 ? R.r : hx(it.to), color = col(it.color, "accent");
            return (
              <g key={i} opacity={pi}>
                <rect x={a} y={mid - bh / 2 + 6} width={(b - a) * pi} height={bh - 12} rx={8} fill={color} fillOpacity={0.22} stroke={color} />
                {wrap(it.label, Math.max(6, Math.floor((b - a) / 9))).map((l, j) => <text key={j} x={a + 10} y={mid - bh / 2 + 32 + j * 19} fill={color} fontFamily={FD} fontWeight={600} fontSize={16}>{l}</text>)}
              </g>
            );
          })}
          {e.sweep && <g><line x1={sweepX} x2={sweepX} y1={mid - bh / 2 - 20} y2={mid + bh / 2 + 4} stroke={COL.ink} strokeWidth={2} /><circle cx={sweepX} cy={mid - bh / 2 - 20} r={5} fill={COL.ink} /></g>}
          <text x={R.l} y={mid - bh / 2 - 30} fill={COL.muted} fontFamily={FM} fontSize={14} letterSpacing="2">NEW YORK TIME</text>
        </g>
      );
    }
    case "big": {
      const color = col(e.color, "ink");
      const cx = (R.l + R.r) / 2, cy = (R.t + R.b) / 2;
      return (
        <g opacity={p} transform={`translate(${cx} ${cy}) scale(${0.85 + 0.15 * p}) translate(${-cx} ${-cy})`}>
          <text x={cx} y={cy} textAnchor="middle" fill={color} fontFamily={FD} fontWeight={700} fontSize={62} letterSpacing="-1">{e.text}</text>
          {e.sub && wrap(e.sub, 56).map((l, j) => <text key={j} x={cx} y={cy + 52 + j * 32} textAnchor="middle" fill={COL.muted} fontFamily={FD} fontSize={25}>{l}</text>)}
        </g>
      );
    }
    default: return null;
  }
}

function Points({ sc, t }: { sc: TScene; t: number }) {
  const pts = sc.points ?? [];
  let y = 170;
  return (
    <g>
      <rect x={830} y={140} width={390} height={490} rx={18} fill="#fff" fillOpacity={0.035} stroke="#fff" strokeOpacity={0.08} />
      {pts.map((pt, i) => {
        const at = sc.start + (sc.pointsAt?.[i] ?? ((i + 1) * sc.dur) / (pts.length + 1.6));
        const p = prog(t, at, 0.6);
        const lines = wrap(pt, 28);
        const y0 = y; y += lines.length * 25 + 26;
        return (
          <g key={i} opacity={p} transform={`translate(${(1 - p) * 20} 0)`}>
            <circle cx={862} cy={y0 + 12} r={13} fill={COL.bull} />
            <text x={862} y={y0 + 17} textAnchor="middle" fill="#0b1220" fontFamily={FD} fontWeight={700} fontSize={14}>{i + 1}</text>
            {lines.map((l, j) => <text key={j} x={888} y={y0 + 19 + j * 25} fill={COL.ink} fontFamily={FD} fontSize={19}>{l}</text>)}
          </g>
        );
      })}
    </g>
  );
}
