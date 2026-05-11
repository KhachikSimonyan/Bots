const DEFAULT_STATE = {
  salary: 0,
  fixedExpenses: [],
  expenses: [],
  recurringTasks: [],
  scheduledTasks: [],
  monthlyBudgets: {},
  notified: {},
  appearance: {},
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), env);
    }

    if (url.pathname.startsWith("/api/")) {
      return withCors(await handleApi(request, env, url), env);
    }

    if (request.method !== "POST") {
      return new Response("Khnayik bot is running");
    }

    return handleTelegramWebhook(request, env);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDueReminders(env));
  },
};

async function handleApi(request, env, url) {
  if (!env.DB) return json({ error: "D1 database is not configured" }, 500);
  const auth = await authenticateMiniApp(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  await ensureUser(env, auth.user);

  if (url.pathname === "/api/state" && request.method === "GET") {
    const row = await getUserRow(env, auth.user.id);
    return json({
      state: parseState(row?.state_json),
      updatedAt: row?.updated_at || null,
    });
  }

  if (url.pathname === "/api/state" && request.method === "PUT") {
    const body = await readJson(request);
    const row = await getUserRow(env, auth.user.id);
    if (body?.lastKnownUpdatedAt && row?.updated_at && row.updated_at !== body.lastKnownUpdatedAt) {
      return json(
        {
          error: "State changed on another device",
          state: parseState(row.state_json),
          updatedAt: row.updated_at,
        },
        409
      );
    }
    const state = sanitizeState(body?.state);
    await saveState(env, auth.user, state);
    return json({ ok: true, updatedAt: new Date().toISOString() });
  }

  if (url.pathname === "/api/backup" && request.method === "GET") {
    const row = await getUserRow(env, auth.user.id);
    return json({
      exportedAt: new Date().toISOString(),
      userId: String(auth.user.id),
      state: parseState(row?.state_json),
    });
  }

  if (url.pathname === "/api/restore" && request.method === "POST") {
    const body = await readJson(request);
    const state = sanitizeState(body?.state || body);
    await saveState(env, auth.user, state);
    return json({ ok: true, updatedAt: new Date().toISOString() });
  }

  return json({ error: "Not found" }, 404);
}

async function handleTelegramWebhook(request, env) {
  if (env.WEBHOOK_SECRET) {
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== env.WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const update = await readJson(request);
  const message = update.message;
  if (!message?.chat?.id) return new Response("ok");

  if (env.DB && message.from?.id) {
    await env.DB.prepare(
      `INSERT INTO users (tg_user_id, chat_id, first_name, state_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tg_user_id) DO UPDATE SET
         chat_id = excluded.chat_id,
         first_name = excluded.first_name`
    )
      .bind(
        String(message.from.id),
        String(message.chat.id),
        message.from.first_name || "",
        JSON.stringify(DEFAULT_STATE),
        new Date().toISOString()
      )
      .run();
  }

  const text = message.text || "";
  const appUrl = env.APP_URL;
  const token = env.BOT_TOKEN;
  if (!token || !appUrl) return new Response("Bot is not configured", { status: 500 });

  const isStart = text.startsWith("/start");
  const reply = isStart
    ? "Բարի գալուստ «Խնայիկ»։ Այստեղ կարող եք կառավարել բյուջեն, ծախսերը, գործերը և հիշեցումները։"
    : "Բացեք «Խնայիկ» Mini App-ը՝ բյուջեն և գործերը կառավարելու համար։";

  await telegram(env, "sendMessage", {
    chat_id: message.chat.id,
    text: reply,
    reply_markup: {
      inline_keyboard: [[{ text: "Բացել Խնայիկը", web_app: { url: appUrl } }]],
    },
  });

  return new Response("ok");
}

async function authenticateMiniApp(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data") || "";
  if (!initData) return { ok: false, status: 401, error: "Telegram auth is missing" };
  if (!env.BOT_TOKEN) return { ok: false, status: 500, error: "BOT_TOKEN is not configured" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const userJson = params.get("user");
  const authDate = Number(params.get("auth_date") || 0);
  if (!hash || !userJson || !authDate) {
    return { ok: false, status: 401, error: "Telegram auth is incomplete" };
  }

  const maxAgeSeconds = Number(env.AUTH_MAX_AGE_SECONDS || 86400);
  if (Date.now() / 1000 - authDate > maxAgeSeconds) {
    return { ok: false, status: 401, error: "Telegram auth expired" };
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const botKey = await crypto.subtle.sign("HMAC", secretKey, new TextEncoder().encode(env.BOT_TOKEN));
  const authKey = await crypto.subtle.importKey(
    "raw",
    botKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", authKey, new TextEncoder().encode(dataCheckString));
  const expected = bytesToHex(new Uint8Array(signature));

  if (!timingSafeEqual(expected, hash)) {
    return { ok: false, status: 401, error: "Telegram auth is invalid" };
  }

  try {
    const user = JSON.parse(userJson);
    if (!user?.id) return { ok: false, status: 401, error: "Telegram user is missing" };
    return { ok: true, user };
  } catch {
    return { ok: false, status: 401, error: "Telegram user is invalid" };
  }
}

async function sendDueReminders(env) {
  if (!env.DB || !env.BOT_TOKEN) return;
  const now = new Date();
  const rows = await env.DB.prepare("SELECT tg_user_id, chat_id, state_json FROM users WHERE chat_id IS NOT NULL").all();

  for (const row of rows.results || []) {
    const state = parseState(row.state_json);
    const reminders = dueReminders(state, now, env);

    for (const reminder of reminders) {
      const alreadySent = await env.DB.prepare("SELECT reminder_key FROM reminder_log WHERE reminder_key = ?")
        .bind(reminder.key)
        .first();
      if (alreadySent) continue;

      await telegram(env, "sendMessage", {
        chat_id: row.chat_id,
        text: `Հիշեցում՝ ${reminder.title}`,
      });

      await env.DB.prepare("INSERT INTO reminder_log (reminder_key, tg_user_id, sent_at) VALUES (?, ?, ?)")
        .bind(reminder.key, row.tg_user_id, now.toISOString())
        .run();
    }
  }
}

function dueReminders(state, now, env) {
  const local = getLocalParts(now, env);
  const today = local.dateKey;
  const minutesNow = local.hours * 60 + local.minutes;
  const reminders = [];

  state.scheduledTasks.forEach((task) => {
    if (!task.reminder || task.done) return;
    const due = dateFromLocal(task.date, task.time || "09:00", env);
    const reminderAt = task.reminderAt ? new Date(task.reminderAt) : new Date(due.getTime() - Number(task.leadMinutes || 0) * 60000);
    const end = new Date(reminderAt.getTime() + 5 * 60000);
    if (now >= reminderAt && now <= end) {
      reminders.push({ key: `scheduled-${task.id}-${getDateKey(reminderAt)}`, title: task.title });
    }
  });

  state.recurringTasks.forEach((task) => {
    if (!task.reminder) return;
    if (task.reminderAt) {
      const reminderAt = new Date(task.reminderAt);
      const end = new Date(reminderAt.getTime() + 5 * 60000);
      if (now >= reminderAt && now <= end) {
        reminders.push({ key: `recurring-custom-${task.id}`, title: task.title });
      }
      return;
    }

    if (!Array.isArray(task.days) || !task.days.includes(local.day)) return;
    const [hours, minutes] = String(task.time || "09:00").split(":").map(Number);
    const reminderMinute = hours * 60 + minutes - Number(task.leadMinutes || 0);
    if (minutesNow >= reminderMinute && minutesNow <= reminderMinute + 5) {
      reminders.push({ key: `recurring-${task.id}-${today}`, title: task.title });
    }
  });

  return reminders;
}

async function ensureUser(env, user) {
  await env.DB.prepare(
    `INSERT INTO users (tg_user_id, first_name, state_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tg_user_id) DO UPDATE SET
       first_name = excluded.first_name`
  )
    .bind(String(user.id), user.first_name || "", JSON.stringify(DEFAULT_STATE), new Date().toISOString())
    .run();
}

async function getUserRow(env, userId) {
  return env.DB.prepare("SELECT state_json, updated_at FROM users WHERE tg_user_id = ?").bind(String(userId)).first();
}

async function saveState(env, user, state) {
  await env.DB.prepare(
    `INSERT INTO users (tg_user_id, first_name, state_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tg_user_id) DO UPDATE SET
       first_name = excluded.first_name,
       state_json = excluded.state_json,
       updated_at = excluded.updated_at`
  )
    .bind(String(user.id), user.first_name || "", JSON.stringify(state), new Date().toISOString())
    .run();
}

async function telegram(env, method, payload) {
  return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function parseState(value) {
  try {
    return sanitizeState(JSON.parse(value || "{}"));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function sanitizeState(value) {
  const state = { ...DEFAULT_STATE, ...(value || {}) };
  state.salary = Math.max(0, Number(state.salary || 0));
  state.fixedExpenses = Array.isArray(state.fixedExpenses) ? state.fixedExpenses : [];
  state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
  state.recurringTasks = Array.isArray(state.recurringTasks) ? state.recurringTasks : [];
  state.scheduledTasks = Array.isArray(state.scheduledTasks) ? state.scheduledTasks : [];
  state.monthlyBudgets = state.monthlyBudgets && typeof state.monthlyBudgets === "object" ? state.monthlyBudgets : {};
  state.notified = state.notified && typeof state.notified === "object" ? state.notified : {};
  state.appearance = state.appearance && typeof state.appearance === "object" ? state.appearance : {};
  return state;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,X-Telegram-Init-Data");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalParts(date, env) {
  const offset = Number(env.TIMEZONE_OFFSET_MINUTES || 240);
  const shifted = new Date(date.getTime() + offset * 60000);
  return {
    dateKey: getDateKey(shifted),
    day: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

function dateFromLocal(date, time, env) {
  const offset = Number(env.TIMEZONE_OFFSET_MINUTES || 240);
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - offset * 60000);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
