import { getConfig, createBackup, markAutomaticResult, claimAutomaticRun, type BackupGroup } from "./backupService";
import { logger } from "./logger";

const zone = "America/Santo_Domingo";
const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const localDate = (date: Date) => { const p = parts(date); return `${p.year}-${p.month}-${p.day}`; };

async function runIfDue() {
  const now = new Date();
  const p = parts(now);
  if (Number(p.hour) < 2) return;
  const date = localDate(now);
  const config = await getConfig();
  if (config.lastAutomaticDate === date || !(await claimAutomaticRun(date))) return;
  try {
    await createBackup(config.automaticGroups.length ? config.automaticGroups as BackupGroup[] : ["players", "matches", "events", "rules", "tournaments"]);
    await markAutomaticResult(date);
    logger.info({ date }, "Automatic Los Jurones backup completed");
  } catch (err) {
    await markAutomaticResult(date, err);
    logger.error({ err, date }, "Automatic Los Jurones backup failed");
  }
}

export function startBackupScheduler() {
  void runIfDue();
  const tick = async () => {
    try { await runIfDue(); } catch (err) { logger.error({ err }, "Backup scheduler check failed"); }
    setTimeout(tick, 60_000);
  };
  setTimeout(tick, 60_000);
}