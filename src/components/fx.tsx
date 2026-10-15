import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, BadgeCheck, BookA, BookOpen, Brain, ChartCandlestick, Check, Circle, CircleHelp, Clock, Eye, Flame, Footprints,
  GraduationCap, HeartPulse, Layers, LayoutDashboard, Library, ListChecks, Lock, Mountain, Newspaper, NotebookPen, Play,
  ScrollText, Settings, Sparkles, Star, Sun, Target, Trophy, Wrench, X, Zap, TrendingUp, Rewind, SkipForward, Pause, Shuffle, Upload, type LucideProps,
} from "lucide-react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Add an icon: import it above and register it here under a kebab-case name. */
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  "arrow-right": ArrowRight, "badge-check": BadgeCheck, "book-a": BookA, "book-open": BookOpen, brain: Brain,
  "candlestick-chart": ChartCandlestick, check: Check, "circle-help": CircleHelp, clock: Clock, eye: Eye, flame: Flame,
  footprints: Footprints, "graduation-cap": GraduationCap, "heart-pulse": HeartPulse, layers: Layers,
  "layout-dashboard": LayoutDashboard, library: Library, "list-checks": ListChecks, lock: Lock, mountain: Mountain,
  newspaper: Newspaper, "notebook-pen": NotebookPen, play: Play, "scroll-text": ScrollText, settings: Settings,
  sparkles: Sparkles, star: Star, sun: Sun, target: Target, trophy: Trophy, wrench: Wrench, x: X, zap: Zap,
  "trending-up": TrendingUp, rewind: Rewind, "skip-forward": SkipForward, pause: Pause, shuffle: Shuffle, upload: Upload,
};

/** Lucide icon by kebab-case name, e.g. <Icon name="graduation-cap" />. */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name] ?? Circle;
  return <Cmp size={18} strokeWidth={1.9} aria-hidden="true" {...props} />;
}

/** Confetti burst on a full-screen canvas. Call celebrate() from anywhere. */
export function celebrate(power = 1) {
  if (reduced()) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = ["--bull", "--accent", "--liq", "--bear", "--glow"].map((v) => css.getPropertyValue(v).trim() || "#35b896");
  const parts = Array.from({ length: Math.round(140 * power) }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 160, y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 3,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() > 0.5,
  }));
  const start = performance.now();
  const tick = (t: number) => {
    const age = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - age / 2200); ctx.fillStyle = p.c;
      if (p.shape) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (age < 2300) requestAnimationFrame(tick); else canvas.remove();
  };
  requestAnimationFrame(tick);
}

/** Floating "+50 XP" text in the middle of the screen. */
export function floatXp(text: string) {
  if (reduced()) return;
  const el = document.createElement("div");
  el.className = "xp-float"; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/** Counts up from 0 to the value when it appears. */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", ms = 900 }: { value: number; decimals?: number; prefix?: string; suffix?: string; ms?: number }) {
  const [v, setV] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(value); return; }
    const a = from.current, start = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3); setV(a + (value - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = value; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{prefix}{v.toFixed(decimals)}{suffix}</>;
}

/** Animated candlestick ticker drawn in SVG; purely decorative. */
export function CandleHero() {
  const candles = Array.from({ length: 28 }, (_, i) => {
    const base = 60 + Math.sin(i / 3) * 18 + Math.sin(i / 1.3) * 6 + i * 0.9;
    const up = Math.sin(i * 1.7) > -0.2;
    const body = 6 + Math.abs(Math.cos(i * 2.1)) * 12;
    return { i, up, top: base + (up ? 0 : body), bot: base - (up ? body : 0), hi: base + body + 6, lo: base - body - 5 };
  });
  return (
    <svg className="candle-hero" viewBox="0 0 560 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="fadeR" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".35" stopColor="#fff" stopOpacity="1" /></linearGradient>
        <mask id="fadeMask"><rect width="560" height="160" fill="url(#fadeR)" /></mask>
      </defs>
      <g mask="url(#fadeMask)">
        {candles.map((c) => {
          const x = 16 + c.i * 19.5, y = (v: number) => 160 - v;
          return (
            <g key={c.i} className={`hc ${c.up ? "u" : "d"}`} style={{ animationDelay: `${c.i * 55}ms` }}>
              <line x1={x} x2={x} y1={y(c.hi)} y2={y(c.lo)} />
              <rect x={x - 5} y={y(c.top)} width={10} height={Math.max(2, c.top - c.bot)} rx={2} />
            </g>
          );
        })}
        <path className="hero-line" d={candles.map((c, k) => `${k ? "L" : "M"}${16 + c.i * 19.5} ${160 - (c.top + c.bot) / 2}`).join(" ")} />
      </g>
    </svg>
  );
}

/** Thin bar at the top of the window showing how far you've scrolled. */
export function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => { const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; setP(max > 0 ? h.scrollTop / max : 0); };
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  return <div className="read-progress" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />;
}

/** Deterministic generative cover art for a course (no image files needed). */
export function CourseCover({ id, icon }: { id: string; icon: string }) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360, hue2 = (hue + 50) % 360;
  const bars = Array.from({ length: 14 }, (_, i) => 20 + ((h >>> (i % 16)) % 60));
  return (
    <div className="cover" style={{ ["--h1" as string]: hue, ["--h2" as string]: hue2 }}>
      <svg viewBox="0 0 280 120" preserveAspectRatio="none" aria-hidden="true">
        {bars.map((b, i) => <rect key={i} x={i * 20 + 4} y={120 - b} width={12} height={b} rx={3} style={{ animationDelay: `${i * 40}ms` }} />)}
      </svg>
      <span className="cover-icon"><Icon name={icon} size={28} /></span>
    </div>
  );
}
