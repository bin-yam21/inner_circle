/**
 * Automatic backups to a folder you choose (File System Access API: Chrome and Edge).
 * One file per day, the newest KEEP kept. The folder handle lives in its own table
 * ("handles"), which is never part of a backup. Pure helpers are tested in tests/autobackup.test.ts.
 */
import { db } from "./db";
import { exportAll } from "./backup";

export const PREFIX = "trading-academy-backup-";
export const KEEP = 14;
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");
export const backupName = (d: Date) => `${PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
/** Our backup files beyond the newest `keep` (names sort by date). Other files in the folder are never touched. */
export function toPrune(names: string[], keep = KEEP): string[] {
  const ours = names.filter((n) => n.startsWith(PREFIX) && n.endsWith(".json")).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}
export const isDue = (lastAt: number | undefined, now: number) => !lastAt || now - lastAt >= DAY;
export const isStale = (lastAt: number | undefined, now: number, days = 7) => !lastAt || now - lastAt > days * DAY;

// Browser side ---------------------------------------------------------------------------------
type Perm = "granted" | "denied" | "prompt";
interface DirHandle {
  name: string;
  queryPermission(o: { mode: "readwrite" }): Promise<Perm>;
  requestPermission(o: { mode: "readwrite" }): Promise<Perm>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(s: string): Promise<void>; close(): Promise<void> }> }>;
  removeEntry(name: string): Promise<void>;
  keys(): AsyncIterable<string>;
}
type PickerWindow = Window & { showDirectoryPicker?: (o: { id: string; mode: "readwrite" }) => Promise<DirHandle> };

export const supported = () => typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";

export async function getFolder(): Promise<DirHandle | undefined> {
  return (await db.handles.get("backupDir"))?.handle as DirHandle | undefined;
}
export async function chooseFolder(): Promise<string> {
  const handle = await (window as PickerWindow).showDirectoryPicker!({ id: "trading-academy-backups", mode: "readwrite" });
  await db.handles.put({ key: "backupDir", handle });
  return handle.name;
}
export async function forgetFolder() { await db.handles.delete("backupDir"); }

/** Write today's backup into the folder and prune old ones. Returns the file name. */
export async function writeBackup(dir: DirHandle): Promise<string> {
  const name = backupName(new Date());
  const file = await dir.getFileHandle(name, { create: true });
  const w = await file.createWritable();
  await w.write(await exportAll());
  await w.close();
  const names: string[] = [];
  for await (const n of dir.keys()) names.push(n);
  for (const n of toPrune(names)) await dir.removeEntry(n);
  await recordBackup(`folder "${dir.name}"`);
  return name;
}
export async function recordBackup(where: string) {
  await db.settings.put({ key: "lastBackupAt", value: Date.now() });
  await db.settings.put({ key: "lastBackupWhere", value: where });
}

export type AutoResult = "done" | "not-due" | "empty" | "no-folder" | "needs-permission" | "unsupported" | "error";

/** Nothing worth backing up (after "Erase all data", or a fresh install). */
export async function isEmpty() {
  return (await db.trades.count()) + (await db.progress.count()) + (await db.dailyLogs.count()) + (await db.quizAnswers.count()) + (await db.drills.count()) === 0;
}
/**
 * Back up if a folder is set and the last backup is a day old. Browsers forget folder
 * permission after a restart; then this returns "needs-permission" and the UI asks for a click
 * (`resume`), because permission can only be granted from a user action.
 */
export async function runAutoBackup(force = false): Promise<AutoResult> {
  if (!supported()) return "unsupported";
  const dir = await getFolder();
  if (!dir) return "no-folder";
  const last = (await db.settings.get("lastBackupAt"))?.value as number | undefined;
  if (!force && !isDue(last, Date.now())) return "not-due";
  // Never write an empty backup automatically: daily empty files would push your good backups out of the 14 kept.
  if (!force && (await isEmpty())) return "empty";
  try {
    if ((await dir.queryPermission({ mode: "readwrite" })) !== "granted") return "needs-permission";
    await writeBackup(dir);
    return "done";
  } catch { return "error"; }
}
/** Call from a click: re-grants folder permission, then backs up. */
export async function resume(): Promise<AutoResult> {
  const dir = await getFolder();
  if (!dir) return "no-folder";
  if ((await dir.requestPermission({ mode: "readwrite" })) !== "granted") return "needs-permission";
  return runAutoBackup(true);
}

/** Ask the browser not to evict our data under storage pressure. */
export async function persistStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { return false; }
}
