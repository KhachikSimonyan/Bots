import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../bot/worker.js";
import { emptyState } from "../bot/state-store.js";

function database() {
  const db = new DatabaseSync(":memory:");
  const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  db.exec(schema);
  db.exec(schema);
  return {
    prepare(query) {
      const statement = db.prepare(query);
      const bind = (...parameters) => ({
        first: () => statement.get(...parameters),
        all: () => ({ results: statement.all(...parameters) }),
        run: () => ({ meta: statement.run(...parameters) }),
        execute: () => statement.columns().length
          ? { results: statement.all(...parameters) }
          : { meta: statement.run(...parameters) },
      });
      return { ...bind(), bind };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = statements.map(statement => statement.execute());
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const origin = "https://app.example";
const base = "https://bot.example";
const botToken = "test-token";
function initData(id, ageSeconds = 0) {
  const params = new URLSearchParams({
    auth_date: Math.floor(Date.now() / 1000) - ageSeconds,
    user: JSON.stringify({id, first_name: "Test"}),
  });
  const key = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", key).update(
    [...params].map(([key,value]) => key + "=" + value).join("\n"),
  ).digest("hex"));
  return params.toString();
}

test("auth, account isolation, voice transcription, atomic revision and durable retries", async () => {
  const env = {
    DB: database(), " BOT_TOKEN": botToken, CORS_ORIGIN: origin,
    AI: { run: async (model, input) => {
      if (model === "@cf/openai/whisper-large-v3-turbo") {
        assert.equal(input.language, "hy");
        assert.equal(input.task, "transcribe");
        assert.equal(input.beam_size, 8);
        assert.match(input.initial_prompt, /Հայերեն (ծախսի|մեկանգամյա)/);
        assert.ok(input.audio.length > 0);
        return { text: input.initial_prompt.includes("մեկանգամյա")
          ? "Պլանավորիր հանդիպում Արամի հետ վաղը ժամը չորսին նախագծի մասին խոսելու"
          : "Գրանցիր 4000 դրամ բենզին" };
      }
      assert.equal(model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
      assert.equal(input.response_format.type, "json_schema");
      if (input.messages[0].content.includes("ծախսի ձայնային")) {
        return { response: { correctedText:"Գրանցիր 4000 դրամ բենզին", title:"Բենզին", amount:4000, category:"Տրանսպորտ", hasAmount:true } };
      }
      assert.match(input.messages[0].content, /Այսօր 2026-11-09 է/);
      return { response: { correctedText:"Պլանավորիր հանդիպում Արամի հետ վաղը ժամը չորսին", title:"Հանդիպում Արամի հետ", date:"2026-11-10", time:"16:00", hasDate:true, hasTime:true } };
    } },
  };
  const send = (path, options) => worker.fetch(new Request(base + path, options), env);
  const session = (id, age) => send("/api/session", {
    method:"POST", headers:{Origin:origin,"X-Telegram-Init-Data":initData(id,age)},
  });
  assert.equal((await send("/api/state", {method:"OPTIONS",headers:{Origin:"https://bad.example"}})).status,403);
  assert.equal((await send("/api/state", {method:"OPTIONS",headers:{Origin:origin}})).status,204);
  const preflight = await send("/api/state", {method:"OPTIONS",headers:{Origin:origin}});
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /X-Khnayik-Voice-Kind/);
  assert.equal((await session(123,301)).status,401);
  const {token} = await (await session(123)).json();
  const headers = {Authorization:"Bearer "+token};
  const get = async () => (await send("/api/state",{headers})).json();
  const put = (salary, version, mutationId, appearance = {}) => send("/api/state",{
    method:"PUT",headers,body:JSON.stringify({lastKnownUpdatedAt:version,mutationId,state:{...emptyState(),salary,appearance}}),
  });
  assert.equal((await get()).updatedAt,"0");
  const voice = await send("/api/transcribe", {method:"POST",headers:{...headers,"Content-Type":"audio/webm"},body:new Uint8Array([1,2,3])});
  assert.equal(voice.status,200);
  const expenseVoice = await voice.json();
  assert.equal(expenseVoice.text,"Գրանցիր 4000 դրամ բենզին");
  assert.deepEqual(expenseVoice.expense, {correctedText:"Գրանցիր 4000 դրամ բենզին",title:"Բենզին",amount:4000,category:"Տրանսպորտ",hasAmount:true});
  const taskVoice = await send("/api/transcribe", {method:"POST",headers:{
    ...headers,"Content-Type":"audio/webm","X-Khnayik-Voice-Kind":"task","X-Khnayik-Local-Date":"2026-11-09",
  },body:new Uint8Array([1,2,3])});
  assert.equal(taskVoice.status,200);
  assert.deepEqual((await taskVoice.json()).task,
    {correctedText:"Պլանավորիր հանդիպում Արամի հետ վաղը ժամը չորսին",title:"Հանդիպում Արամի հետ",date:"2026-11-10",time:"16:00",hasDate:true,hasTime:true});
  assert.equal((await send("/api/transcribe", {method:"POST",headers,body:"not audio"})).status,415);
  assert.equal((await put(20,null,"missing")).status,428);
  const attempts = await Promise.all([put(100,"0","one"),put(200,"0","two")]);
  assert.deepEqual(attempts.map(r => r.status).sort(),[200,409]);
  const saved = await get();
  const winner = attempts[0].ok ? "one" : "two";
  assert.equal((await (await put(saved.state.salary,"0",winner)).json()).duplicate,true);
  assert.equal((await send("/api/restore",{method:"POST",headers,body:"{"})).status,400);
  assert.equal((await send("/api/state",{method:"PUT",headers,body:JSON.stringify({state:{...emptyState(),scheduledTasks:[null]}})})).status,422);
  assert.equal((await get()).state.salary,saved.state.salary);
  assert.equal((await put(300,saved.updatedAt,"large",{backgroundImage:"data:image/png;base64,"+"a".repeat(2100000)})).status,200);
  assert.equal((await get()).state.appearance.backgroundImage.length,2100022);
  const other = await (await session(456)).json();
  assert.equal((await (await send("/api/state",{headers:{Authorization:"Bearer "+other.token}})).json()).state.salary,0);
});

test("webhook requires its secret and leaves group addresses unlinked", async () => {
  const env = { DB:database(), BOT_TOKEN:botToken };
  const request = () => new Request(base,{method:"POST",headers:{"X-Telegram-Bot-Api-Secret-Token":"test"},
    body:JSON.stringify({message:{from:{id:123},chat:{type:"supergroup",id:-123},text:"/start"}})});
  assert.equal((await worker.fetch(request(),env)).status,403);
  assert.equal((await worker.fetch(request(),{...env,WEBHOOK_SECRET:"test"})).status,200);
  assert.equal(env.DB.prepare("SELECT COUNT(*) AS n FROM users").first().n,0);
});
