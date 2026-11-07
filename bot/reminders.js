import "../src/reminder-time.js";

const HOUR = 3600000;
const CATCH_UP = 24 * HOUR;
const LEASE_MS = 3 * 60000;
const LIMIT = 8;
const currentRevision = "EXISTS (SELECT 1 FROM users WHERE tg_user_id=? AND updated_at=?)";

function scheduleSpecs(state, now) {
  if (state.appearance?.reminderChannel === "device") return [];
  const schedules = [];
  for (const [type, tasks] of [["scheduled", state.scheduledTasks], ["recurring", state.recurringTasks]]) {
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task?.id || !task.reminder || typeof task.title !== "string") continue;
      const spec = {
        type, id: task.id, title: task.title, reminder: true, date: task.date,
        time: task.time, days: task.days, done: task.done, doneDates: task.doneDates,
        leadMinutes: task.leadMinutes, reminderAt: task.reminderAt,
        timeZone: task.timeZone || "Asia/Yerevan", createdAt: task.createdAt,
      };
      const occurrence = KhnayikReminderTime.next(spec, type, now - CATCH_UP);
      if (!occurrence) continue;
      schedules.push({ key: type + "-" + task.id, spec: JSON.stringify(spec), at: occurrence.at, occurrence: occurrence.key });
    }
  }
  for (const debt of Array.isArray(state.debts) ? state.debts : []) {
    if (!debt?.id || !debt.reminder || !Number.isInteger(debt.dueDay)
      || Number(debt.balance) <= 0 || typeof debt.title !== "string") continue;
    const spec = {
      type: "debt", id: debt.id, title: `Պարտքի վճարման օր՝ ${debt.title}`,
      reminder: true, dueDay: debt.dueDay, time: "09:00", leadMinutes: 1440,
      timeZone: debt.timeZone || "Asia/Yerevan", createdAt: debt.createdAt,
    };
    const occurrence = KhnayikReminderTime.next(spec, "debt", now - CATCH_UP);
    if (occurrence) schedules.push({ key: "debt-" + debt.id, spec: JSON.stringify(spec), at: occurrence.at, occurrence: occurrence.key });
  }
  for (const item of Array.isArray(state.fixedExpenses) ? state.fixedExpenses : []) {
    if (!item?.id || !item.reminder || !Number.isInteger(item.dueDay) || typeof item.title !== "string") continue;
    const spec = {
      type: "fixed", id: item.id, title: `Ֆիքսված ծախս՝ ${item.title}`,
      reminder: true, dueDay: item.dueDay, time: "09:00", leadMinutes: 2880,
      timeZone: item.timeZone || "Asia/Yerevan", createdAt: item.createdAt,
    };
    const occurrence = KhnayikReminderTime.next(spec, "fixed", now - CATCH_UP);
    if (occurrence) schedules.push({ key: "fixed-" + item.id, spec: JSON.stringify(spec), at: occurrence.at, occurrence: occurrence.key });
  }
  return schedules;
}

// The caller includes these in its atomic compare-and-set batch. Losing the
// revision comparison must leave both the document and its schedules intact.
export function reminderWriteStatements(env, userId, state, revision, now = Date.now()) {
  const db = env.DB;
  const rows = scheduleSpecs(state, now);
  const statements = [];
  let chunk = [], bytes = 0;
  function flush() {
    if (!chunk.length) return;
    statements.push(db.prepare(`
      INSERT INTO reminder_schedule(user_id,task_key,revision,spec,next_at,occurrence,available_at)
      SELECT ?, j.value->>'$.key', ?, j.value->>'$.spec', j.value->>'$.at',
             j.value->>'$.occurrence', j.value->>'$.at'
      FROM json_each(?) j WHERE ${currentRevision}
      ON CONFLICT(user_id,task_key) DO UPDATE SET
        revision=excluded.revision, spec=excluded.spec,
        next_at=CASE WHEN reminder_schedule.spec=excluded.spec THEN reminder_schedule.next_at ELSE excluded.next_at END,
        occurrence=CASE WHEN reminder_schedule.spec=excluded.spec THEN reminder_schedule.occurrence ELSE excluded.occurrence END,
        available_at=CASE WHEN reminder_schedule.spec=excluded.spec OR reminder_schedule.occurrence=excluded.occurrence THEN reminder_schedule.available_at ELSE excluded.available_at END,
        lease=CASE WHEN reminder_schedule.spec=excluded.spec OR reminder_schedule.occurrence=excluded.occurrence THEN reminder_schedule.lease END`)
      .bind(String(userId), revision, JSON.stringify(chunk), String(userId), revision));
    chunk = [];
    bytes = 0;
  }
  for (const row of rows) {
    const size = new TextEncoder().encode(JSON.stringify(row)).length + 1;
    if (bytes + size > 500000) flush();
    chunk.push(row);
    bytes += size;
  }
  flush();
  statements.push(db.prepare(`DELETE FROM reminder_schedule WHERE user_id=? AND revision<>? AND ${currentRevision}`)
    .bind(String(userId), revision, String(userId), revision));
  statements.push(db.prepare(`INSERT INTO reminder_indexed(user_id, revision) SELECT ?,? WHERE ${currentRevision}
    ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision`).bind(String(userId), revision, String(userId), revision));
  return statements;
}

