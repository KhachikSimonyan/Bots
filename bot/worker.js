import { validState, readState, stateWriteStatements, userMeta, MAX_STATE_BYTES } from "./state-store.js";
import { reminderWriteStatements, sendDueReminders } from "./reminders.js";
import { configureTelegram } from "./configure.js";

// The original production binding was created with a leading space.
function botEnvironment(env) {
  return env.BOT_TOKEN || !env[" BOT_TOKEN"] ? env : { ...env, BOT_TOKEN: env[" BOT_TOKEN"] };
}

export default {
  async fetch(request, env) {
    env = botEnvironment(env);
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const origin = request.headers.get("Origin");
      if (origin && origin !== env.CORS_ORIGIN && origin !== url.origin) return json({ error: "Forbidden origin" }, 403);
      let response;
      try {
        response = request.method === "OPTIONS" ? new Response(null, {status: 204}) : await handleApi(request, env, url);
      } catch (error) {
        console.error("Khnayik API request failed", url.pathname, error.name);
        response = json({ error: "Տվյալների ծառայությունը ժամանակավորապես անհասանելի է" }, 503);
      }
      return withCors(response, origin);
    }

    if (url.pathname === "/telegram/webhook") {
      return request.method === "POST"
        ? handleTelegramWebhook(request, env)
        : new Response("Method not allowed", { status: 405 });
    }
    if (request.method !== "POST") {
      return new Response("Khnayik bot is running");
    }

    return handleTelegramWebhook(request, env);
  },

  async scheduled(_event, env, ctx) {
    const configured = botEnvironment(env);
    ctx.waitUntil((async () => {
      try { await configureTelegram(configured); }
      catch (error) { console.error(error.message); }
      await sendDueReminders(configured);
    })());
  },
};

async function handleApi(request, env, url) {
  if (!env.DB) return json({ error: "D1 database is not configured" }, 500);

  const sessionRequest = url.pathname === "/api/session" && request.method === "POST";
  const auth = !sessionRequest && request.headers.has("Authorization")
    ? await authenticateSession(request, env) : await authenticateMiniApp(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const id = String(auth.user.id);

  if (sessionRequest) {
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expires = Date.now() + 12 * 3600000;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM api_sessions WHERE expires_at < ?").bind(Date.now()),
      env.DB.prepare("INSERT INTO api_sessions(token_hash,user_json,expires_at) VALUES (?,?,?)")
        .bind(await tokenHash(token), JSON.stringify(auth.user), expires),
    ]);
    return json({ token, expires, userId: id });
  }
  if (url.pathname === "/api/reminder-access" && request.method === "POST") {
    if (auth.user.allows_write_to_pm === true) await linkPrivateChat(env, auth.user);
    return json(await userMeta(env, id));
  }
  if (url.pathname === "/api/state" && request.method === "GET") {
    if (url.searchParams.has("since")) {
      const meta = await userMeta(env,id);
      if (meta.updatedAt === url.searchParams.get("since")) return json({ ...meta, unchanged: true });
    }
    return json(await readState(env, id));
  }
  if (url.pathname === "/api/backup" && request.method === "GET") {
    return json({ ...(await readState(env,id)), exportedAt: new Date().toISOString(), userId: id });
  }
  if (url.pathname === "/api/transcribe" && request.method === "POST") {
    if (!env.AI) return json({ error: "Ձայնային ծառայությունը կարգավորված չէ" }, 503);
    const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].toLowerCase();
    if (!contentType.startsWith("audio/")) return json({ error: "Ուղարկեք ձայնագրություն" }, 415);
    const audio = await request.arrayBuffer();
    if (!audio.byteLength) return json({ error: "Ձայնագրությունը դատարկ է" }, 400);
    if (audio.byteLength > 2 * 1024 * 1024) return json({ error: "Ձայնագրությունը չափազանց երկար է" }, 413);
    const kind = request.headers.get("X-Khnayik-Voice-Kind") === "task" ? "task" : "expense";
    const stored = await readState(env, id);
    const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
      audio: arrayBufferToBase64(audio),
      task: "transcribe",
      language: "hy",
      vad_filter: true,
      beam_size: 8,
      no_speech_threshold: 0.45,
      initial_prompt: voicePrompt(kind, stored.state),
      condition_on_previous_text: false,
    });
    const text = String(result?.text || "").trim();
    if (!text) return json({ error: "Խոսք չհայտնաբերվեց։ Կրկին փորձեք ավելի բարձր խոսել։" }, 422);
    return json({ text: text.slice(0, 500) });
  }
  const restore = url.pathname === "/api/restore" && request.method === "POST";
  if (restore || (url.pathname === "/api/state" && request.method === "PUT")) {
    let body;
    try {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > MAX_STATE_BYTES) return json({ error: "Գրառումների ծավալը գերազանցում է 16 ՄիԲ-ը" }, 413);
      body = JSON.parse(new TextDecoder().decode(buffer));
    } catch { return json({ error: "Անվավեր JSON" }, 400); }
    const state = body?.state ?? (restore ? body : null);
    if (!validState(state)) return json({ error: "Անվավեր տվյալներ․ պահպանված գրառումները չեն փոխվել" }, 422);
    const expected = body?.lastKnownUpdatedAt ?? request.headers.get("If-Match");
    if (typeof expected !== "string" || !expected) return json({ error: "Նախ բեռնեք տվյալների ընթացիկ տարբերակը" }, 428);
    const mutation = body?.mutationId;
    if (mutation !== undefined && (typeof mutation !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(mutation))) {
      return json({ error: "Անվավեր փոփոխության համար" }, 400);
    }
    if (mutation && await env.DB.prepare("SELECT 1 AS found FROM applied_changes WHERE user_id=? AND mutation_id=?")
      .bind(id,mutation).first()) return json({ duplicate: true, ...(await readState(env,id)) });
    const revision = crypto.randomUUID();
    const writes = stateWriteStatements(env, id, auth.user.first_name || "", state, expected, revision);
    if (mutation) writes.push(env.DB.prepare(`INSERT INTO applied_changes(user_id,mutation_id)
      SELECT ?,? WHERE EXISTS(SELECT 1 FROM users WHERE tg_user_id=? AND updated_at=?)`).bind(id,mutation,id,revision));
    writes.push(...reminderWriteStatements(env, id, state, revision));
    const [saved] = await env.DB.batch(writes);
    if (!saved.meta.changes) return json({ error: "Տվյալները փոփոխվել են այլ սարքից", ...(await readState(env,id)) }, 409);
    return json({ ok: true, updatedAt: revision });
  }

  return json({ error: "Not found" }, 404);
}

