import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { reminderWriteStatements, sendDueReminders } from "../bot/reminders.js";

const ms = value => Date.parse(value);
const tick = ms("2026-11-04T05:00Z");

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const DB = {
    prepare(query) {
      const stmt = sql.prepare(query);
      const bind = (...params) => ({
        run: () => stmt.run(...params),
        all: () => ({ results: stmt.all(...params) }),
        first: () => stmt.get(...params),
      });
      return { ...bind(), bind };
    },
    async batch(stmts) {
      sql.exec("BEGIN");
      try {
        const results = stmts.map(stmt => stmt.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const env = { DB, BOT_TOKEN: "test" };
  return { sql, env, user(id, state, chat = id) {
    sql.prepare("INSERT INTO users(tg_user_id,chat_id,state_json,updated_at) VALUES(?,?,?,'v1')")
      .run(id, chat, JSON.stringify(state));
  }};
}

const task = { id:"same", title:"test", reminder:true, date:"2026-11-04", time:"09:00", timeZone:"Asia/Yerevan" };
const state = { scheduledTasks:[task], recurringTasks:[] };

test("night-before lead, completed date, and DST-aware wall times", () => {
  const recurring = { ...task, time:"00:05", days:[3], leadMinutes:30 };
  const due = KhnayikReminderTime.next(recurring, "recurring", ms("2026-11-03T15:00Z"));
  assert.equal(due.at, ms("2026-11-03T19:35Z"));
  assert.equal(due.key, "recurring-same-2026-11-04");
  assert.equal(KhnayikReminderTime.next({...recurring,doneDates:["2026-11-04"]}, "recurring", due.at).at, due.at + 7*86400000);
  const berlin = {...task, timeZone:"Europe/Berlin", time:"09:15", leadMinutes:15};
  assert.equal(KhnayikReminderTime.next(berlin, "scheduled", tick).at, ms("2026-11-04T08:00Z"));
  assert.equal(KhnayikReminderTime.next({...berlin,date:"2027-07-01"}, "scheduled", tick).at, ms("2027-07-01T07:00Z"));
  assert.equal(KhnayikReminderTime.next({...berlin,date:"2027-03-28",time:"02:30",leadMinutes:0}, "scheduled", tick).at, ms("2027-03-28T01:30Z"));
  assert.equal(KhnayikReminderTime.next({...berlin,date:"2027-10-31",time:"02:30",leadMinutes:0}, "scheduled", tick).at, ms("2027-10-31T00:30Z"));
  const debt = {id:"d",title:"Loan",reminder:true,dueDay:31,time:"09:00",leadMinutes:1440,timeZone:"Asia/Yerevan"};
  const debtDue = KhnayikReminderTime.next(debt,"debt",ms("2027-02-01T00:00Z"));
  assert.equal(debtDue.key,"debt-d-2027-02-28");
  assert.equal(debtDue.at,ms("2027-02-27T05:00Z"));
  assert.equal(KhnayikReminderTime.next({...debt,dueDay:null},"debt",tick),null);
  const fixed = {id:"f",title:"Rent",reminder:true,dueDay:6,time:"09:00",leadMinutes:2880,timeZone:"Asia/Yerevan"};
  const fixedDue = KhnayikReminderTime.next(fixed,"fixed",tick);
  assert.equal(fixedDue.key,"fixed-f-2026-11-06");
  assert.equal(fixedDue.at,tick);
  const nextAfterPaid = KhnayikReminderTime.next({...fixed,paidMonths:["2026-11"]},"fixed",tick);
  assert.equal(nextAfterPaid.key,"fixed-f-2026-12-06");
});

test("delayed and overlapping scans isolate restored accounts, groups and device-only reminders", async t => {
  const { env, sql, user } = fixture();
  user("100",state); user("200",state); user("300",state,"-44"); user("400",{...state,appearance:{reminderChannel:"device"}});
  const sends = [];
  t.mock.method(globalThis,"fetch",async (_url, options) => {
    sends.push(JSON.parse(options.body).chat_id);
    return Response.json({ok:true});
  });
  await Promise.all([sendDueReminders(env,tick+10*60000), sendDueReminders(env,tick+10*60000)]);
  await sendDueReminders(env,tick+11*60000);
  assert.deepEqual(sends.sort(), ["100","200"]);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM reminder_sent").get().n,2);
});

test("active debt due dates are delivered through Telegram while the app is closed", async t => {
  const { env, user } = fixture();
  user("100", { scheduledTasks:[], recurringTasks:[], debts:[{
    id:"debt", title:"Քարտ", balance:50000, reminder:true, dueDay:5,
    timeZone:"Asia/Yerevan", createdAt:"2026-11-01T00:00:00Z",
  }] });
  let body;
  t.mock.method(globalThis,"fetch",async (_url, options) => {
    body = JSON.parse(options.body);
    return Response.json({ok:true});
  });
  await sendDueReminders(env,tick);
  assert.equal(body.chat_id,"100");
  assert.match(body.text,/Պարտքի վճարման օր՝ Քարտ/);
});

test("fixed expenses are delivered two days before their monthly due date", async t => {
  const { env, user } = fixture();
  user("100", { scheduledTasks:[], recurringTasks:[], fixedExpenses:[{
    id:"rent", title:"Վարձ", amount:100000, reminder:true, dueDay:6,
    timeZone:"Asia/Yerevan", createdAt:"2026-11-01T00:00:00Z",
  }] });
  let body;
  t.mock.method(globalThis,"fetch",async (_url, options) => {
    body = JSON.parse(options.body);
    return Response.json({ok:true});
  });
  await sendDueReminders(env,tick);
  assert.equal(body.chat_id,"100");
  assert.match(body.text,/Ֆիքսված ծախս՝ Վարձ/);
});

test("rate limits retain the pending occurrence until Telegram confirms delivery", async t => {
  const { env, sql, user } = fixture();
  user("100",state);
  let calls = 0;
  t.mock.method(globalThis,"fetch",async () => ++calls === 1
    ? Response.json({ok:false,parameters:{retry_after:180}}, {status:429}) : Response.json({ok:true}));
  await sendDueReminders(env,tick);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM reminder_sent").get().n,0);
  await sendDueReminders(env,tick+60000);
  assert.equal(calls,1);
  await sendDueReminders(env,tick+180000);
  assert.equal(calls,2);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM reminder_sent").get().n,1);
});

test("CAS loss, disable, legacy receipt and bounded backlog", async t => {
  const { env, sql, user } = fixture();
  const many = {...state,scheduledTasks:Array.from({length:25},(_,i)=>({...task,id:String(i)}))};
  user("100",many);
  await env.DB.batch(reminderWriteStatements(env,"100",many,"v1",tick));
  await env.DB.batch(reminderWriteStatements(env,"100",{},"lost",tick));
  sql.prepare("INSERT INTO reminder_log VALUES('scheduled-0-2026-11-04','100','2026-11-04')").run();
  let calls=0;
  t.mock.method(globalThis,"fetch",async () => { calls++; return Response.json({ok:true}); });
  await sendDueReminders(env,tick);
  assert.ok(calls>0 && calls<=8);
  for(let i=1;i<5;i++) await sendDueReminders(env,tick+i*60000);
  assert.equal(calls,24);
  sql.prepare("UPDATE users SET updated_at='v2' WHERE tg_user_id='100'").run();
  await env.DB.batch(reminderWriteStatements(env,"100",{...many,appearance:{reminderChannel:"device"}},"v2",tick));
  assert.equal(sql.prepare("SELECT count(*) AS n FROM reminder_schedule").get().n,0);
});
