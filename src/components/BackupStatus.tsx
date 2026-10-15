import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { getFolder, isStale, recordBackup, resume } from "../lib/autobackup";
import { downloadText, exportAll } from "../lib/backup";
import { toast } from "./ui";

/** Shows nothing while backups are healthy; otherwise a warning with a one-click fix. */
export function BackupStatus() {
  const last = useLiveQuery(async () => (await db.settings.get("lastBackupAt"))?.value as number | undefined, []);
  const hasData = useLiveQuery(async () => (await db.trades.count()) + (await db.progress.count()) + (await db.dailyLogs.count()) > 0, [], false);
  const folder = useLiveQuery(() => db.handles.get("backupDir"), []);
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const dir = await getFolder();
      if (dir && !off) setNeedsPermission((await dir.queryPermission({ mode: "readwrite" })) !== "granted");
    })().catch(() => {});
    return () => { off = true; };
  }, [folder]);

  if (needsPermission) return (
    <div className="alert warn small backup-alert">
      <span>Automatic backups are paused: the browser needs your OK to write to the backup folder again (it asks after a restart).</span>
      <button type="button" className="btn sm" onClick={async () => { const r = await resume(); if (r === "done" || r === "not-due") { setNeedsPermission(false); toast("Backups resumed"); } }}>Resume backups</button>
    </div>
  );
  if (!hasData || !isStale(last, Date.now())) return null;
  const days = last ? Math.floor((Date.now() - last) / 86_400_000) : null;
  return (
    <div className="alert warn small backup-alert">
      <span><b>{days == null ? "You've never backed up." : `Last backup ${days} days ago.`}</b> Everything lives in this browser only; clearing browser data would erase it.</span>
      <span className="row">
        <button type="button" className="btn sm" onClick={async () => { downloadText(`trading-academy-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll()); await recordBackup("download"); toast("Backup downloaded"); }}>Back up now</button>
        {!folder && <Link className="btn ghost sm" to="/settings#backups">Set up automatic backups</Link>}
      </span>
    </div>
  );
}
