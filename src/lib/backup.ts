import { db, TABLES } from "./db";

/** Full export of every table. Blobs (screenshots, attached files) are embedded as base64 data URLs. */
export async function exportAll(): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    const rows = await (db as unknown as Record<string, { toArray(): Promise<Record<string, unknown>[]> }>)[name].toArray();
    out[name] = await Promise.all(rows.map(encodeRow));
  }
  return JSON.stringify({ app: "trading-academy", version: 1, exportedAt: new Date().toISOString(), data: out });
}

export async function importAll(json: string, mode: "merge" | "replace"): Promise<number> {
  const parsed = JSON.parse(json);
  if (parsed?.app !== "trading-academy" || typeof parsed.data !== "object") throw new Error("This file isn't a Trading Academy backup.");
  let count = 0;
  await db.transaction("rw", db.tables, async () => {
    for (const name of TABLES) {
      const rows = (parsed.data[name] ?? []) as Record<string, unknown>[];
      const table = db.table(name);
      if (mode === "replace") await table.clear();
      const decoded = await Promise.all(rows.map(decodeRow));
      await table.bulkPut(decoded);
      count += decoded.length;
    }
  });
  return count;
}

async function encodeRow(row: Record<string, unknown>) {
  const copy: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(copy)) if (v instanceof Blob) copy[k] = { __blob: await blobToDataUrl(v) };
  return copy;
}
async function decodeRow(row: Record<string, unknown>) {
  const copy: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(copy)) if (v && typeof v === "object" && "__blob" in (v as object)) copy[k] = await (await fetch((v as { __blob: string }).__blob)).blob();
  return copy;
}
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });

export function downloadText(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function tradesToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => { const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
