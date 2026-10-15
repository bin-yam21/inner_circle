import { describe, expect, it } from "vitest";
import { modelById } from "../src/lib/content";
import { planContext, planText, rewardToRisk } from "../src/lib/precheck";

const tilt = { level: "ok", message: "No losing streak.", riskFactor: 1 };

describe("rewardToRisk", () => {
  it("computes R:R and rejects wrong geometry", () => {
    expect(rewardToRisk("Long", 1.1, 1.095, 1.115)).toBe(3);
    expect(rewardToRisk("Short", 1.1, 1.105, 1.09)).toBe(2);
    expect(rewardToRisk("Long", 1.1, 1.105, 1.12)).toBeNull(); // stop above a long entry
    expect(rewardToRisk("Long", 1.1, null, 1.12)).toBeNull();
  });
});

describe("planContext", () => {
  const sb = modelById("silver-bullet")!;
  it("reports the model window, bias alignment, tilt and R:R", () => {
    const c = planContext({ ny: { label: "10:20", weekday: "Tue", minutes: 620 }, model: sb, direction: "Short", bias: "Bullish", tilt, entry: 1.1, stop: 1.105, target: 1.09 });
    expect(c).toMatchObject({ rr: 2, alignment: "against", windowOpen: true });
    expect(c.lines.join("\n")).toMatch(/Model window: OPEN \(New York AM Silver Bullet 10:00–11:00\)/);
    expect(c.lines.join("\n")).toMatch(/AGAINST the bias/);
    const closed = planContext({ ny: { label: "12:00", weekday: "Tue", minutes: 720 }, model: sb, direction: "Long", bias: "Bullish", tilt, entry: 1, stop: 0.9, target: 1.3 });
    expect(closed).toMatchObject({ windowOpen: false, alignment: "with", rr: 3 });
    expect(closed.lines[1]).toMatch(/CLOSED \(next: New York PM Silver Bullet in 2h 00m\)/);
  });
});

describe("planText", () => {
  it("includes the plan, context, model rules, ticks and personal rules", () => {
    const m = modelById("ote")!;
    const text = planText({ market: "EUR/USD", direction: "Long", timeframe: "15m", entry: 1.1, stop: 1.095, target: 1.115, notes: "OB in OTE", ticks: { [m.checklist[0]]: true }, context: "CTX" }, m, ["Stop at −2R"]);
    expect(text).toContain("PLAN: Long EUR/USD on the 15m chart · entry 1.1 · stop 1.095 · target 1.115");
    expect(text).toContain("CTX");
    expect(text).toContain(`- [x] ${m.checklist[0]}`);
    expect(text).toContain(`- [ ] ${m.checklist[1]}`);
    expect(text).toContain("- Stop at −2R");
  });
});
