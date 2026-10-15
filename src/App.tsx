import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";
import { lessons } from "./lib/content";
import { Bar, useSettings } from "./components/ui";
import { Icon } from "./components/fx";
import { useXp } from "./lib/xp";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CoursePage from "./pages/CoursePage";
import LessonPage from "./pages/LessonPage";
import Reference from "./pages/Reference";
import Explainers from "./pages/Explainers";
import Quiz from "./pages/Quiz";
import Journal from "./pages/Journal";
import TradeEditor from "./pages/TradeEditor";
import Psychology from "./pages/Psychology";
import DailyLog from "./pages/DailyLog";
import Library from "./pages/Library";
import News from "./pages/News";
import Plan from "./pages/Plan";
import Tools from "./pages/Tools";
import Tutor from "./pages/Tutor";
import Glossary from "./pages/Glossary";
import Settings from "./pages/Settings";
import Progress from "./pages/Progress";
import Replay from "./pages/Replay";
import Flashcards from "./pages/Flashcards";
import Routine from "./pages/Routine";
import Playbook from "./pages/Playbook";
import ChartDrills from "./pages/ChartDrills";
import Edge from "./pages/Edge";
import Models from "./pages/Models";

/** Navigation: [path, icon name (see ICONS in components/fx.tsx), label]. To add a page: create it in src/pages, add a route below and an entry here. */
export const NAV: { group: string; items: [string, string, string][] }[] = [
  { group: "Learn", items: [["/", "layout-dashboard", "Dashboard"], ["/courses", "graduation-cap", "Courses"], ["/explainers", "play", "Explainers"], ["/reference", "book-open", "Reference"], ["/models", "layers", "Strategy models"], ["/quiz", "circle-help", "Quizzes"], ["/flashcards", "zap", "Flashcards"], ["/chart-drills", "eye", "Chart drills"], ["/progress", "trending-up", "My progress"], ["/library", "library", "My library"]] },
  { group: "Trade", items: [["/routine", "list-checks", "Pre-session"], ["/journal", "candlestick-chart", "Trade journal"], ["/edge", "target", "Edge finder"], ["/daily", "sun", "Daily log"], ["/replay", "rewind", "Replay trainer"], ["/playbook", "star", "Playbook"], ["/tools", "wrench", "Tools"], ["/news", "newspaper", "News desk"]] },
  { group: "Mind", items: [["/psychology", "brain", "Psychology"], ["/plan", "list-checks", "Practice plan"]] },
  { group: "More", items: [["/tutor", "sparkles", "AI tutor"], ["/glossary", "book-a", "Glossary"], ["/settings", "settings", "Settings"]] },
];

export default function App() {
  const settings = useSettings();
  const doneCount = useLiveQuery(async () => (await db.progress.toArray()).filter((p) => p.done).length, [], 0);
  const total = lessons.length;
  const loc = useLocation();
  const xp = useXp();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
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
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="sep">{g.group}</p>
              {g.items.map(([to, ic, label]) => (
                <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}><span className="ic"><Icon name={ic} /></span>{label}</NavLink>
              ))}
            </div>
          ))}
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
          <Routes>
            <Route path="/" element={<Dashboard />} />
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
            <Route path="*" element={<Dashboard />} />
          </Routes>
          </div>
        </main>
      </div>
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </div>
  );
}
