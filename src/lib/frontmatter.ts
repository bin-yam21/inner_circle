/** Minimal "---" frontmatter parser: `key: value` lines, values kept as strings. */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].trim();
  }
  const body = text.slice(end + 4).replace(/^\n+/, "");
  return { data, body };
}
