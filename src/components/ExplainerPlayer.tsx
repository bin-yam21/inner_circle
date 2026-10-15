import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildTimeline, fmtTime, sceneAt, sentencesOf, type Explainer } from "../lib/explainer";
import { db, markActivity } from "../lib/db";
import { XP } from "../lib/xp";
import { ExplainerStage } from "./ExplainerStage";
import { Icon, celebrate, floatXp } from "./fx";

const synth: SpeechSynthesis | null = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

/** English voices, best first: natural/neural voices, then Microsoft/Google, then the rest. */
function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!synth) return;
    const load = () => {
      const en = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
      const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 0 : /microsoft|google/i.test(v.name) ? 1 : 2) + (/en[-_]us/i.test(v.lang) ? 0 : 0.5);
      setVoices(en.sort((a, b) => score(a) - score(b)));
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

export async function markWatched(id: string) {
  const prev = await db.watched.get(id);
  await db.watched.put({ id, at: Date.now(), count: (prev?.count ?? 0) + 1 });
  await markActivity();
  return !prev;
}

export function ExplainerPlayer({ ex, endActions, compact }: { ex: Explainer; endActions?: ReactNode; compact?: boolean }) {
  const tl = useMemo(() => buildTimeline(ex), [ex]);
  const voices = useVoices();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(() => Number(store.get("explainer-speed")) || 1);
  const [voiceOn, setVoiceOn] = useState(() => store.get("explainer-voice-on") !== "0");
  const [cc, setCc] = useState(() => store.get("explainer-cc") !== "0");
  const [voiceName, setVoiceName] = useState(() => store.get("explainer-voice") ?? "");
  const [spoken, setSpoken] = useState<{ scene: number; idx: number } | null>(null);
  const [firstTime, setFirstTime] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const speech = useRef({ gen: 0, scene: -1, active: false, holdFrom: 0 });
  const canSpeak = !!synth && voices.length > 0;
  const speaking = voiceOn && canSpeak;
  const voice = voices.find((v) => v.name === voiceName) ?? voices[0];

  const stopSpeech = useCallback(() => { speech.current.gen++; speech.current.active = false; speech.current.scene = -1; synth?.cancel(); setSpoken(null); }, []);

  const speakScene = useCallback((index: number) => {
    if (!synth || !speaking) return;
    stopSpeech();
    const gen = speech.current.gen, sc = tl.scenes[index];
    const parts = sentencesOf(sc.say);
    speech.current.scene = index; speech.current.active = true; speech.current.holdFrom = 0;
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = speed; u.pitch = 1;
      u.onstart = () => { if (gen === speech.current.gen) setSpoken({ scene: index, idx: i }); };
      if (i === parts.length - 1) u.onend = u.onerror = () => { if (gen === speech.current.gen) speech.current.active = false; };
      synth.speak(u);
    });
  }, [speaking, voice, speed, tl, stopSpeech]);

  // playback clock
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed; last = now;
      const cur = tRef.current, sc = sceneAt(tl, cur);
      let nt = cur + dt;
      // wait for the narrator to finish the scene (max 8 s) before moving on
      const s = speech.current;
      if (speaking && s.active && s.scene === sc.index && nt >= sc.end - 0.05) {
        if (!s.holdFrom) s.holdFrom = now;
        if (now - s.holdFrom < 8000) nt = sc.end - 0.05;
      }
      if (nt >= tl.total) {
        tRef.current = tl.total; setT(tl.total); setPlaying(false); setEnded(true); stopSpeech();
        markWatched(ex.id).then((first) => { setFirstTime(first); celebrate(0.9); if (first) floatXp(`+${XP.explainer} XP`); });
        return;
      }
      const nsc = sceneAt(tl, nt);
      if (nsc.index !== sc.index && speaking) speakScene(nsc.index);
      tRef.current = nt; setT(nt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, tl, speaking, speakScene, stopSpeech, ex.id]);

  useEffect(() => () => { synth?.cancel(); }, []);

  const play = () => {
    let cur = tRef.current;
    if (ended || cur >= tl.total) { cur = 0; tRef.current = 0; setT(0); setEnded(false); }
    const sc = sceneAt(tl, cur);
    if (speaking) {
      if (synth?.paused && speech.current.scene === sc.index) synth.resume();
      else if (cur - sc.start < 0.5) speakScene(sc.index);
    }
    setPlaying(true);
  };
  const pause = () => { setPlaying(false); if (synth?.speaking) synth.pause(); };
  const toggle = () => (playing ? pause() : play());
  const seek = (nt: number) => {
    nt = Math.max(0, Math.min(tl.total - 0.01, nt));
    stopSpeech(); tRef.current = nt; setT(nt); setEnded(false);
    const sc = sceneAt(tl, nt);
    if (playing && nt - sc.start < 0.5) speakScene(sc.index);
  };
  const goScene = (i: number) => seek(tl.scenes[i].start);
  const fullscreen = () => { const el = wrapRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); };

  const setPref = <T,>(k: string, v: T, set: (v: T) => void) => { set(v); store.set(k, String(v)); };
  const toggleVoice = () => { const v = !voiceOn; setPref("explainer-voice-on", v ? "1" : "0", () => setVoiceOn(v)); if (!v) { stopSpeech(); } };

  const sc = sceneAt(tl, t);
  const caption = (() => {
    if (spoken && spoken.scene === sc.index && speaking) return sentencesOf(sc.say)[spoken.idx];
    const s = sc.sentences.filter((x) => t >= x.start - 0.05);
    return s.length ? s[s.length - 1].text : "";
  })();

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "SELECT" || (e.target as HTMLElement).tagName === "INPUT" && e.key !== " ") return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "arrowright") seek(t + 5); else if (k === "arrowleft") seek(t - 5);
    else if (k === "f") fullscreen(); else if (k === "c") setPref("explainer-cc", cc ? "0" : "1", () => setCc(!cc)); else if (k === "m") toggleVoice();
  };

  return (
    <div className={`xp-player ${compact ? "compact" : ""}`} ref={wrapRef} tabIndex={0} onKeyDown={onKey} aria-label={`Explainer video: ${ex.title}`}>
      <div className="xp-screen" onClick={toggle}>
        <ExplainerStage ex={ex} tl={tl} t={t} className="xp-stage" />
        {cc && caption && !ended && t > 0 && <div className="xp-cc" aria-live="polite"><span>{caption}</span></div>}
        {!playing && !ended && t === 0 && (
          <div className="xp-start">
            <button type="button" className="xp-bigplay" aria-label="Play explainer" onClick={(e) => { e.stopPropagation(); play(); }}><Icon name="play" size={34} /></button>
            <span>{fmtTime(tl.total)} · {tl.scenes.length - 1} chapters{canSpeak ? " · with narration" : ""}</span>
          </div>
        )}
        {!playing && !ended && t > 0 && <div className="xp-paused"><Icon name="play" size={30} /></div>}
        {ended && (
          <div className="xp-end" onClick={(e) => e.stopPropagation()}>
            <span className="xp-endicon"><Icon name="badge-check" size={34} /></span>
            <h3>Explainer complete</h3>
            <p>{firstTime ? `+${XP.explainer} XP earned.` : "Watched again. Repetition builds recognition."}</p>
            <div className="btns" style={{ justifyContent: "center" }}>
              <button type="button" className="btn ghost" onClick={play}>Replay</button>
              {endActions}
            </div>
          </div>
        )}
      </div>
      <div className="xp-bar">
        <button type="button" className="xp-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <PauseIcon /> : <Icon name="play" size={18} />}</button>
        <span className="xp-time">{fmtTime(t)} / {fmtTime(tl.total)}</span>
        <div className="xp-scrub">
          <input type="range" min={0} max={tl.total} step={0.05} value={t} aria-label="Seek" onChange={(e) => seek(Number(e.target.value))} style={{ ["--p" as string]: `${(t / tl.total) * 100}%` }} />
          {tl.scenes.slice(1).map((s) => <i key={s.index} style={{ left: `${(s.start / tl.total) * 100}%` }} title={s.title} />)}
        </div>
        <button type="button" className={`xp-btn ${speaking ? "on" : ""}`} onClick={toggleVoice} disabled={!canSpeak} title={canSpeak ? "Narration (M)" : "No narration voice available in this browser"} aria-pressed={speaking}><SpeakerIcon off={!speaking} /></button>
        <button type="button" className={`xp-btn txt ${cc ? "on" : ""}`} onClick={() => setPref("explainer-cc", cc ? "0" : "1", () => setCc(!cc))} aria-pressed={cc} title="Captions (C)">CC</button>
        <select className="xp-sel" value={speed} aria-label="Speed" onChange={(e) => { setPref("explainer-speed", Number(e.target.value), setSpeed); stopSpeech(); }}>
          {[0.75, 1, 1.25, 1.5].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
        {!compact && canSpeak && voices.length > 1 && (
          <select className="xp-sel voice" value={voice?.name} aria-label="Narrator voice" onChange={(e) => { setPref("explainer-voice", e.target.value, setVoiceName); stopSpeech(); }}>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/^Microsoft |^Google /, "").replace(/ Online \(Natural\)/, " (natural)").slice(0, 34)}</option>)}
          </select>
        )}
        <button type="button" className="xp-btn" onClick={fullscreen} aria-label="Fullscreen (F)"><FullIcon /></button>
      </div>
      {!compact && (
        <ol className="xp-chapters">
          {tl.scenes.map((s) => (
            <li key={s.index} className={s.index === sc.index ? "on" : t >= s.end ? "done" : ""}>
              <button type="button" onClick={() => goScene(s.index)}><span className="mono">{fmtTime(s.start)}</span>{s.layout === "title" ? "Intro" : s.title}</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const PauseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>;
const FullIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
const SpeakerIcon = ({ off }: { off: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    {off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
  </svg>
);
