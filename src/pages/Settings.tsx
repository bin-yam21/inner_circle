import { useState } from "react";
import { db, saveSetting, TABLES, type AppSettings } from "../lib/db";
import { downloadText, exportAll, importAll } from "../lib/backup";
import { TUTOR_MODEL } from "../lib/constants";
import { ConfirmButton, PageHead, toast, useSettings } from "../components/ui";

export default function Settings() {
  const s = useSettings();
  const [key, setKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [msg, setMsg] = useState("");
  const num = (k: keyof AppSettings, label: string, step = "any") => (
    <label className="field"><span>{label}</span><input type="number" step={step} value={Number(s[k])} onChange={(e) => saveSetting(k, Number(e.target.value) as never)} /></label>
  );
  async function doExport() {
    const json = await exportAll();
    downloadText(`trading-academy-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
    toast("Backup downloaded");
  }
  async function doImport(file: File) {
    try { const n = await importAll(await file.text(), mode); setMsg(`Restored ${n} records.`); toast("Backup restored"); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't read that file."); }
  }
  async function wipe() { for (const t of TABLES) await db.table(t).clear(); toast("All data erased"); }

  return (
    <div className="stack">
      <PageHead eyebrow="More" title="Settings" lede="Account and risk defaults, appearance, the AI tutor key, and backups. All data stays in this browser on this computer." />
      <section className="card stack">
        <h3 style={{ margin: 0 }}>Account &amp; risk (ICT Money Management)</h3>
        <div className="form">
          {num("accountSize", "Account balance ($)")}
          {num("allocationPct", "Allocation to trading (%)", "1")}
          {num("riskPct", "Risk per trade (% of allocation)", "0.1")}
          {num("pipValue", "Pip value per 1.00 lot ($)")}
          {num("dailyLossLimitR", "Daily loss limit (R)", "0.5")}
          {num("weeklyTargetPips", "Weekly target (pips)", "1")}
        </div>
        <p className="keynote">ICT: allocate only 30% of equity, risk ≤1% of that per trade, and halve risk after each loss.</p>
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>Appearance &amp; files</h3>
        <div className="form two">
          <label className="field"><span>Theme</span><select value={s.theme} onChange={(e) => saveSetting("theme", e.target.value as AppSettings["theme"])}><option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="field"><span>Course video folder (shown on lessons)</span><input value={s.videoFolder} onChange={(e) => saveSetting("videoFolder", e.target.value)} /></label>
        </div>
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>AI tutor</h3>
        <p className="small">Uses Claude ({TUTOR_MODEL}) with your own Anthropic API key. The key is stored only in this browser's local database and sent only to api.anthropic.com. Usage is billed to your Anthropic account.</p>
        <div className="form" style={{ gridTemplateColumns: "minmax(0,3fr) auto auto" }}>
          <label className="field"><span>API key {s.apiKey ? "(saved)" : ""}</span><input type="password" autoComplete="off" value={key ?? ""} onChange={(e) => setKey(e.target.value)} placeholder={s.apiKey ? "•••••••• saved. Paste a new key to replace it" : "sk-ant-…"} /></label>
          <div className="field"><span>&nbsp;</span><button type="button" className="btn" disabled={!key} onClick={async () => { await saveSetting("apiKey", key!.trim()); setKey(null); toast("API key saved"); }}>Save key</button></div>
          <div className="field"><span>&nbsp;</span><button type="button" className="btn ghost" disabled={!s.apiKey} onClick={async () => { await saveSetting("apiKey", ""); toast("API key removed"); }}>Remove</button></div>
        </div>
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>Backup &amp; restore</h3>
        <p className="small">Download everything (progress, notes, journal with screenshots, check-ins, rules, library files) as one file. Back up regularly: clearing browser data deletes the local database.</p>
        <div className="row">
          <button type="button" className="btn" onClick={doExport}>Download backup</button>
          <select className="input" style={{ width: "auto" }} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Restore mode"><option value="merge">Restore: merge with current data</option><option value="replace">Restore: replace current data</option></select>
          <label className="btn ghost">Restore from file<input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} /></label>
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>
      <section className="card stack">
        <h3 style={{ margin: 0 }}>Danger zone</h3>
        <p className="small">Erase all of your data on this device. Download a backup first.</p>
        <div><ConfirmButton onConfirm={wipe}>Erase all data</ConfirmButton></div>
      </section>
    </div>
  );
}