function voicePrompt(kind, state) {
  const lists = kind === "task"
    ? [state.scheduledTasks, state.recurringTasks]
    : [state.expenses, state.fixedExpenses, state.debts];
  const vocabulary = [...new Set(lists.flatMap((items) => Array.isArray(items) ? items : [])
    .map((item) => String(item?.title || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40))
    .filter(Boolean))].slice(0, 15);
  const base = kind === "task"
    ? "Հայերեն մեկանգամյա գործի կարճ հրաման։ Ամսաթիվը, ժամը և անունը գրիր ճշգրիտ։ Օրինակ՝ Ավելացրու գործ՝ վաղը ժամը 15:30 զանգել բժշկին։ Այսօր ժամը երեքին գնել դեղ։"
    : "Հայերեն ծախսի կարճ հրաման։ Գումարը գրիր թվանշաններով և պահպանիր ապրանքի անունը։ Օրինակ՝ Գրանցիր 4000 դրամ բենզին։ Ավելացրու 12500 դրամ սուպերմարկետ։";
  return vocabulary.length ? `${base} Հնարավոր ծանոթ բառեր՝ ${vocabulary.join(", ")}։` : base;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

async function handleTelegramWebhook(request, env) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (!env.WEBHOOK_SECRET || !timingSafeEqual(secret, env.WEBHOOK_SECRET)) return new Response("Forbidden", {status: 403});
  let update;
  try { update = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const message = update?.message;
  if (message?.chat?.type !== "private" || !message.from?.id || String(message.from.id) !== String(message.chat.id)) {
    return new Response("ok");
  }
  if (env.DB) await linkPrivateChat(env, message.from);
  if (message.write_access_allowed) return new Response("ok");

  const text = message.text || "";
  const appUrl = env.APP_URL;
  const token = env.BOT_TOKEN;

  if (!token || !appUrl) {
    return new Response("Bot is not configured", { status: 500 });
  }

  const isStart = text.startsWith("/start");
  const reply = isStart
    ? "Բարի գալուստ «Խնայիկ»։ Այստեղ կարող եք կառավարել բյուջեն, ծախսերը, գործերը և հիշեցումները։"
    : "Բացեք «Խնայիկ» Mini App-ը՝ բյուջեն և գործերը կառավարելու համար։";

  const result = await telegram(env, "sendMessage", {
    chat_id: message.chat.id,
    text: reply,
    reply_markup: {
      inline_keyboard: [[{ text: "Բացել Խնայիկը", web_app: { url: appUrl } }]],
    },
  });

  if (!result.ok) return new Response("Telegram unavailable", { status: 502 });
  return new Response("ok");
}

async function linkPrivateChat(env, user) {
  const id = String(user.id);
  await env.DB.prepare(`INSERT INTO users(tg_user_id,chat_id,first_name,state_json,updated_at)
    VALUES (?1,?1,?2,'{}','0') ON CONFLICT(tg_user_id) DO UPDATE SET chat_id=excluded.chat_id,first_name=excluded.first_name`)
    .bind(id,user.first_name || "").run();
}

async function tokenHash(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function authenticateSession(request, env) {
  const match = /^Bearer ([a-f0-9-]{72})$/.exec(request.headers.get("Authorization") || "");
  const record = match && await env.DB.prepare("SELECT user_json FROM api_sessions WHERE token_hash=? AND expires_at>?")
    .bind(await tokenHash(match[1]),Date.now()).first();
  return record ? { ok: true, user: JSON.parse(record.user_json) }
    : { ok: false, status: 401, error: "Նորից բացեք հավելվածը Telegram-ից՝ կապը վերականգնելու համար" };
}

async function authenticateMiniApp(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data") || "";

  if (!initData) {
    return { ok: false, status: 401, error: "Telegram auth is missing" };
  }

  if (!env.BOT_TOKEN) {
    return { ok: false, status: 500, error: "BOT_TOKEN is not configured" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const userJson = params.get("user");
  const authDate = Number(params.get("auth_date") || 0);

  if (!hash || !userJson || !authDate) {
    return { ok: false, status: 401, error: "Telegram auth is incomplete" };
  }

  const maxAgeSeconds = Math.min(Number(env.AUTH_MAX_AGE_SECONDS) || 300, 300);
  if (!Number.isSafeInteger(authDate) || authDate > Date.now() / 1000 + 30 || Date.now() / 1000 - authDate > maxAgeSeconds) {
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
    if (!Number.isSafeInteger(user?.id) || user.id <= 0) {
      return { ok: false, status: 401, error: "Telegram user is missing" };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, status: 401, error: "Telegram user is invalid" };
  }
}

async function telegram(env, method, payload) {
  return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);

  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data, X-Khnayik-Voice-Kind, Authorization, If-Match");
  headers.set("Access-Control-Max-Age", "86400");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
