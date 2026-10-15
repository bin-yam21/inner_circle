import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "./ui";

/**
 * Card that runs an AI coach review, streams it in, and shows the last saved one.
 * `run` gets the API key, a progress callback and an abort signal, and must return the full text;
 * `onDone` persists it.
 */
export function AiReview({ title = "AI coach review", saved, savedAt, intro, run, onDone, disabledReason }: {
  title?: string; saved?: string; savedAt?: number; intro: ReactNode; disabledReason?: string;
  run: (apiKey: string, onText: (t: string) => void, signal: AbortSignal) => Promise<string>;
  onDone: (text: string) => Promise<unknown>;
}) {
  const settings = useSettings();
  const [live, setLive] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const ctl = useRef<AbortController | null>(null);

  async function go() {
    setErr(""); setLive("");
    ctl.current = new AbortController();
    try {
      const text = await run(settings.apiKey, (t) => setLive(t), ctl.current.signal);
      await onDone(text);
    } catch (e) {
      const { tutorErrorMessage } = await import("../lib/ai");
      setErr(tutorErrorMessage(e));
    } finally { setLive(null); }
  }

  return (
    <section className="card stack">
      <div className="spread"><h3 style={{ margin: 0 }}>{title}</h3>
        {settings.apiKey && !disabledReason && (live === null
          ? <button type="button" className="btn ghost sm" onClick={go}>{saved ? "Review again" : "Get a review"}</button>
          : <button type="button" className="btn ghost sm" onClick={() => ctl.current?.abort()}>Stop</button>)}
      </div>
      {!settings.apiKey ? <p className="small muted" style={{ margin: 0 }}>Add your Anthropic API key in <Link to="/settings">Settings</Link> to use the AI coach.</p>
        : live !== null ? <div className="review">{live || "Reading…"}</div>
        : saved ? <><div className="review">{saved}</div>{savedAt && <p className="small muted" style={{ margin: 0 }}>Reviewed {new Date(savedAt).toLocaleString()}.</p>}</>
        : <p className="small muted" style={{ margin: 0 }}>{disabledReason ?? intro}</p>}
      {err && <p className="alert stop small" style={{ margin: 0 }}>{err}</p>}
    </section>
  );
}
