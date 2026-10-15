import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildTimeline, type Explainer } from "../src/lib/explainer";

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "content/explainers");
const all: Explainer[] = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const lessonIds = new Map<string, Set<string>>();
for (const c of fs.readdirSync(path.join(root, "content/courses"))) {
  const ids = fs.readdirSync(path.join(root, "content/courses", c, "lessons")).map((f) => fs.readFileSync(path.join(root, "content/courses", c, "lessons", f), "utf8").match(/^id:\s*(\S+)/m)?.[1]);
  lessonIds.set(c, new Set(ids.filter(Boolean) as string[]));
}

describe("explainer scripts", () => {
  it("has explainers", () => expect(all.length).toBeGreaterThan(0));
  for (const ex of all) {
    describe(ex.id, () => {
      const tl = buildTimeline(ex);
      it("runs about two minutes", () => { expect(tl.total).toBeGreaterThan(75); expect(tl.total).toBeLessThan(150); });
      it("links to real lessons", () => { for (const l of ex.lessons) expect(lessonIds.get(ex.course)?.has(l), `${ex.course}/${l}`).toBe(true); });
      it("sweeps only stops that are on screen", () => {
        ex.scenes.forEach((sc, i) => {
          for (const e of sc.els ?? []) if (e.type === "take") {
            const target = tl.scenes[i].resolved.find((r) => r.type === "stops" && r.id === e.id);
            expect(target, `scene ${i} take ${e.id}`).toBeTruthy();
          }
        });
      });
      it("times every element inside its scene", () => {
        tl.scenes.forEach((s) => { for (const e of s.els ?? []) expect((e.at ?? 0), `${s.title}: ${e.type}`).toBeLessThan(s.dur); });
      });
    });
  }
});
