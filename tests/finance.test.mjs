import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const scripts = [...html.matchAll(/<script src="(\.\/src\/[^"]+)"/g)].map((match) =>
  readFileSync(new URL(match[1], root), "utf8"));

class Element {
  value = "";
  children = [];
  dataset = {};
  events = {};
  style = { setProperty() {}, removeProperty() {} };
  classList = { add() {}, remove() {}, toggle() {} };
  attributes = {};
  append(...items) { this.children.push(...items); }
  setAttribute(key, value) { this.attributes[key] = value; }
  get content() { return { firstElementChild: { cloneNode: () => new Element() } }; }
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  addEventListener(key, handler) { this.events[key] = handler; }
  reset() { this.resetCount = (this.resetCount || 0) + 1; }
  focus() {}
}

function preview() {
  const elements = new Map();
  const values = new Map();
  const messages = [];
  const noop = () => {};
  const ctx = vm.createContext({
    Blob, TextEncoder, URL, crypto, console, structuredClone,
    setTimeout: noop, setInterval: noop, clearTimeout: noop,
    document: {
      documentElement: new Element(), body: new Element(), querySelectorAll: () => [],
      querySelector: () => new Element(), createElement: () => new Element(), addEventListener: noop,
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
      },
    },
    localStorage: { getItem: (k) => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) },
    window: { setTimeout: noop, clearTimeout: noop, addEventListener: noop, alert: (s) => messages.push(s) },
  });
  for (const script of scripts) vm.runInContext(script, ctx);
  return { elements, messages, run: (s) => vm.runInContext(s, ctx), ctx };
}

test("money fields reject altered amounts; salary can be set back to zero", () => {
  const { run, messages, elements } = preview();
  for (const amount of ["10,50", "-123", "12abc34", "0.4", "1e2", "0"])
    assert.equal(run(`parseAmount(${JSON.stringify(amount)}, "Ծախս")`), null);
  assert.equal(messages.length, 6);
  assert.equal(run('parseAmount("123", "Ծախս")'), 123);
  run("state.salary = 100; els.salaryInput.value = '0'; els.salaryInput.events.change()");
  assert.equal(run("state.salary"), 0);
  assert.equal(elements.get("salaryInput").value, "0");
});

test("monthly budgets preserve prior values, deficits and transient form input", () => {
  const { run } = preview();
  run("state.monthlyBudgets = {'2026-05': {salary:1000, fixedExpenses:[{amount:100}]}}");
  assert.equal(run("getBudgetForMonth('2026-06').salary"), 1000);
  run("state.salary = 100; state.fixedExpenses = [{amount:100}]; updateCurrentMonthBudget(); state.expenses = [{amount:20,createdAt:new Date().toISOString()}]; renderBudget()");
  assert.match(run("els.freeMoney.textContent"), /-20/);
  assert.equal(run("els.dailyLimit.textContent"), "֏0");
  assert.equal(run("els.budgetPercent.textContent"), "Պակասուրդ");
});

test("fixed salary repeats while variable salary requires a monthly confirmation", () => {
  const { run } = preview();
  run("state.salary = 320000; state.salaryMode = 'fixed'; state.salaryDay = 10; state.monthlyBudgets = {}; updateCurrentMonthBudget(true)");
  assert.equal(run("getBudgetForMonth('2999-12').salary"), 320000);
  assert.equal(run("state.monthlyBudgets[getMonthKey(new Date())].salaryDay"), 10);
  run("state.salaryMode = 'variable'; state.monthlyBudgets = {}; state.salary = 320000; ensureCurrentMonthBudget()");
  assert.equal(run("state.salary"), 0);
  assert.equal(run("state.monthlyBudgets[getMonthKey(new Date())].salaryConfirmed"), false);
  assert.equal(run("getBudgetForMonth('2999-12').salary"), 0);
  run("els.salaryInput.value = '175000'; els.salaryForm.events.submit({preventDefault(){}})");
  assert.equal(run("state.monthlyBudgets[getMonthKey(new Date())].salary"), 175000);
  assert.equal(run("state.monthlyBudgets[getMonthKey(new Date())].salaryConfirmed"), true);
});

test("saving an old expense preserves its ID and date when edited", () => {
  const { run } = preview();
  run("els.expenseDate.value='2024-05-01';els.expenseTitle.value='Coffee';els.expenseAmount.value='120';els.expenseForm.events.submit({preventDefault(){}})");
  const id = run("state.expenses[0].id");
  assert.equal(run("getDateKey(new Date(state.expenses[0].createdAt))"), "2024-05-01");
  run(`editExpense(${JSON.stringify(id)});els.expenseAmount.value='140';els.expenseForm.events.submit({preventDefault(){}})`);
  assert.equal(run("state.expenses.length"), 1);
  assert.equal(run("state.expenses[0].amount"), 140);
  assert.equal(run("state.expenses[0].id"), id);
  assert.equal(run("getDateKey(new Date(state.expenses[0].createdAt))"), "2024-05-01");
  run("els.expenseTitle.value='Unsaved';els.expenseAmount.value='130';localStorage.setItem=()=>{throw new Error('QuotaExceededError')}");
  run("els.expenseForm.events.submit({preventDefault(){}})");
  assert.equal(run("els.expenseTitle.value"), "Unsaved");
  assert.equal(run("els.expenseAmount.value"), "130");
  assert.equal(run("state.expenses.length"), 1);
});

test("recurring months count actual days and their saved completion", () => {
  const { run } = preview();
  run("state.recurringTasks = [{id:'r',title:'Wed',time:'09:00',createdAt:'2026-06-30T12:00:00',days:[3],doneDates:['2026-07-01']}]");
  assert.equal(run("getTasksForMonth('2026-06').length"), 0);
  assert.equal(run("getTasksForMonth('2026-07').length"), 5);
  assert.equal(run("getTasksForMonth('2026-07').filter(t=>t.done).length"), 1);
});

test("XLSX contains native date cells and CSV protects text formulas", async () => {
  const { run } = preview();
  run("state.expenses = [{title:'=1+1',amount:20,category:'test',createdAt:'2024-05-01T12:00:00Z'}];downloadBlob=(blob,name)=>{globalThis.captured={blob,name}};exportCsv()");
  assert.match(run("captured.name"), /\.csv$/);
  const csv = await run("captured.blob.text()");
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /2024-05-01T\d\d:\d\d:\d\d[+-]\d\d:\d\d/);
  run("exportExcel()");
  assert.match(run("captured.name"), /\.xlsx$/);
  const zip = Buffer.from(await run("captured.blob.arrayBuffer()"));
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.match(zip.toString("utf8"), /<c s="1"><v>45\d{3}/);
  assert.match(zip.toString("utf8"), /<c t="inlineStr"><is><t xml:space="preserve">=1\+1</);
});