async function indexLegacy(env, now) {
  const rows = await env.DB.prepare(`SELECT tg_user_id, state_json, updated_at FROM users u
    WHERE chat_id=tg_user_id AND NOT EXISTS (SELECT 1 FROM reminder_indexed i WHERE i.user_id=u.tg_user_id)
    ORDER BY tg_user_id LIMIT 2`).all();
  for (const row of rows.results) {
    let state = {};
    try { state = JSON.parse(row.state_json) || {}; } catch { /* malformed legacy document */ }
    await env.DB.batch(reminderWriteStatements(env, row.tg_user_id, state, row.updated_at, now));
  }
}

function advance(db, row, lease, from) {
  const spec = JSON.parse(row.spec);
  const next = KhnayikReminderTime.next(spec, spec.type, from);
  return db.prepare(`UPDATE reminder_schedule SET next_at=?, occurrence=?, available_at=?, lease=NULL
    WHERE user_id=? AND task_key=? AND lease=? AND occurrence=?`).bind(
    next?.at ?? null, next?.key ?? null, next?.at ?? null, row.user_id, row.task_key, lease, row.occurrence);
}

async function deliver(env, row, lease, now) {
  const db = env.DB;
  const spec = JSON.parse(row.spec);
  // Legacy scheduled receipts used a date in the Worker's UTC timezone.
  const oldKey = spec.type === "scheduled" ? "scheduled-" + spec.id + "-" + new Date(row.next_at).toISOString().slice(0,10) : row.occurrence;
  const fresh = await db.prepare(`SELECT
    EXISTS (SELECT 1 FROM reminder_sent WHERE user_id=s.user_id AND occurrence=s.occurrence)
    OR EXISTS (SELECT 1 FROM reminder_log WHERE tg_user_id=s.user_id AND reminder_key=?) AS sent
    FROM reminder_schedule s JOIN users u ON u.tg_user_id=s.user_id AND u.chat_id=s.user_id
    WHERE s.user_id=? AND s.task_key=? AND s.lease=? AND s.occurrence=?`)
    .bind(oldKey, row.user_id, row.task_key, lease, row.occurrence).first();
  if (!fresh) return;
  const next = advance(db, row, lease, Math.max(row.next_at + 1, now - CATCH_UP));
  if (fresh.sent || row.next_at < now - CATCH_UP) {
    await next.run();
    return;
  }
  let delay = 60000;
  let delivered = false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: row.user_id, text: "Հիշեցում՝ " + spec.title }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    delivered = response.ok && result.ok === true;
    if (result.parameters?.retry_after > 0) delay = Math.max(delay, result.parameters.retry_after * 1000);
    else if (response.status === 403) delay = HOUR;
  } catch { /* Temporary network failure or unreadable response. Keep the occurrence. */ }
  if (delivered) {
    await db.batch([db.prepare("INSERT OR IGNORE INTO reminder_sent(user_id,occurrence) VALUES(?,?)")
      .bind(row.user_id, row.occurrence), next]);
  } else {
    await db.prepare(`UPDATE reminder_schedule SET lease=NULL, available_at=?
      WHERE user_id=? AND task_key=? AND lease=? AND occurrence=?`)
      .bind(now + delay, row.user_id, row.task_key, lease, row.occurrence).run();
  }
}

export async function sendDueReminders(env, now = Date.now()) {
  if (!env.DB || !env.BOT_TOKEN) return;
  await indexLegacy(env, now);
  const lease = crypto.randomUUID();
  const claimed = await env.DB.prepare(`UPDATE reminder_schedule SET lease=?, available_at=?
    WHERE rowid IN (
      SELECT s.rowid FROM reminder_schedule s JOIN users u ON s.user_id=u.tg_user_id
      WHERE u.chat_id=u.tg_user_id AND s.available_at<=? ORDER BY s.available_at,s.rowid LIMIT ?
    ) RETURNING user_id,task_key,spec,next_at,occurrence`).bind(lease, now+LEASE_MS, now, LIMIT).all();
  for (const row of claimed.results) await deliver(env, row, lease, now);
}
