import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, uid } from "../lib/db";
import { courses } from "../lib/content";
import type { Material, MaterialType } from "../lib/types";
import { ConfirmButton, Empty, Markdown, PageHead, SavedCheckbox, toast } from "../components/ui";

const TYPES: [MaterialType, string][] = [["note", "Note"], ["link", "Link"], ["video", "Video link"], ["pdf", "PDF"], ["image", "Image"], ["file", "Other file"]];
const blank = (): Material => ({ id: uid("m"), title: "", type: "note", url: "", body: "", tags: [], course: "", done: false, createdAt: Date.now() });

export default function Library() {
  const items = useLiveQuery(() => db.materials.orderBy("createdAt").reverse().toArray(), [], []);
  const [draft, setDraft] = useState<Material | null>(null);
  const [tagText, setTagText] = useState("");
  const [q, setQ] = useState(""); const [type, setType] = useState(""); const [open, setOpen] = useState<string | null>(null);
  const tags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items]);
  const shown = items.filter((i) => (!type || i.type === type) && (!q || (i.title + " " + i.body + " " + i.tags.join(" ") + " " + (i.url ?? "")).toLowerCase().includes(q.toLowerCase())));

  const start = (m?: Material) => { setDraft(m ? { ...m } : blank()); setTagText(m ? m.tags.join(", ") : ""); };
  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) { toast("Give it a title"); return; }
    await db.materials.put({ ...draft, title: draft.title.trim(), tags: tagText.split(",").map((t) => t.trim()).filter(Boolean) });
    setDraft(null); toast("Saved to your library");
  }
  function openFile(m: Material) {
    if (!m.file) return;
    const url = URL.createObjectURL(m.file);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const set = <K extends keyof Material>(k: K, v: Material[K]) => draft && setDraft({ ...draft, [k]: v });

  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="My library" lede="Your own study material: notes (Markdown), links, YouTube or video links, PDFs, images and files. Everything is stored on this device and searchable." actions={<button type="button" className="btn" onClick={() => start()}>+ Add material</button>} />

      {draft && (
        <section className="card stack">
          <h3 style={{ margin: 0 }}>{items.some((i) => i.id === draft.id) ? "Edit material" : "Add material"}</h3>
          <div className="form">
            <label className="field" style={{ gridColumn: "span 2" }}><span>Title</span><input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. ICT 2022 model notes" /></label>
            <label className="field"><span>Type</span><select value={draft.type} onChange={(e) => set("type", e.target.value as MaterialType)}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Related course</span><select value={draft.course ?? ""} onChange={(e) => set("course", e.target.value)}><option value="">None</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            {(draft.type === "link" || draft.type === "video") && <label className="field wide"><span>URL</span><input value={draft.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></label>}
            {(draft.type === "pdf" || draft.type === "image" || draft.type === "file") && (
              <label className="field wide"><span>File {draft.fileName ? `· ${draft.fileName}` : ""}</span>
                <input type="file" accept={draft.type === "pdf" ? "application/pdf" : draft.type === "image" ? "image/*" : undefined} onChange={(e) => { const f = e.target.files?.[0]; if (f) setDraft({ ...draft, file: f, fileName: f.name, title: draft.title || f.name.replace(/\.[^.]+$/, "") }); }} />
              </label>
            )}
            <label className="field wide"><span>Notes (Markdown supported)</span><textarea style={{ minHeight: 160 }} value={draft.body ?? ""} onChange={(e) => set("body", e.target.value)} placeholder={"## Key ideas\n- …"} /></label>
            <label className="field wide"><span>Tags (comma separated)</span><input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="ICT, order blocks, 2022 model" /></label>
          </div>
          <div className="row"><button type="button" className="btn" onClick={save}>Save</button><button type="button" className="btn ghost" onClick={() => setDraft(null)}>Cancel</button></div>
        </section>
      )}

      <div className="form three card">
        <label className="field"><span>Search</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, text or tag" /></label>
        <label className="field"><span>Type</span><select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="field"><span>Tags</span><div className="chipset">{tags.slice(0, 12).map((t) => <button key={t} type="button" className="chip" aria-pressed={q === t} onClick={() => setQ(q === t ? "" : t)}>{t}</button>)}</div></div>
      </div>

      {shown.length ? shown.map((m) => (
        <article key={m.id} className="card stack">
          <div className="spread">
            <div className="row"><SavedCheckbox id={`md-${m.id}`} label="Studied" checked={m.done} onChange={(v) => db.materials.update(m.id, { done: v })} /><h3 style={{ margin: 0 }}>{m.title}</h3><span className="pill">{TYPES.find((t) => t[0] === m.type)?.[1]}</span>{m.done && <span className="pill g">studied</span>}</div>
            <div className="row">
              {m.url && <a className="btn ghost sm" href={m.url} target="_blank" rel="noopener noreferrer">Open link</a>}
              {m.file && <button type="button" className="btn ghost sm" onClick={() => openFile(m)}>Open file</button>}
              {m.body && <button type="button" className="btn ghost sm" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? "Hide notes" : "Read notes"}</button>}
              <button type="button" className="btn ghost sm" onClick={() => start(m)}>Edit</button>
              <ConfirmButton onConfirm={() => db.materials.delete(m.id)} />
            </div>
          </div>
          {(m.tags.length > 0 || m.course) && <div className="tagrow">{m.course && <span className="pill y">{courses.find((c) => c.id === m.course)?.title}</span>}{m.tags.map((t) => <span key={t} className="pill">{t}</span>)}</div>}
          {open === m.id && m.body && <Markdown md={m.body} />}
        </article>
      )) : <Empty>{items.length ? "Nothing matches your search." : "Your library is empty. Add notes, links, videos or PDFs from any course or mentor."}</Empty>}
    </div>
  );
}
