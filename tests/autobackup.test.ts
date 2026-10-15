import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { backupName, isDue, isStale, toPrune, KEEP } from "../src/lib/autobackup";
import { exportAll, importAll } from "../src/lib/backup";
import { db } from "../src/lib/db";

describe("backup file names and pruning", () => {
  it("names one file per day", () => {
    expect(backupName(new Date(2026, 9, 5, 23, 59))).toBe("trading-academy-backup-2026-10-05.json");
  });
  it("prunes only our oldest files beyond the limit", () => {
    const ours = Array.from({ length: KEEP + 3 }, (_, i) => backupName(new Date(2026, 8, 1 + i)));
    const names = [...ours.slice().reverse(), "notes.txt", "trading-academy-backup-old.txt"];
    expect(toPrune(names)).toEqual(ours.slice(0, 3));
    expect(toPrune(ours.slice(0, 5))).toEqual([]);
  });
  it("is due daily and stale after a week", () => {
    const now = Date.UTC(2026, 9, 15, 12);
    expect(isDue(undefined, now)).toBe(true);
    expect(isDue(now - 23 * 3_600_000, now)).toBe(false);
    expect(isDue(now - 25 * 3_600_000, now)).toBe(true);
    expect(isStale(now - 6 * 86_400_000, now)).toBe(false);
    expect(isStale(now - 8 * 86_400_000, now)).toBe(true);
  });
});

describe("backups never contain the API key", () => {
  it("leaves the key out of the export and keeps it on a replace-restore", async () => {
    await db.settings.bulkPut([{ key: "apiKey", value: "sk-ant-secret" }, { key: "accountSize", value: 5000 }]);
    await db.handles.put({ key: "backupDir", handle: { fake: true } });
    const json = await exportAll();
    expect(json).not.toContain("sk-ant-secret");
    expect(json).not.toContain("backupDir");
    const parsed = JSON.parse(json);
    expect(parsed.data.settings).toEqual([{ key: "accountSize", value: 5000 }]);

    await db.settings.put({ key: "accountSize", value: 999 });
    await importAll(json, "replace");
    expect((await db.settings.get("accountSize"))?.value).toBe(5000);
    expect((await db.settings.get("apiKey"))?.value).toBe("sk-ant-secret");
  });
});
