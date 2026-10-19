import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Icon } from "../components/fx";

/**
 * Login / signup screen. Shown only when Supabase is configured and no user is
 * signed in (see App.tsx). Supports email + password and Google OAuth.
 */
export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(null); setNote(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) setNote("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="auth-brand"><span className="logo"><Icon name="candlestick-chart" size={22} /></span>Inner Circle</div>
        <div>
          <h1>Trade the markets with an edge you can prove.</h1>
          <p>Your ICT playbook, journal, replay trainer and AI tutor — all in one place, synced to your account.</p>
          <ul className="auth-points">
            <li><span className="dot"><Icon name="check" size={14} /></span>Structured ICT courses, drills and quizzes</li>
            <li><span className="dot"><Icon name="check" size={14} /></span>Trade journal with stats and an edge finder</li>
            <li><span className="dot"><Icon name="check" size={14} /></span>Replay trainer and a built-in AI tutor</li>
          </ul>
        </div>
        <div style={{ opacity: 0.6, fontSize: 13 }}>Learn · Trade · Mind</div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="sub">{mode === "signin" ? "Sign in to continue to Inner Circle." : "Start learning and journaling in minutes."}</p>

          {error && <div className="auth-error">{error}</div>}
          {note && <div className="auth-note">{note}</div>}

          <button type="button" className="btn ghost auth-google" onClick={google}>
            <GoogleIcon /> Continue with Google
          </button>
          <div className="auth-divider">or</div>

          <form onSubmit={submit}>
            <label className="auth-field"><span>Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="auth-field"><span>Password</span>
              <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </label>
            <button type="submit" className="btn auth-submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNote(null); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="auth-legal">This is trading education, not financial advice.</p>
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 4.1 29.5 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 4.1 29.5 2 24 2 15.9 2 8.9 6.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C8.8 41.3 15.8 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.5l6.5 5.5C41.4 36.3 46 30.8 46 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
