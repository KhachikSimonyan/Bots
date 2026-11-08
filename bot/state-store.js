export const emptyState = () => ({
  salary: 0, salaryMode: "fixed", salaryDay: 1,
  fixedExpenses: [], expenses: [], recurringTasks: [], scheduledTasks: [],
  debts: [], debtPayments: [], debtSettings: { strategy: "smart", safetyReserve: 0 },
  incomes: [], savingsGoals: [], categoryBudgets: {},
  monthlyBudgets: {}, notified: {}, appearance: {},
});

export const MAX_STATE_BYTES = 16 * 1024 * 1024;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const amount = (value) => Number.isSafeInteger(value) && value >= 0;
const text = (value) => typeof value === "string" && value.trim().length > 0;
const day = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + "T00:00:00Z"))
  && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const timestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const month = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const time = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const fixed = (item) => amount(item.amount)
  && (item.dueDay == null || (Number.isInteger(item.dueDay) && item.dueDay >= 1 && item.dueDay <= 31))
  && (item.reminder == null || typeof item.reminder === "boolean")
  && (item.paidMonths == null || (Array.isArray(item.paidMonths) && item.paidMonths.every(month)))
  && (!item.createdAt || timestamp(item.createdAt));
const task = (item) => time(item.time) && typeof item.reminder === "boolean"
  && (!item.reminderAt || timestamp(item.reminderAt))
  && (item.leadMinutes == null || (Number.isInteger(item.leadMinutes) && item.leadMinutes >= 0 && item.leadMinutes <= 1440))
  && (!item.createdAt || timestamp(item.createdAt));
const debt = (item) => amount(item.balance) && amount(item.originalBalance) && item.originalBalance >= item.balance
  && Number.isFinite(item.annualRate) && item.annualRate >= 0 && item.annualRate <= 1000
  && amount(item.minimumPayment) && amount(item.lateFee) && amount(item.paidTotal)
  && (item.dueDay == null || (Number.isInteger(item.dueDay) && item.dueDay >= 1 && item.dueDay <= 31))
  && ["card", "loan", "personal", "tax", "other"].includes(item.type)
  && typeof item.pastDue === "boolean" && typeof item.reminder === "boolean"
  && (!item.createdAt || timestamp(item.createdAt)) && (!item.closedAt || timestamp(item.closedAt));
const income = (item) => amount(item.amount) && ["one-time", "monthly"].includes(item.kind)
  && (item.kind !== "one-time" || day(item.date))
  && (item.kind !== "monthly" || (Number.isInteger(item.day) && item.day >= 1 && item.day <= 31))
  && (!item.startMonth || month(item.startMonth)) && (!item.createdAt || timestamp(item.createdAt));
const goal = (item) => amount(item.target) && item.target > 0 && amount(item.saved) && item.saved <= item.target
  && amount(item.monthlyContribution) && (!item.dueDate || day(item.dueDate)) && (!item.startMonth || month(item.startMonth))
  && (!item.createdAt || timestamp(item.createdAt));

function list(value, check) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  return value.every((item) => {
    if (!object(item) || !text(item.id) || !text(item.title) || ids.has(item.id) || !check(item)) return false;
    ids.add(item.id);
    return true;
  });
}

