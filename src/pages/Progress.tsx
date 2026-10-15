import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "../lib/db";
import { explainerById, findLessonAnywhere, quiz } from "../lib/content";
import { biasStats, conceptMastery, goLiveGates, isDue, prescriptions, type MasteryStatus } from "../lib/learning";
import { fmtR, pct } from "../lib/stats";
import { Bar, Empty, PageHead, Stat } from "../components/ui";
import { Icon } from "../components/fx";

const STATUS_PILL: Record<MasteryStatus, string> = { "Not started": "", Studying: "", Understood: "y", Practising: "y", Edge: "g", Leak: "r" };

export function LessonLink({ id }: { id: string }) {
  const l = findLessonAnywhere(id);
  return l ? <Link to={`/courses/${l.courseId}/${l.id}`}>{l.title}</Link> : <span>{id}</span>;
}

export default function Progress() {
  const today = todayStr();
  const data = useLiveQuery(async () => {
    const [progress, answers, trades, logs, rules, checks, drills] = await Promise.all([
      db.progress.toArray(), db.quizAnswers.toArray(), db.trades.toArray(), db.dailyLogs.toArray(), db.rules.toArray(), db.ruleChecks.toArray(), db.drills.toArray(),
    ]);
    return { progress, answers, trades, logs, rules, checks, drills };
  }, []);
  if (!data) return <p className="muted">Loading…</p>;

  const gates = goLiveGates(data.trades, data.logs, data.rules, data.checks, data.drills);
  const met = gates.filter((g) => g.met).length;
  const rx = prescriptions(data.trades, today);
  const mastery = conceptMastery(data.progress, data.answers, quiz, data.trades, data.drills);
  const bias = biasStats(data.logs);
  const due = data.answers.filter((a) => isDue(a, today)).length;
  const leaks = mastery.filter((m) => m.status === "Leak");
  const edges = mastery.filter((m) => m.status === "Edge");

  return (
    <div className="stack">
      <PageHead eyebrow="Learn" title="My progress" lede="Is studying turning into better decisions? This page joins your lessons, quizzes, daily bias calls and trades into one picture, and tells you what to work on next." />

      <div className="grid g4">
        <Stat icon="badge-check" k="Go-live gates" v={`${met} / ${gates.length}`} s={met === gates.length ? "All met. Start live with small size." : "Stay on demo until all are met"} />
        <Stat icon="target" k="Bias hit rate" v={bias.scored ? pct(bias.hitRate) : "–"} s={bias.scored ? `${bias.scored} scored day${bias.scored === 1 ? "" : "s"}` : <Link to="/daily">Score your bias in the Daily log</Link>} />
        <Stat icon="circle-help" k="Reviews due" v={due} s={due ? <Link to="/quiz?due=1">Review now</Link> : "Nothing due today"} />
        <Stat icon="layers" k="Concepts" v={<>{edges.length} <span className="small muted">edge</span> · {leaks.length} <span className="small muted">leak</span></>} s="Edge: 10+ trades, positive expectancy" />
      </div>

      <h2 className="section-title">What to work on</h2>
      {rx.length || leaks.length ? (
        <div className="grid g2">
          {rx.slice(0, 4).map((p) => {
            const ex = p.fix.explainer ? explainerById(p.fix.explainer) : undefined;
            return (
              <div className="card rx" key={p.mistake}>
                <div className="spread"><h3 style={{ margin: 0 }}>{p.mistake}</h3><span className="pill r">{p.count}× · {fmtR(p.costR)}</span></div>
                <p className="small">{p.fix.tip}</p>
                <p className="small muted" style={{ margin: 0 }}>Study: {p.fix.lessons.map((id, i) => <span key={id}>{i ? " · " : ""}<LessonLink id={id} /></span>)}</p>
                {ex && <div className="btns"><Link className="btn ghost sm" to={`/explainers/${ex.id}`}><Icon name="play" size={14} /> Watch: {ex.title}</Link></div>}
              </div>
            );
          })}
          {leaks.map((m) => {
            const next = m.concept.lessons.find((id) => !data.progress.some((p) => p.lessonId === id && p.done)) ?? m.concept.lessons[0];
            return (
              <div className="card rx" key={m.concept.id}>
                <div className="spread"><h3 style={{ margin: 0 }}>Leak: {m.concept.name}</h3><span className="pill r">{m.trades} trades · {fmtR(m.expectancy)}/trade</span></div>
                <p className="small">You lose money trading this concept. Stop taking these setups live, restudy it and practise it in the replay trainer.</p>
                <p className="small muted" style={{ margin: 0 }}>Start with: <LessonLink id={next} /></p>
                <div className="btns"><Link className="btn ghost sm" to="/replay"><Icon name="play" size={14} /> Practise in replay</Link></div>
              </div>
            );
          })}
        </div>
      ) : <Empty>No repeated mistakes in the last 30 days. Tag mistakes on every trade so this can coach you.</Empty>}

      <h2 className="section-title">Go-live gates <span className="pill">{met}/{gates.length}</span></h2>
      <div className="grid g3">
        {gates.map((g) => (
          <div key={g.id} className={`card gate ${g.met ? "met" : ""}`}>
            <div className="spread"><b>{g.label}</b><span className={`pill ${g.met ? "g" : ""}`}>{g.met ? "✓ met" : g.value}</span></div>
            <p className="small muted">{g.detail}</p>
            <Bar value={g.progress} />
          </div>
        ))}
      </div>

      <h2 className="section-title">Concept mastery</h2>
      <p className="small muted" style={{ marginTop: -6 }}>Knowledge = lessons completed + quiz accuracy. Trades count toward a concept through their setup, or the concepts you tag in the journal. Replay = practice drills with a trade (count · expectancy).</p>
      <div className="tw"><table className="wide">
        <thead><tr><th>Concept</th><th>Status</th><th>Knowledge</th><th>Lessons</th><th>Quiz</th><th>Replay</th><th>Trades</th><th>Expectancy</th></tr></thead>
        <tbody>{mastery.map((m) => {
          const next = m.concept.lessons.find((id) => !data.progress.some((p) => p.lessonId === id && p.done));
          return (
            <tr key={m.concept.id}>
              <td><b>{m.concept.name}</b>{next && <><br /><span className="small muted">Next: <LessonLink id={next} /></span></>}</td>
              <td><span className={`pill ${STATUS_PILL[m.status]}`}>{m.status}</span></td>
              <td style={{ minWidth: 110 }}><Bar value={m.knowledge} /><span className="small muted">{Math.round(m.knowledge * 100)}%</span></td>
              <td className="n">{m.lessonsDone}/{m.lessonsTotal}</td>
              <td className="n">{m.quizAccuracy == null ? "–" : `${pct(m.quizAccuracy)} (${m.quizAnswered})`}</td>
              <td className={`n ${m.drills ? (m.drillExpectancy >= 0 ? "pos" : "neg") : ""}`}>{m.drills ? `${m.drills} · ${fmtR(m.drillExpectancy)}` : "–"}</td>
              <td className="n">{m.trades || "–"}</td>
              <td className={`n ${m.trades ? (m.expectancy >= 0 ? "pos" : "neg") : ""}`}>{m.trades ? fmtR(m.expectancy) : "–"}</td>
            </tr>
          );
        })}</tbody>
      </table></div>

      <h2 className="section-title">Bias scorecard</h2>
      {bias.scored ? (
        <div className="grid g2">
          <div className="card"><h3>By market</h3><table><thead><tr><th>Market</th><th>Days</th><th>Right</th></tr></thead>
            <tbody>{bias.byMarket.map((g) => <tr key={g.key}><td>{g.key}</td><td className="n">{g.n}</td><td className="n">{pct(g.hitRate)}</td></tr>)}</tbody></table></div>
          <div className="card"><h3>By weekday</h3><table><thead><tr><th>Day</th><th>Days</th><th>Right</th></tr></thead>
            <tbody>{bias.byWeekday.map((g) => <tr key={g.key}><td>{g.key}</td><td className="n">{g.n}</td><td className="n">{pct(g.hitRate)}</td></tr>)}</tbody></table></div>
        </div>
      ) : <Empty>Each morning pick a bias in the <Link to="/daily">Daily log</Link>; after the close, fill in what price actually did. Your hit rate shows up here.</Empty>}
    </div>
  );
}
