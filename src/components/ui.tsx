import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_SETTINGS, db, type AppSettings } from "../lib/db";
import { renderMarkdown } from "../lib/markdown";
import { drawConceptDiagrams } from "../lib/diagrams";
import { Icon } from "./fx";

export function useSettings(): AppSettings {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  return useMemo(() => {
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const r of rows ?? []) out[r.key] = r.value;
    return out as unknown as AppSettings;
  }, [rows]);
}

export function PageHead({ eyebrow, title, lede, actions }: { eyebrow: string; title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header>
      <div className="page-head">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
        {actions && <div className="row">{actions}</div>}
      </div>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

export function Stat({ k, v, s, icon }: { k: string; v: ReactNode; s?: ReactNode; icon?: string }) {
  return <div className="card stat"><div className="k">{icon && <Icon name={icon} size={14} />}{k}</div><div className="v">{v}</div>{s && <div className="s">{s}</div>}</div>;
}

export function Ring({ value, label, sub }: { value: number; label: string; sub: string }) {
  const c = 238.8, off = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div className="card stat ring">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--glow)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient></defs>
        <circle className="bg" cx="46" cy="46" r="38" />
        <circle className="fg" cx="46" cy="46" r="38" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 46 46)" />
        <text x="46" y="54" textAnchor="middle">{Math.round(value * 100)}%</text>
      </svg>
      <div><div className="k">{label}</div><div className="s">{sub}</div></div>
    </div>
  );
}

export function Bar({ value }: { value: number }) {
  return <div className="bar"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} /></div>;
}

export function Markdown({ md, className = "md" }: { md: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(md), [md]);
  useEffect(() => { if (ref.current) drawConceptDiagrams(ref.current); }, [html]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Empty({ children }: { children: ReactNode }) { return <p className="empty">{children}</p>; }

export function Chips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="chipset" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        return <button type="button" key={o} className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>;
      })}
    </div>
  );
}

export function Scale({ value, onChange, label, max = 5 }: { value: number; onChange: (n: number) => void; label: string; max?: number }) {
  return (
    <div className="scale" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button type="button" key={n} className="btn ghost" aria-pressed={value === n} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: [T, string][]; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {tabs.map(([k, l]) => <button type="button" className="btn ghost" key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg; el.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 1900);
}

/** Two-step delete button: first click arms, second confirms (no blocking dialogs). */
export function ConfirmButton({ onConfirm, children = "Delete", className = "btn ghost sm" }: { onConfirm: () => void; children?: ReactNode; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className={armed ? "btn danger sm" : className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>{armed ? "Click again to confirm" : children}</button>;
}

/** Checkbox that flips instantly while the database write happens in the background. */
export function SavedCheckbox({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  const [local, setLocal] = useState(checked);
  useEffect(() => { setLocal(checked); }, [checked]);
  return <input type="checkbox" id={id} aria-label={label} checked={local} onChange={(e) => { setLocal(e.target.checked); onChange(e.target.checked); }} />;
}

export function useDebounced<T>(value: T, ms = 600): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/**
 * Saves `value` once it stops changing for `ms`, but only after the user has edited it (`dirty`),
 * so loading a record never writes it back. Anything still pending is saved when the component
 * unmounts, so leaving the page right after typing doesn't lose the last edit.
 * Returns when it last saved (for a "Saved" indicator).
 */
export function useAutosave<T>(value: T, dirty: boolean, save: (v: T) => unknown, ms = 800): number | null {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const pending = useRef<{ v: T } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const alive = useRef(true);
  useEffect(() => {
    if (!dirty) return;
    pending.current = { v: value };
    const t = setTimeout(async () => {
      pending.current = null;
      await saveRef.current(value);
      if (alive.current) setSavedAt(Date.now());
    }, ms);
    return () => clearTimeout(t);
  }, [value, dirty, ms]);
  useEffect(() => () => { alive.current = false; if (pending.current) saveRef.current(pending.current.v); }, []);
  return savedAt;
}

export function SavedNote({ at }: { at: number | null }) {
  return <span className="saved" aria-live="polite">{at ? `Saved ${new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>;
}
