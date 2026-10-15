import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";
import { lessons } from "./lib/content";
import { Bar, useSettings } from "./components/ui";
import { Icon } from "./components/fx";
import { useXp } from "./lib/xp";
import { persistStorage, runAutoBackup } from "./lib/autobackup";
import Dashboard from "./pages/Dashboard";
import Today from "./pages/Today";
const Courses = lazy(() => import("./pages/Courses"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const LessonPage = lazy(() => import("./pages/LessonPage"));
const Reference = lazy(() => import("./pages/Reference"));
const Explainers = lazy(() => import("./pages/Explainers"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Journal = lazy(() => import("./pages/Journal"));
const TradeEditor = lazy(() => import("./pages/TradeEditor"));
const Psychology = lazy(() => import("./pages/Psychology"));
const DailyLog = lazy(() => import("./pages/DailyLog"));
const Library = lazy(() => import("./pages/Library"));
const News = lazy(() => import("./pages/News"));
const Plan = lazy(() => import("./pages/Plan"));
const Tools = lazy(() => import("./pages/Tools"));
const Tutor = lazy(() => import("./pages/Tutor"));
const Glossary = lazy(() => import("./pages/Glossary"));
const Settings = lazy(() => import("./pages/Settings"));
const Progress = lazy(() => import("./pages/Progress"));
const Replay = lazy(() => import("./pages/Replay"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const Routine = lazy(() => import("./pages/Routine"));
const Playbook = lazy(() => import("./pages/Playbook"));
const ChartDrills = lazy(() => import("./pages/ChartDrills"));
const Edge = lazy(() => import("./pages/Edge"));
const Models = lazy(() => import("./pages/Models"));
const PreTrade = lazy(() => import("./pages/PreTrade"));

/**
 * Navigation: [path, icon name (see ICONS in components/fx.tsx), label]. To add a page: create it in
 * src/pages, add a route below and an entry here. Groups with `collapsed` fold away under "More".
 */
export const NAV: { group: string; collapsed?: boolean; items: [string, string, string][] }[] = [
  { group: "Daily", items: [["/today", "sun", "Today"], ["/", "layout-dashboard", "Dashboard"], ["/pretrade", "badge-check", "Pre-trade check"], ["/journal", "candlestick-chart", "Trade journal"], ["/daily", "notebook-pen", "Daily log"]] },
  { group: "Learn", items: [["/courses", "graduation-cap", "Courses"], ["/models", "layers", "Strategy models"], ["/chart-drills", "eye", "Chart drills"], ["/flashcards", "zap", "Flashcards"], ["/quiz", "circle-help", "Quizzes"]] },
  { group: "Practise & review", items: [["/replay", "rewind", "Replay trainer"], ["/edge", "target", "Edge finder"], ["/progress", "trending-up", "My progress"], ["/psychology", "brain", "Psychology"]] },
  { group: "More", collapsed: true, items: [["/routine", "list-checks", "Pre-session routine"], ["/explainers", "play", "Explainers"], ["/reference", "book-open", "Reference"], ["/playbook", "star", "Playbook"], ["/tools", "wrench", "Tools"], ["/news", "newspaper", "News desk"], ["/library", "library", "My library"], ["/plan", "list-checks", "Practice plan"], ["/tutor", "sparkles", "AI tutor"], ["/glossary", "book-a", "Glossary"], ["/settings", "settings", "Settings"]] },
];

export default function App() {
  const settings = useSettings();
  const doneCount = useLiveQuery(async () => (await db.progress.toArray()).filter((p) => p.done).length, [], 0);
  const total = lessons.length;
  const loc = useLocation();
  const xp = useXp();
  const [moreOpen, setMoreOpen] = useState(() => { try { return localStorage.getItem("navMore") === "1"; } catch { return false; } });
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  // Ask the browser to keep our data, and back up to the chosen folder on start and then hourly (it writes at most once a day).
  useEffect(() => {
    persistStorage();
    runAutoBackup();
    const t = setInterval(() => runAutoBackup(), 3_600_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const pct = total ? doneCount / total : 0;
  return (
    <div className="app">
      <aside className="side" aria-label="Main navigation">
        <div className="brand"><span className="logo"><Icon name="candlestick-chart" size={20} /></span><span>Trading Academy<small>Learn · Trade · Mind</small></span></div>
        {xp && (
          <NavLink to="/#achievements" className="lvl" title={`${xp.xp} XP`}>
            <span className="badge">{xp.level}</span>
            <span><span className="t">{xp.title}</span><br /><span className="s">{xp.xp - xp.levelXp} / {xp.nextLevelXp - xp.levelXp} XP</span><Bar value={(xp.xp - xp.levelXp) / (xp.nextLevelXp - xp.levelXp)} /></span>
          </NavLink>
        )}
        <div className="prog-mini">{doneCount} / {total} lessons · {Math.round(pct * 100)}%<Bar value={pct} /></div>
        <nav className="nav">
          {NAV.map((g) => {
            const links = g.items.map(([to, ic, label]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}><span className="ic"><Icon name={ic} /></span>{label}</NavLink>
            ));
            if (!g.collapsed) return <div key={g.group}><p className="sep">{g.group}</p>{links}</div>;
            const here = g.items.some(([to]) => loc.pathname === to || loc.pathname.startsWith(to + "/"));
            return (
              <details key={g.group} className="nav-more" open={moreOpen || here} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; if (!here) { setMoreOpen(o); try { localStorage.setItem("navMore", o ? "1" : "0"); } catch { /* storage blocked */ } } }}>
                <summary className="sep">{g.group}</summary>
                {links}
              </details>
            );
          })}
        </nav>
        <div className="foot"><span className="store ok">Saved on this device</span></div>
      </aside>
      <div className="mainp">
        <div className="topnav">
          <div className="tp"><span>Trading Academy</span><span>{doneCount}/{total} lessons</span></div>
          <div className="row" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
            {NAV.flatMap((g) => g.items).map(([to, , label]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>)}
          </div>
        </div>
        <main className="view">
          <div className="page-anim" key={loc.pathname}>
          <Suspense fallback={<p className="muted">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/today" element={<Today />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CoursePage />} />
            <Route path="/courses/:courseId/:lessonId" element={<LessonPage />} />
            <Route path="/explainers" element={<Explainers />} />
            <Route path="/explainers/:explainerId" element={<Explainers />} />
            <Route path="/reference" element={<Reference />} />
            <Route path="/reference/:pageId" element={<Reference />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/new" element={<TradeEditor />} />
            <Route path="/journal/:tradeId" element={<TradeEditor />} />
            <Route path="/psychology" element={<Psychology />} />
            <Route path="/daily" element={<DailyLog />} />
            <Route path="/library" element={<Library />} />
            <Route path="/news" element={<News />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/tutor" element={<Tutor />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/replay" element={<Replay />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/routine" element={<Routine />} />
            <Route path="/playbook" element={<Playbook />} />
            <Route path="/chart-drills" element={<ChartDrills />} />
            <Route path="/edge" element={<Edge />} />
            <Route path="/models" element={<Models />} />
            <Route path="/pretrade" element={<PreTrade />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
          </Suspense>
          </div>
        </main>
      </div>
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </div>
  );
}
