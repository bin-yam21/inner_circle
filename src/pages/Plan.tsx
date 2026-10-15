import { useLiveQuery } from "dexie-react-hooks";
import { plans } from "../lib/content";
import { db, markActivity } from "../lib/db";
import { Bar, Empty, PageHead, SavedCheckbox } from "../components/ui";

export default function Plan() {
  const tasks = useLiveQuery(() => db.plan.toArray(), [], []);
  const done = new Set(tasks.filter((t) => t.done).map((t) => t.key));
  async function toggle(key: string, v: boolean) { await db.plan.put({ key, done: v, at: Date.now() }); if (v) await markActivity(); }
  if (!plans.length) return <Empty>No practice plans yet. Add one to content/plans.</Empty>;
  return (
    <div className="stack">
      <PageHead eyebrow="Mind" title="Practice plans" lede="Structured homework, taken from the assignments ICT gives in the lessons. Add more plans as JSON files in content/plans." />
      {plans.map((p) => {
        const all = p.weeks.flatMap((w, wi) => w.tasks.map((_, ti) => `${p.id}:${wi}.${ti}`));
        const d = all.filter((k) => done.has(k)).length;
        return (
          <section key={p.id} className="stack">
            <h2 className="section-title">{p.title} <span className="pill">{d}/{all.length}</span></h2>
            <Bar value={all.length ? d / all.length : 0} />
            {p.weeks.map((w, wi) => {
              const keys = w.tasks.map((_, ti) => `${p.id}:${wi}.${ti}`);
              const wd = keys.filter((k) => done.has(k)).length;
              return (
                <div className="card week" key={wi}>
                  <h3>{w.title}<span className={`pill ${wd === keys.length ? "g" : ""}`}>{wd}/{keys.length}</span></h3>
                  <ul className="check">{w.tasks.map((t, ti) => {
                    const k = keys[ti];
                    return <li key={k}><SavedCheckbox id={k} checked={done.has(k)} onChange={(v) => toggle(k, v)} /><label htmlFor={k}>{t}</label></li>;
                  })}</ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
