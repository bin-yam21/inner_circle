import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { courses, lessonKey, lessons, lessonsOf, news } from "../lib/content";
import { db, streakFrom, todayStr } from "../lib/db";
import { fmtR, pct, tiltAdvice, tradeStats } from "../lib/stats";
import { activeZone, fmtMinutes, nextZone, nyNow } from "../lib/time";
import { Bar, Ring, Stat, useSettings } from "../components/ui";
import { NewsCard } from "./News";
import { CandleHero, CountUp, CourseCover, Icon } from "../components/fx";
import { useXp } from "../lib/xp";
import { useNow } from "./Tools";
import { LessonLink } from "./Progress";
import { StudyPlanCard } from "../components/StudyPlanCard";
import { BackupStatus } from "../components/BackupStatus";
import { goLiveGates, isDue, prescriptions } from "../lib/learning";

export default function Dashboard() {
  const settings = useSettings();
  const progress = useLiveQuery(() => db.progress.toArray(), [], []);
  const answers = useLiveQuery(() => db.quizAnswers.toArray(), [], []);
  const activity = useLiveQuery(() => db.activity.toArray(), [], []);
  const trades = useLiveQuery(() => db.trades.toArray(), [], []);
  const checkin = useLiveQuery(() => db.checkins.get(todayStr()), []);
  const logs = useLiveQuery(() => db.dailyLogs.toArray(), [], []);
  const rules = useLiveQuery(() => db.rules.toArray(), [], []);
  const checks = useLiveQuery(() => db.ruleChecks.toArray(), [], []);
  const drills = useLiveQuery(() => db.drills.toArray(), [], []);
  const cardsDue = useLiveQuery(() => db.cards.where("due").belowOrEqual(todayStr()).count(), [], 0);
  const now = useNow(30000);
  const xp = useXp();
  const loc = useLocation();
  useEffect(() => { if (loc.hash === "#achievements") setTimeout(() => document.getElementById("achievements")?.scrollIntoView({ behavior: "smooth" }), 350); }, [loc.hash, xp === undefined]);

  const done = new Set(progress.filter((p) => p.done).map((p) => p.key));
  const total = lessons.length;
  const right = answers.filter((a) => a.correct).length;
  const st = tradeStats(trades);
  const tilt = tiltAdvice(trades, todayStr(), settings.dailyLossLimitR);
  const next = lessons.find((l) => !done.has(lessonKey(l)));
  const ny = nyNow(now);
  const zone = activeZone(ny.minutes), nz = nextZone(ny.minutes);
  const due = answers.filter((a) => isDue(a, todayStr())).length;
  const fix = prescriptions(trades, todayStr())[0];
  const gates = goLiveGates(trades, logs, rules, checks, drills);
  const nextGate = gates.find((g) => !g.met);
  const todayLog = logs.find((l) => l.date === todayStr());

  return (
    <div className="stack">
      <section className="hero">
        <CandleHero />
        <span className="greet-chip"><span className="pulse-dot" />{greeting(new Date(now).getHours() * 60)} · New York {ny.label}</span>
        <h1>{done.size ? "Keep the streak alive." : "Start your trading journey."}</h1>
        <p className="lede">{next ? <>Up next: <b>{next.title}</b>. Small steps every day beat cramming.</> : "Every lesson is complete. Review, journal and stay sharp."}</p>
        <div className="hero-row">
          <Link className="btn" to="/today"><Icon name="sun" size={16} /> Today's steps</Link>
          {next && <Link className="btn ghost" to={`/courses/${next.courseId}/${next.id}`}><Icon name="play" size={16} /> Continue learning</Link>}
          {xp && (
            <div className="xpbox">
              <div className="row"><span>Level {xp.level} · {xp.title}</span><span><CountUp value={xp.xp} /> XP</span></div>
              <Bar value={(xp.xp - xp.levelXp) / (xp.nextLevelXp - xp.levelXp)} />
            </div>
          )}
        </div>
      </section>

      <section className={`card today ${todayLog?.routineDoneAt ? "ready" : ""}`}>
        <div className="spread"><h3 style={{ margin: 0 }}>Today's plan</h3>
          <Link className={todayLog?.routineDoneAt ? "btn ghost sm" : "btn sm"} to="/routine">{todayLog?.routineDoneAt ? "Edit routine" : "Do the pre-session routine"}</Link>
        </div>
        {todayLog?.biasDir || checkin?.intention ? (
          <div className="grid g3 today-grid">
            <div><div className="k">Bias</div><b className={todayLog?.biasDir === "Bullish" ? "pos" : todayLog?.biasDir === "Bearish" ? "neg" : ""}>{todayLog?.biasDir || "not set"}</b>{todayLog?.markets && <span className="muted"> · {todayLog.markets}</span>}{todayLog?.bias && <div className="small">{todayLog.bias}</div>}</div>
            <div><div className="k">Waiting for</div><div className="small">{todayLog?.waitingFor || "—"}</div></div>
            <div><div className="k">Intention · risk</div><div className="small">{checkin?.intention || "—"}</div><div className="small muted">Risk ×{tilt.riskFactor} · {zone ? `${zone.name}: in the killzone now` : `${nz.zone.name} in ${fmtMinutes(nz.inMinutes)}`}</div></div>
          </div>
        ) : <p className="small muted" style={{ margin: 0 }}>No plan yet. Two minutes of routine before the chart: check-in, bias, levels, news, rules.</p>}
        {todayLog?.biasDir && !todayLog.actualDir && ny.minutes >= 17 * 60 && (
          <p className="alert warn small" style={{ margin: 0 }}>Session's over. <Link to="/daily">Record what price actually did</Link> to score today's bias.</p>
        )}
      </section>

      <BackupStatus />
      <StudyPlanCard />

      <div className="grid g4">
        <Ring value={total ? done.size / total : 0} label="All courses" sub={`${done.size} of ${total} lessons`} />
        <Stat icon="target" k="Quiz accuracy" v={answers.length ? <CountUp value={(right / answers.length) * 100} suffix="%" /> : "–"} s={answers.length ? `${right}/${answers.length} correct · ${answers.filter((a) => !a.correct).length} to review` : "No questions answered yet"} />
        <Stat icon="flame" k="Study streak" v={<CountUp value={streakFrom(activity.map((a) => a.date))} />} s="days in a row" />
        <Stat icon="candlestick-chart" k="Journal" v={st.n ? fmtR(st.totalR) : "0"} s={st.n ? `${st.n} trades · ${pct(st.winRate)} wins · ${fmtR(st.expectancy)}/trade` : "No trades logged yet"} />
      </div>

      <div className="grid g3">
        <div className="card">
          <h3>Continue learning</h3>
          {next ? <><p><b>{next.title}</b><br /><span className="muted small">{courses.find((c) => c.id === next.courseId)?.title}</span></p><Link className="btn" to={`/courses/${next.courseId}/${next.id}`}>Open lesson</Link></> : <p>Every lesson is complete. Review missed quiz questions and keep journaling.</p>}
        </div>
        <div className="card">
          <h3>Today's mindset</h3>
          {checkin ? <p className="small">Checked in: mood {checkin.mood}/5, focus {checkin.focus}/5, fear {checkin.fear}/5.<br /><span className="muted">Intention: {checkin.intention || "—"}</span></p> : <p className="small muted">You haven't checked in today. Do it before opening a chart.</p>}
          <div className={`alert ${tilt.level}`} style={{ marginTop: 8 }}><span className="small">{tilt.message}</span></div>
          <div className="btns"><Link className="btn ghost" to="/psychology">{checkin ? "Update check-in" : "Check in now"}</Link></div>
        </div>
        <div className="card">
          <h3>New York time {ny.label}</h3>
          <p className="small">{zone ? <><b>{zone.name}</b> is open now. {zone.note}.</> : <>No killzone right now. Next: <b>{nz.zone.name}</b> in {fmtMinutes(nz.inMinutes)}.</>}</p>
          <div className="btns"><Link className="btn ghost" to="/tools">Session clock &amp; tools</Link></div>
        </div>
      </div>

      <h2 className="section-title">Your coach</h2>
      <div className="grid g3">
        <div className="card">
          <h3>Spaced review</h3>
          <p className="small">{due || cardsDue ? <>Due today: <b>{due}</b> quiz question{due === 1 ? "" : "s"} and <b>{cardsDue}</b> flashcard{cardsDue === 1 ? "" : "s"}. Short daily reviews are how concepts stick.</> : "Nothing due today. Answer new questions or study new flashcards to fill your review queue."}</p>
          <div className="btns"><Link className={due ? "btn" : "btn ghost"} to={due ? "/quiz?due=1" : "/quiz"}>{due ? "Review quiz" : "Take a quiz"}</Link><Link className={cardsDue ? "btn" : "btn ghost"} to="/flashcards">Flashcards</Link></div>
        </div>
        <div className="card">
          <h3>Fix this next</h3>
          {fix ? <p className="small"><b>{fix.mistake}</b> × {fix.count} in 30 days ({fmtR(fix.costR)}). {fix.fix.tip}<br /><span className="muted">Study: <LessonLink id={fix.fix.lessons[0]} /></span></p>
            : <p className="small muted">No repeated mistakes in the last 30 days. Keep tagging mistakes on every trade.</p>}
          <div className="btns"><Link className="btn ghost" to="/progress">My progress</Link></div>
        </div>
        <div className="card">
          <h3>Go-live gates · {gates.filter((g) => g.met).length}/{gates.length}</h3>
          {nextGate ? <><p className="small">Next: <b>{nextGate.label}</b> ({nextGate.value}). {nextGate.detail}</p><Bar value={nextGate.progress} /></> : <p className="small">All gates met. Go live with small size and keep journaling.</p>}
          <div className="btns"><Link className="btn ghost" to="/replay">Practise in replay</Link></div>
        </div>
      </div>

      <h2 className="section-title">Course progress</h2>
      <div className="grid g2">
        {courses.map((c) => {
          const ls = lessonsOf(c.id); const d = ls.filter((l) => done.has(lessonKey(l))).length;
          return (
            <Link key={c.id} to={`/courses/${c.id}`} className="card ccard">
              <CourseCover id={c.id} icon={c.icon ?? "book-open"} />
              <div className="spread"><h3>{c.title}</h3><span className="pill">{d}/{ls.length}</span></div>
              <span className="muted small">{c.subtitle}</span>
              <Bar value={ls.length ? d / ls.length : 0} />
            </Link>
          );
        })}
      </div>

      {xp && <>
        <h2 className="section-title" id="achievements">Achievements <span className="pill">{xp.achievements.filter((a) => a.done).length}/{xp.achievements.length}</span></h2>
        <div className="ach">
          {xp.achievements.map((a) => (
            <div key={a.id} className={`a ${a.done ? "on" : ""}`}>
              <span className="i"><Icon name={a.done ? a.icon : "lock"} size={20} /></span>
              <b>{a.title}</b><span>{a.desc}</span>
              {!a.done && <Bar value={a.progress} />}
            </div>
          ))}
        </div>
      </>}

      <h2 className="section-title">Latest market news</h2>
      <div className="news">{news.slice(0, 3).map((n) => <NewsCard key={n.id} n={n} compact />)}</div>
      <div className="btns"><Link className="btn ghost" to="/news">All news</Link></div>
    </div>
  );
}

function greeting(min: number) { return min < 12 * 60 ? "Good morning" : min < 18 * 60 ? "Good afternoon" : "Good evening"; }
