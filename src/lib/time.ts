/** New York clock and ICT killzones (times in America/New_York). */
export interface Zone { name: string; start: number; end: number; tone: "acc" | "bull" | "liq" | "bear"; note: string }
export const ZONES: Zone[] = [
  { name: "Asian range", start: 20 * 60, end: 24 * 60, tone: "acc", note: "Consolidation: orders build" },
  { name: "London open", start: 2 * 60, end: 5 * 60, tone: "bull", note: "Judas swing, then London's real move" },
  { name: "New York open", start: 7 * 60, end: 10 * 60, tone: "liq", note: "8:30 news; continuation or reversal" },
  { name: "London close", start: 10 * 60, end: 12 * 60, tone: "bear", note: "Profit-taking reversal" },
];

export function nyNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const h = Number(get("hour")) % 24, m = Number(get("minute"));
  return { h, m, s: Number(get("second")), minutes: h * 60 + m, weekday: get("weekday"), label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

export function activeZone(minutes: number): Zone | null {
  return ZONES.find((z) => minutes >= z.start && minutes < z.end) ?? null;
}

export function nextZone(minutes: number): { zone: Zone; inMinutes: number } {
  const upcoming = ZONES.map((z) => ({ zone: z, inMinutes: (z.start - minutes + 1440) % 1440 })).filter((x) => x.inMinutes > 0);
  return upcoming.sort((a, b) => a.inMinutes - b.inMinutes)[0];
}

export const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
