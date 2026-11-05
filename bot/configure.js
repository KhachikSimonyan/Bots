// Configure Telegram from its existing server-side secrets without exporting credentials.
export async function configureTelegram(env) {
  if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.WEBHOOK_URL) return;
  const desired = JSON.stringify([env.APP_URL, env.WEBHOOK_URL]);
  const saved = await env.DB.prepare("SELECT value FROM bot_configuration WHERE name='telegram'").first();
  if (saved?.value === desired) return;
  async function call(method, body = {}) {
    const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error("Telegram configuration failed at " + method);
    return result.result;
  }
  const identity = await call("getMe");
  if (identity.username?.toLowerCase() !== "khnayikbot") throw new Error("Unexpected Telegram bot identity");
  await call("setWebhook", {
    url: env.WEBHOOK_URL,
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  await call("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Բացել Խնայիկը", web_app: { url: env.APP_URL } },
  });
  const webhook = await call("getWebhookInfo");
  const menu = await call("getChatMenuButton");
  if (webhook.url !== env.WEBHOOK_URL || menu.web_app?.url !== env.APP_URL) {
    throw new Error("Telegram configuration verification failed");
  }
  await env.DB.prepare("INSERT INTO bot_configuration(name,value) VALUES('telegram',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value")
    .bind(desired).run();
  await env.DB.prepare("INSERT INTO bot_configuration(name,value) VALUES('verified_at',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value")
    .bind(new Date().toISOString()).run();
}
