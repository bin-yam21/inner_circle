import { describe, expect, it } from "vitest";
import { findLessonAnywhere, models } from "../src/lib/content";
import { SETUPS } from "../src/lib/constants";
import { SCENARIO_KINDS } from "../src/lib/scenarios";
import { windowStatus } from "../src/lib/time";

describe("strategy model content", () => {
  it("loads every model with valid links", () => {
    expect(models.map((m) => m.id)).toEqual(["ote", "turtle-soup", "judas-swing", "silver-bullet"]);
    for (const m of models) {
      for (const id of m.lessons) expect(findLessonAnywhere(id), `${m.id}: lesson ${id}`).toBeTruthy();
      for (const s of m.setups) expect(SETUPS, `${m.id}: setup ${s}`).toContain(s);
      if (m.scenario) expect(SCENARIO_KINDS, `${m.id}: scenario`).toContain(m.scenario);
      for (const w of m.windows) { expect(w.start).toMatch(/^\d{2}:\d{2}$/); expect(w.end).toMatch(/^\d{2}:\d{2}$/); }
      expect(m.steps.length).toBeGreaterThan(2);
      expect(m.checklist.length).toBeGreaterThan(3);
    }
  });
});

describe("windowStatus", () => {
  const w = [{ start: "03:00", end: "04:00", label: "a" }, { start: "10:00", end: "11:00", label: "b" }, { start: "22:00", end: "01:00", label: "night" }];
  it("finds the open window and the next one", () => {
    expect(windowStatus(w, 3 * 60 + 30)).toMatchObject({ active: { label: "a" }, next: { window: { label: "b" }, inMinutes: 390 } });
    expect(windowStatus(w, 5 * 60).active).toBeNull();
  });
  it("handles windows that cross midnight", () => {
    expect(windowStatus(w, 23 * 60).active?.label).toBe("night");
    expect(windowStatus(w, 30).active?.label).toBe("night");
    expect(windowStatus(w, 23 * 60).next).toMatchObject({ window: { label: "a" }, inMinutes: 240 });
  });
});
