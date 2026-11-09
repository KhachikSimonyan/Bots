import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../src/voice-input.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const voice = context.KhnayikVoice;

test("voice expenses parse digits, spoken amounts and useful titles", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(voice.parseExpense("Գրանցիր 4,000 դրամ բենզին"))),
    { title: "բենզին", amount: 4000, transcript: "գրանցիր 4 000 դրամ բենզին" },
  );
  assert.equal(voice.parseExpense("Ավելացրու չորս հազար դրամ սուրճ").amount, 4000);
  assert.equal(voice.parseExpense("Գրանցիր 4 հազար 500 դրամ բենզին").amount, 4500);
  assert.equal(voice.parseExpense("Ավելացրու 2500 դրամով սնունդ").title, "սնունդ");
  assert.equal(voice.parseExpense("Գրանցիր բենզին").error, "amount");
});

test("voice tasks understand relative dates and times", () => {
  const now = new Date(2026, 10, 9, 12, 0, 0);
  const task = voice.parseTask("Ավելացրու գործ՝ վաղը ժամը 15:30 զանգել բժշկին", now);
  assert.equal(task.title, "զանգել բժշկին");
  assert.equal(task.date, "2026-11-10");
  assert.equal(task.time, "15:30");
  assert.equal(voice.parseTask("Հիշեցրու այսօր գնել հաց", now).time, "09:00");
  assert.equal(voice.parseTask("Հիշեցրու վաղը ժամը երեքին գնել դեղ", now).time, "03:00");
});
