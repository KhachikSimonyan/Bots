import assert from "node:assert/strict";
import test from "node:test";
import { configureTelegram } from "../bot/configure.js";

test("configures only the intended bot, verifies webhook and menu, then skips completed configuration", async t => {
  const values = new Map();
  const calls = [];
  const env = {
    BOT_TOKEN: "fixture", WEBHOOK_SECRET: "fixture-secret",
    WEBHOOK_URL: "https://bot.example/telegram/webhook", APP_URL: "https://app.example/",
    DB: { prepare: () => ({
      first: () => values.has("telegram") ? {value: values.get("telegram")} : null,
      bind: value => ({run: () => values.set(value.startsWith("[") ? "telegram" : "verified_at", value)}),
    })},
  };
  let username = "wrongbot";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const method = url.split("/").at(-1);
    calls.push({method, body:JSON.parse(options.body)});
    const results = {
      getMe: {username}, setWebhook:true, setChatMenuButton:true,
      getWebhookInfo:{url:env.WEBHOOK_URL},
      getChatMenuButton:{web_app:{url:env.APP_URL}},
    };
    return Response.json({ok:true,result:results[method]});
  });
  await assert.rejects(configureTelegram(env), /identity/);
  assert.deepEqual(calls.map(c => c.method), ["getMe"]);
  username = "KhnayikBot";
  await configureTelegram(env);
  const webhook = calls.find(c => c.method === "setWebhook").body;
  assert.equal(webhook.secret_token,env.WEBHOOK_SECRET);
  assert.equal(webhook.drop_pending_updates,false);
  assert.equal(calls.find(c => c.method === "setChatMenuButton").body.menu_button.web_app.url,env.APP_URL);
  const previous = calls.length;
  await configureTelegram(env);
  assert.equal(calls.length,previous);
});
