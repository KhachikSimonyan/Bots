import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/finance-tools.js", import.meta.url), "utf8");
const context = vm.createContext({ console });
vm.runInContext(source, context);
const finance = context.KhnayikFinance;

test("bank statements parse expenses and income and infer categories", () => {
  const csv = `Date,Description,Amount\n2026-11-01,Supermarket,-12500\n02.11.2026,Freelance,50000`;
  const rows = finance.parseStatement(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map(({ kind, amount, category }) => ({ kind, amount, category })))), [
    { kind: "expense", amount: 12500, category: "Սնունդ" },
    { kind: "income", amount: 50000, category: "Այլ" },
  ]);
  assert.equal(rows[0].externalKey, "2026-11-01|12500|supermarket");
});

test("monthly income repeats while one-time income stays in its month", () => {
  const incomes = [
    { kind: "monthly", amount: 10000, startMonth: "2026-10" },
    { kind: "one-time", amount: 5000, date: "2026-11-05" },
  ];
  assert.equal(finance.incomeForMonth(incomes, "2026-09"), 0);
  assert.equal(finance.incomeForMonth(incomes, "2026-11"), 15000);
  assert.equal(finance.incomeForMonth(incomes, "2026-12"), 10000);
});

test("insights detect category limits and unusual expenses", () => {
  const expenses = [
    { title: "Մթերք", amount: 9000, category: "Սնունդ", createdAt: "2026-11-02T12:00:00Z" },
    { title: "Սուրճ", amount: 100, category: "Սնունդ", createdAt: "2026-11-03T12:00:00Z" },
    { title: "Ջուր", amount: 100, category: "Սնունդ", createdAt: "2026-11-04T12:00:00Z" },
    { title: "Տաքսի", amount: 1000, category: "Տրանսպորտ", createdAt: "2026-10-03T12:00:00Z" },
  ];
  const messages = finance.insights({ expenses, categoryBudgets: { "Սնունդ": 8000 }, currentMonth: "2026-11", previousMonth: "2026-10" });
  assert.ok(messages.some((message) => message.includes("գերազանցել")));
  assert.ok(messages.some((message) => message.includes("Անսովոր մեծ ծախս")));
});