export function validState(state) {
  if (!object(state) || !amount(state.salary) || !["fixed", "variable"].includes(state.salaryMode)
    || !Number.isInteger(state.salaryDay) || state.salaryDay < 1 || state.salaryDay > 31
    || !list(state.fixedExpenses, fixed)
    || !list(state.expenses, (item) => fixed(item) && timestamp(item.createdAt) && typeof item.category === "string")
    || !list(state.scheduledTasks, (item) => task(item) && day(item.date) && typeof item.done === "boolean")
    || !list(state.recurringTasks, (item) => task(item) && Array.isArray(item.days) && item.days.length > 0
      && item.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      && Array.isArray(item.doneDates) && item.doneDates.every(day))
    || !list(state.debts, debt)
    || !list(state.debtPayments, (item) => text(item.debtId) && fixed(item) && timestamp(item.createdAt))) return false;
  if ((state.incomes != null && !list(state.incomes, income))
    || (state.savingsGoals != null && !list(state.savingsGoals, goal))
    || (state.categoryBudgets != null && (!object(state.categoryBudgets)
      || !Object.values(state.categoryBudgets).every(amount)))) return false;
  if (!object(state.monthlyBudgets) || !object(state.appearance) || !object(state.notified)
    || !object(state.debtSettings) || !["smart", "avalanche", "snowball"].includes(state.debtSettings.strategy)
    || !amount(state.debtSettings.safetyReserve)) return false;
  if (!Object.entries(state.monthlyBudgets).every(([key, budget]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key)
    && object(budget) && amount(budget.salary) && list(budget.fixedExpenses, fixed)
    && (budget.salaryMode == null || ["fixed", "variable"].includes(budget.salaryMode))
    && (budget.salaryDay == null || (Number.isInteger(budget.salaryDay) && budget.salaryDay >= 1 && budget.salaryDay <= 31))
    && (budget.salaryConfirmed == null || typeof budget.salaryConfirmed === "boolean"))) return false;
  if (!Object.values(state.notified).every((flag) => typeof flag === "boolean")) return false;
  return !state.appearance.backgroundImage || (typeof state.appearance.backgroundImage === "string"
    && /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(state.appearance.backgroundImage));
}

export async function userMeta(env, id) {
  const row = await env.DB.prepare("SELECT updated_at, chat_id FROM users WHERE tg_user_id=?").bind(id).first();
  return { updatedAt: row?.updated_at ?? "0", telegramLinked: row?.chat_id === id };
}

export async function readState(env, id) {
  const [header, chunks] = await env.DB.batch([
    env.DB.prepare("SELECT state_json, updated_at, chat_id FROM users WHERE tg_user_id=?").bind(id),
    env.DB.prepare("SELECT part FROM user_state_parts WHERE user_id=? ORDER BY position").bind(id),
  ]);
  const row = header.results[0];
  if (!row) return { state: emptyState(), updatedAt: "0", telegramLinked: false };
  const stored = JSON.parse(row.state_json);
  const value = stored.storage === "chunks-v1" ? JSON.parse(chunks.results.map((record) => record.part).join("")) : stored;
  // Earlier databases used {} for a newly registered account. Preserve legacy values until its first successful save.
  return { state: { ...emptyState(), ...value }, updatedAt: row.updated_at, telegramLinked: row.chat_id === id };
}

export function stateWriteStatements(env, id, firstName, state, expected, revision) {
  const serialized = JSON.stringify(state);
  const parts = [];
  if (serialized.length > 220000) {
    // Four UTF-8 bytes per UTF-16 code unit is a safe upper bound below D1's per-row limit.
    for (let start = 0; start < serialized.length;) {
      let end = Math.min(start + 220000, serialized.length);
      if (end < serialized.length && /[\uD800-\uDBFF]/.test(serialized[end - 1])) end--;
      parts.push(serialized.slice(start, end));
      start = end;
    }
  }
  const header = parts.length ? '{"storage":"chunks-v1"}' : serialized;
  // Both a first save and a pre-existing user's save compete on a single SQL revision predicate.
  const write = env.DB.prepare(`INSERT INTO users (tg_user_id,first_name,state_json,updated_at)
    SELECT ?1,?2,?3,?4 WHERE ?5='0' OR EXISTS (SELECT 1 FROM users WHERE tg_user_id=?1)
    ON CONFLICT(tg_user_id) DO UPDATE SET first_name=excluded.first_name,
    state_json=excluded.state_json,updated_at=excluded.updated_at WHERE users.updated_at=?5`)
    .bind(id, firstName, header, revision, expected);
  const guard = "EXISTS (SELECT 1 FROM users WHERE tg_user_id=? AND updated_at=?)";
  return [write, env.DB.prepare("DELETE FROM user_state_parts WHERE user_id=? AND " + guard).bind(id,id,revision),
    ...parts.map((part, position) => env.DB.prepare("INSERT INTO user_state_parts(user_id,position,part) SELECT ?,?,? WHERE " + guard)
      .bind(id,position,part,id,revision))];
}
