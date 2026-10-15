import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courseById, lessonById, lessons, plainText } from "../lib/content";
import type { TutorTurn } from "../lib/ai";
import { db, markActivity } from "../lib/db";
import type { Lesson } from "../lib/types";
import { ConfirmButton, PageHead, useSettings } from "../components/ui";

const SUGGESTIONS = ["How do I tell a breaker from a failure swing?", "What exactly is the mean threshold?", "How do the IPDA 20/40/60-day ranges work?", "When should I use a limit entry vs a stop entry?", "Explain the Judas swing with times", "How do I recover after three losses in a row?"];

function relevant(q: string, pinned?: Lesson): Lesson[] {
  const words = q.toLowerCase().match(/[a-z0-9./]{3,}/g) ?? [];
  const scored = lessons.map((l) => {
    const t = (l.title + " " + l.meta + " " + plainText(l.body)).toLowerCase(), title = l.title.toLowerCase();
    return [words.reduce((s, w) => s + (t.includes(w) ? (title.includes(w) ? 4 : 1) : 0), 0), l] as const;
  }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, l]) => l);
  return [...(pinned ? [pinned] : []), ...scored.filter((l) => l !== pinned)].slice(0, 5);
}
const notesFor = (l: Lesson) => `### ${l.title} (${courseById(l.courseId)?.title})\n${plainText(l.body).slice(0, 6000)}`;

export default function Tutor() {
  const settings = useSettings();
  const [params] = useSearchParams();
  const pinRef = params.get("lesson")?.split(":");
  const pinned = pinRef ? lessonById(pinRef[0], pinRef[1]) : undefined;
  const history = useLiveQuery(() => db.chat.orderBy("id").toArray(), [], []);
  const [input, setInput] = useState(pinned ? `About "${pinned.title}": ` : "");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [history.length, streaming]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming !== null) return;
    setError(""); setInput("");
    await db.chat.add({ role: "user", content: q, at: Date.now() });
    const ctx = relevant(q, pinned).map(notesFor).join("\n\n");
    const past: TutorTurn[] = history.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const turns: TutorTurn[] = [...past, { role: "user", content: `Relevant lesson notes:\n${ctx || "(no close match in the notes)"}\n\nStudent question: ${q}` }];
    if (turns[0]?.role === "assistant") turns.shift();
    ctl.current = new AbortController();
    setStreaming("");
    try {
      const { askTutor } = await import("../lib/ai");
      const answer = await askTutor(settings.apiKey, turns, (t) => setStreaming(t), ctl.current.signal);
      await db.chat.add({ role: "assistant", content: answer, at: Date.now() });
      await markActivity();
    } catch (e) {
      const { tutorErrorMessage } = await import("../lib/ai");
      setError(tutorErrorMessage(e));
    } finally { setStreaming(null); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="More" title="AI tutor" lede="Ask about any lesson. The tutor answers from the course notes and names the lesson to rewatch. It uses Claude through your own Anthropic API key." actions={history.length ? <ConfirmButton onConfirm={() => db.chat.clear()}>Clear chat</ConfirmButton> : undefined} />
      {!settings.apiKey ? (
        <div className="alert warn"><b>Add your API key first.</b> <span>Get a key at console.anthropic.com, then paste it in <Link to="/settings">Settings → AI tutor</Link>. It's stored only on this device and sent only to Anthropic. API usage is billed to your Anthropic account.</span></div>
      ) : (
        <>
          {pinned && <p className="small">Focused on: <b>{pinned.title}</b></p>}
          <div className="chips">{SUGGESTIONS.map((s) => <button key={s} type="button" className="btn ghost" onClick={() => setInput(s)}>{s}</button>)}</div>
          <div className="chat">
            {history.map((m) => <div key={m.id} className={`msg ${m.role === "user" ? "u" : "a"}`}>{m.content}</div>)}
            {streaming !== null && <div className="msg a">{streaming || "Thinking…"}</div>}
            <div ref={end} />
          </div>
          {error && <p className="alert stop small">{error}</p>}
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <label htmlFor="tutor-in" hidden>Your question</label>
            <textarea id="tutor-in" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Ask a question about the lessons…" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button className="btn" type="submit" disabled={streaming !== null}>Ask</button>
              {streaming !== null && <button className="btn ghost" type="button" onClick={() => ctl.current?.abort()}>Stop</button>}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
