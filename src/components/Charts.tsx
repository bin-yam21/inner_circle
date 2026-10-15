import type { ChartOverlay } from "../lib/overlay";

/** Small dependency-free SVG charts. */
export function EquityChart({ points }: { points: { i: number; cum: number; date: string }[] }) {
  if (points.length < 2) return <p className="empty">The equity curve appears after two trades.</p>;
  const W = 720, H = 240, P = { l: 44, r: 14, t: 14, b: 26 };
  const vals = [0, ...points.map((p) => p.cum)];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => P.l + ((i) / points.length) * (W - P.l - P.r);
  const y = (v: number) => P.t + ((hi - v) / span) * (H - P.t - P.b);
  const path = ["M", x(0), y(0), ...points.flatMap((p) => ["L", x(p.i), y(p.cum)])].join(" ");
  const area = `${path} L ${x(points.length)} ${y(lo)} L ${x(0)} ${y(lo)} Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Equity curve in R">
        {ticks.map((t, k) => <g key={k}><line className="axis" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} /><text x={P.l - 6} y={y(t) + 4} textAnchor="end">{t.toFixed(1)}R</text></g>)}
        <line className="zero" x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} />
        <path className="area" d={area} />
        <path className="line" d={path} />
        <circle cx={x(points.length)} cy={y(points[points.length - 1].cum)} r={4} fill="var(--accent)" />
        <text x={P.l} y={H - 6}>{points[0].date}</text>
        <text x={W - P.r} y={H - 6} textAnchor="end">{points[points.length - 1].date}</text>
      </svg>
    </div>
  );
}

export function RBars({ data }: { data: { key: string; totalR: number }[] }) {
  if (!data.length) return null;
  const W = 720, row = 26, H = data.length * row + 10, mid = 260;
  const max = Math.max(...data.map((d) => Math.abs(d.totalR)), 1);
  const scale = (W - mid - 60) / max;
  return (
    <div className="chartbox bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Total R by group">
        {data.map((d, i) => {
          const w = Math.abs(d.totalR) * scale, y = 6 + i * row;
          return (
            <g key={d.key}>
              <text x={mid - 10} y={y + 15} textAnchor="end">{d.key}</text>
              <rect className={d.totalR >= 0 ? "b-pos" : "b-neg"} x={d.totalR >= 0 ? mid : mid - w} y={y + 3} width={Math.max(w, 1)} height={row - 10} rx={2} />
              <text x={d.totalR >= 0 ? mid + w + 6 : mid + 6} y={y + 15}>{(d.totalR > 0 ? "+" : "") + d.totalR.toFixed(1)}R</text>
            </g>
          );
        })}
        <line className="axis" x1={mid} x2={mid} y1={0} y2={H} />
      </svg>
    </div>
  );
}

/** Candlestick chart for the replay trainer and chart drills. Click to pick a price (and the candle under it). */
export function CandleChart({ candles, firstIndex, lines = [], markIndex, decimals, onPick, futureSlots = 10, overlay }: {
  candles: { t: number; o: number; h: number; l: number; c: number }[];
  firstIndex: number;
  lines?: { price: number; label: string; cls: string }[];
  /** Absolute index of a candle to mark with a vertical line (e.g. where the drill started). */
  markIndex?: number;
  decimals: number;
  onPick?: (price: number, index: number) => void;
  futureSlots?: number;
  overlay?: ChartOverlay;
}) {
  if (!candles.length) return <p className="empty">No candles to show.</p>;
  const W = 900, H = 420, P = { l: 8, r: 74, t: 12, b: 24 };
  const prices = [...candles.flatMap((k) => [k.h, k.l]), ...lines.map((l) => l.price)];
  let lo = Math.min(...prices), hi = Math.max(...prices);
  const pad = (hi - lo) * 0.06 || hi * 0.001; lo -= pad; hi += pad;
  const slots = candles.length + futureSlots;
  const cw = (W - P.l - P.r) / slots;
  const x = (i: number) => P.l + i * cw + cw / 2;
  const y = (v: number) => P.t + ((hi - v) / (hi - lo)) * (H - P.t - P.b);
  const fmt = (v: number) => v.toFixed(decimals);
  const ticks = Array.from({ length: 6 }, (_, k) => lo + ((hi - lo) * k) / 5);
  const step = Math.max(1, Math.round(candles.length / 6));
  const label = (t: number) => { const d = new Date(t); const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; return hm === "00:00" ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : hm; };
  const last = candles[candles.length - 1];

  function pick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const vy = ((e.clientY - r.top) / r.height) * H, vx = ((e.clientX - r.left) / r.width) * W;
    const rel = Math.max(0, Math.min(candles.length - 1, Math.floor((vx - P.l) / cw)));
    onPick(Number((hi - ((vy - P.t) / (H - P.t - P.b)) * (hi - lo)).toFixed(decimals)), firstIndex + rel);
  }
  // Overlay geometry: clip to the plot so off-screen structures don't spill over the axis.
  const rx = (abs: number) => Math.max(P.l, x(abs - firstIndex) - cw / 2);
  const right = x(candles.length - 1) + cw / 2;
  const visible = (abs: number) => abs <= firstIndex + candles.length - 1;
  const ov = overlay ?? {};
  return (
    <div className="chartbox candles">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Candlestick chart, last close ${fmt(last.c)}`} onClick={pick} style={{ cursor: onPick ? "crosshair" : undefined }}>
        {ticks.map((t, k) => <g key={k}><line className="axis" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} /><text x={W - P.r + 6} y={y(t) + 4}>{fmt(t)}</text></g>)}
        {candles.map((k, i) => i % step === 0 && <text key={"t" + i} x={x(i)} y={H - 6} textAnchor="middle">{label(k.t)}</text>)}
        {markIndex != null && markIndex >= firstIndex && markIndex < firstIndex + candles.length && (
          <line className="mark" x1={x(markIndex - firstIndex) + cw / 2} x2={x(markIndex - firstIndex) + cw / 2} y1={P.t} y2={H - P.b} />
        )}
        <defs><clipPath id="plot"><rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} /></clipPath></defs>
        <g clipPath="url(#plot)" className="overlay">
          {(ov.bands ?? []).filter((b) => b.index >= firstIndex && visible(b.index)).map((b, i) => <rect key={"b" + i} className={`band ${b.cls}`} x={x(b.index - firstIndex) - cw / 2} width={cw} y={P.t} height={H - P.t - P.b} />)}
          {(ov.zones ?? []).filter((z) => visible(z.from)).map((z, i) => (
            <g key={"z" + i} className={`zone ${z.cls}`}>
              <rect x={rx(z.from)} width={Math.max(2, right - rx(z.from))} y={y(z.top)} height={Math.max(1, y(z.bottom) - y(z.top))} />
              {z.label && <text x={rx(z.from) + 3} y={y(z.top) - 3}>{z.label}</text>}
            </g>
          ))}
          {(ov.levels ?? []).filter((l) => visible(l.from)).map((l, i) => (
            <g key={"l" + i} className={`level ${l.cls}`}>
              <line x1={rx(l.from)} x2={right} y1={y(l.price)} y2={y(l.price)} />
              {l.label && <text x={right - 3} y={y(l.price) - 3} textAnchor="end">{l.label}</text>}
            </g>
          ))}
        </g>
        {candles.map((k, i) => {
          const up = k.c >= k.o;
          return (
            <g key={k.t} className={up ? "cd-up" : "cd-dn"}>
              <line x1={x(i)} x2={x(i)} y1={y(k.h)} y2={y(k.l)} />
              <rect x={x(i) - cw * 0.35} width={cw * 0.7} y={y(Math.max(k.o, k.c))} height={Math.max(1, Math.abs(y(k.o) - y(k.c)))} />
            </g>
          );
        })}
        <g clipPath="url(#plot)" className="overlay">
          {(ov.marks ?? []).filter((m) => m.index >= firstIndex && visible(m.index)).map((m, i) => {
            const mx = x(m.index - firstIndex), my = y(m.price) + (m.up ? -6 : 6), s = Math.max(3, Math.min(6, cw * 0.4));
            return <polygon key={"m" + i} className={`mark-pt ${m.cls}`} points={m.up ? `${mx - s},${my - s} ${mx + s},${my - s} ${mx},${my}` : `${mx - s},${my + s} ${mx + s},${my + s} ${mx},${my}`} />;
          })}
        </g>
        {lines.map((l) => (
          <g key={l.label} className={`lvl ${l.cls}`}>
            <line x1={P.l} x2={W - P.r} y1={y(l.price)} y2={y(l.price)} />
            <rect x={W - P.r + 2} y={y(l.price) - 9} width={P.r - 4} height={18} rx={3} />
            <text x={W - P.r + 6} y={y(l.price) + 4}>{l.label[0]} {fmt(l.price)}</text>
          </g>
        ))}
        <g className="lvl last"><line x1={x(candles.length - 1)} x2={W - P.r} y1={y(last.c)} y2={y(last.c)} /></g>
      </svg>
    </div>
  );
}
