import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "../lib/db";
import { missingDetails } from "../lib/learning";
import { fmtR, tiltAdvice } from "../lib/stats";
import { activeZone, fmtMinutes, nextZone, nyNow } from "../lib/time";
import { PageHead, useSettings } from "../components/ui";
import { BackupStatus } from "../components/BackupStatus";
import { StudyPlanCard } from "../components/StudyPlanCard";
import { isoWeek } from "./Psychology";
import { useNow } from "./Tools";

/** One page for the whole trading day, in order: before, learn, during, after (and the weekly review at week's end). */
export default function Today() {
  const date = todayStr();
  const settings = useSettings();
  const now = useNow(30000);
  const data = useLiveQuery(async () => {
    const [log, trades, checks, review] = await Promise.all([db.dailyLogs.get(date), db.trades.toArray(), db.preChecks.where("date").equals(date).toArray(), db.reviews.get(isoWeek())]);
    return { log, trades, checks, review };
  }, [date]);
  if (!data) return <p className="muted">Loading…</p>;

  const ny = nyNow(now);
  const zone = activeZone(ny.minutes), nz = nextZone(ny.minutes);
  const tilt = tiltAdvice(data.trades, date, settings.dailyLossLimitR);
  const todays = data.trades.filter((t) => t.date === date);
  const incomplete = todays.filter((t) => missingDetails(t).length);
  const todayR = todays.reduce((a, t) => a + t.r, 0);
  const routineDone = !!data.log?.routineDoneAt;
  const biasScored = !!(data.log?.biasDir && data.log.actualDir);
  const afterClose = ny.minutes >= 17 * 60;
  const weekEnd = ["Fri", "Sat", "Sun"].includes(ny.weekday);
  // Only real completions count: "no bias to score" or "no trades to finish" isn't progress.
  const core = [routineDone, biasScored, ...(todays.length ? [incomplete.length === 0] : [])];
  const doneCount = core.filter(Boolean).length;

  return (
    <div className="stack">
      <PageHead eyebrow="Daily" title="Today" lede={`${ny.weekday} · New York ${ny.label}. Your trading day in order. Most days, this is the only page you need.`} />
      <BackupStatus />

      <Phase n={1} title="Before the session" done={routineDone}>
        {routineDone
          ? <p className="small" style={{ margin: 0 }}>Routine done. Bias: <b>{data.log?.biasDir || "not set"}</b>{data.log?.markets ? ` on ${data.log.markets}` : ""}{data.log?.waitingFor ? <> · waiting for: {data.log.waitingFor}</> : null}</p>
          : <p className="small" style={{ margin: 0 }}>Check in, set the bias, mark your levels, check the news and read your rules: two minutes before any chart.</p>}
        <div className="row"><Link className={routineDone ? "btn ghost sm" : "btn sm"} to="/routine">{routineDone ? "Edit routine" : "Start the pre-session routine"}</Link></div>
      </Phase>

      <StudyPlanCard />

      <Phase n={2} title="During the session" done={null}>
        <div className={`alert ${tilt.level}`} style={{ margin: 0 }}><span className="small">{tilt.message}</span></div>
        <p className="small" style={{ margin: 0 }}>{zone ? <><b>{zone.name}</b> is open now. {zone.note}.</> : <>No killzone now. Next: <b>{nz.zone.name}</b> in {fmtMinutes(nz.inMinutes)}.</>} · Today: {data.checks.length} plan{data.checks.length === 1 ? "" : "s"} checked, {todays.length} trade{todays.length === 1 ? "" : "s"} logged{todays.length ? ` (${fmtR(todayR)})` : ""}.</p>
        <div className="row">
          <Link className="btn sm" to="/pretrade">Check a plan before entry</Link>
          <Link className="btn ghost sm" to="/journal/new">Log a trade</Link>
        </div>
      </Phase>

      <Phase n={3} title="After the close" done={biasScored && incomplete.length === 0 ? true : afterClose ? false : null}>
        <ul className="tasks">
          <li className={biasScored ? "done" : ""}><span className="tick">{biasScored ? "✓" : ""}</span><span>
            {data.log?.biasDir
              ? <><Link to="/daily">Record what price actually did</Link><br /><span className="small muted">{biasScored ? `You called ${data.log.biasDir}; price was ${data.log.actualDir}.` : "Scores today's bias call."}</span></>
              : <><Link to="/daily">Write today's daily log</Link><br /><span className="small muted">No bias was set today, so there's nothing to score.</span></>}
          </span></li>
          <li className={incomplete.length === 0 ? "done" : ""}><span className="tick">{incomplete.length === 0 ? "✓" : ""}</span><span>
            {incomplete.length
              ? <><Link to={`/journal/${incomplete[0].id}`}>Finish {incomplete.length} journal entr{incomplete.length === 1 ? "y" : "ies"}</Link><br /><span className="small muted">{incomplete[0].market}: needs {missingDetails(incomplete[0]).join(", ")}. The coaching features only work with complete entries.</span></>
              : <><span>Journal complete</span><br /><span className="small muted">{todays.length ? "Every trade from today has its details." : "No trades today. Days without a setup are good days too."}</span></>}
          </span></li>
        </ul>
      </Phase>

      {weekEnd && (
        <Phase n={4} title="Weekly review" done={!!data.review?.updatedAt}>
          <p className="small" style={{ margin: 0 }}>{data.review?.updatedAt ? "This week's review is written." : "Fifteen minutes: best and worst decisions, repeated mistakes, one focus for next week. The AI coach can draft it from your data."}</p>
          <div className="row"><Link className="btn ghost sm" to="/psychology?tab=review">{data.review?.updatedAt ? "Open the review" : "Write the weekly review"}</Link><Link className="btn ghost sm" to="/edge">Check your edge</Link></div>
        </Phase>
      )}

      <p className="small muted">Core steps done today: {doneCount}/{core.length}. Everything else (courses, drills, models, stats) is in the menu.</p>
    </div>
  );
}

function Phase({ n, title, done, children }: { n: number; title: string; done: boolean | null; children: ReactNode }) {
  return (
    <section className={`card stack step ${done ? "done" : ""}`}>
      <h3 style={{ margin: 0 }}><span className="stepno">{done ? "✓" : n}</span>{title}</h3>
      {children}
    </section>
  );
}
