/** Pre-trade check: the context the app computes, and the text sent to the AI. Tested in tests/precheck.test.ts. */
import type { BiasDir, Direction, PreCheck, StrategyModel } from "./types";
import { fmtMinutes, windowStatus } from "./time";

export interface PlanContext { rr: number | null; risk: number | null; alignment: "with" | "against" | "none"; windowOpen: boolean | null; lines: string[] }

/** Reward:risk from entry, stop and target (null if missing or the geometry is wrong for the direction). */
export function rewardToRisk(direction: Direction, entry: number | null, stop: number | null, target: number | null): number | null {
  if (entry == null || stop == null || target == null) return null;
  const risk = direction === "Long" ? entry - stop : stop - entry;
  const reward = direction === "Long" ? target - entry : entry - target;
  return risk > 0 && reward > 0 ? Math.round((reward / risk) * 100) / 100 : null;
}

export function planContext(p: {
  ny: { label: string; weekday: string; minutes: number }; model?: StrategyModel; direction: Direction;
  bias?: BiasDir; tilt: { level: string; message: string; riskFactor: number };
  entry: number | null; stop: number | null; target: number | null;
}): PlanContext {
  const rr = rewardToRisk(p.direction, p.entry, p.stop, p.target);
  const alignment = !p.bias || p.bias === "Range" ? "none" : (p.bias === "Bullish") === (p.direction === "Long") ? "with" : "against";
  const ws = p.model ? windowStatus(p.model.windows, p.ny.minutes) : null;
  const lines = [
    `New York time: ${p.ny.weekday} ${p.ny.label}`,
    p.model ? (ws!.active ? `Model window: OPEN (${ws!.active.label} ${ws!.active.start}–${ws!.active.end})` : `Model window: CLOSED (next: ${ws!.next ? `${ws!.next.window.label} in ${fmtMinutes(ws!.next.inMinutes)}` : "none"})`) : "Model: none selected",
    `Today's daily bias (Daily log): ${p.bias || "not set"} → this ${p.direction.toLowerCase()} is ${alignment === "with" ? "WITH the bias" : alignment === "against" ? "AGAINST the bias" : "not tied to a bias"}`,
    `Risk state (tilt guard): ${p.tilt.level.toUpperCase()}: ${p.tilt.message} (risk ×${p.tilt.riskFactor})`,
    `Reward:risk to target: ${rr == null ? "can't compute (check entry, stop and target)" : `${rr}:1`}`,
  ];
  return { rr, risk: p.entry != null && p.stop != null ? Math.abs(p.entry - p.stop) : null, alignment, windowOpen: ws ? !!ws.active : null, lines };
}

/** Everything the AI needs, as plain text. */
export function planText(pc: Pick<PreCheck, "market" | "direction" | "timeframe" | "entry" | "stop" | "target" | "notes" | "ticks" | "context">, model: StrategyModel | undefined, rules: string[]): string {
  const v = (x: number | null) => (x == null ? "—" : String(x));
  return [
    `PLAN: ${pc.direction} ${pc.market || "(market not given)"} on the ${pc.timeframe} chart · entry ${v(pc.entry)} · stop ${v(pc.stop)} · target ${v(pc.target)}`,
    `Trader's notes: ${pc.notes || "(none)"}`,
    "",
    "CONTEXT (computed by the app):", pc.context,
    "",
    model ? [
      `MODEL: ${model.name} (${model.source})`, model.summary,
      "Steps:", ...model.steps.map((s, i) => `${i + 1}. ${s}`),
      `Entry rule: ${model.entry}`, `Stop rule: ${model.stop}`, `Target rule: ${model.target}`, `Invalid if: ${model.invalidation}`,
      `Time windows (New York): ${model.windows.map((w) => `${w.label} ${w.start}–${w.end}`).join("; ")}`,
      "", "CHECKLIST (trader's own ticks):", ...model.checklist.map((c) => `- [${pc.ticks[c] ? "x" : " "}] ${c}`),
    ].join("\n") : "MODEL: none selected. Judge against the personal rules and general ICT process only.",
    "",
    "PERSONAL RULES:", ...(rules.length ? rules.map((r) => `- ${r}`) : ["(none written)"]),
  ].join("\n");
}
