import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { emptyState, validState } from "../bot/state-store.js";

const context = vm.createContext({ console, Date });
vm.runInContext(readFileSync(new URL("../src/debt-plan.js", import.meta.url), "utf8"), context);
const Debt = context.KhnayikDebt;
const debts = [
  { id:"card", title:"Քարտ", balance:300000, annualRate:24, minimumPayment:15000, lateFee:0, pastDue:false },
  { id:"small", title:"Փոքր", balance:30000, annualRate:8, minimumPayment:5000, lateFee:0, pastDue:false },
];

test("debt strategies preserve minimums and direct all extra money", () => {
  const avalanche = Debt.allocate(debts, 70000, "avalanche");
  assert.equal(avalanche.minimumTotal, 20000);
  assert.equal(avalanche.payments.find(p => p.debt.id === "card").amount, 65000);
  assert.equal(avalanche.payments.find(p => p.debt.id === "small").amount, 5000);
  const snowball = Debt.allocate(debts, 70000, "snowball");
  assert.equal(snowball.payments.find(p => p.debt.id === "small").amount, 30000);
  assert.equal(snowball.payments.find(p => p.debt.id === "card").amount, 40000);
});

test("overdue debt wins and an unaffordable minimum plan is reported", () => {
  const urgent = debts.map(d => d.id === "small" ? {...d,pastDue:true,lateFee:10000} : d);
  assert.equal(Debt.allocate(urgent,70000,"avalanche").targetId,"small");
  const short = Debt.allocate(debts,10000,"smart");
  assert.equal(short.shortfall,10000);
  assert.equal(short.payments.reduce((sum,payment) => sum + payment.amount,0),10000);
});

test("avalanche projection costs no more interest than snowball", () => {
  const result = Debt.analyze({debts,available:70000,recurringAvailable:70000,strategy:"smart",startDate:new Date(2026,10,1)});
  assert.equal(result.totalBalance,330000);
  assert.ok(result.selected.possible);
  assert.ok(result.avalanche.interest <= result.snowball.interest);
  assert.ok(result.selected.months > 0);
  assert.deepEqual(Object.keys(result.selected.payoffDates).sort(), ["card","small"]);
  assert.ok(Date.parse(result.snowball.payoffDates.small) <= Date.parse(result.snowball.payoffDates.card));
});

test("cloud state accepts an undated mandatory debt and dated fixed reminder", () => {
  const state = emptyState();
  state.debts.push({
    id:"d", title:"Անժամկետ", type:"personal", balance:80000, originalBalance:80000,
    annualRate:0, minimumPayment:10000, dueDay:null, lateFee:0, paidTotal:0,
    pastDue:false, reminder:false, createdAt:new Date().toISOString(), closedAt:"",
  });
  state.fixedExpenses.push({
    id:"f", title:"Վարձ", amount:50000, dueDay:6, reminder:true,
    paidMonths:["2026-11"], createdAt:new Date().toISOString(),
  });
  assert.equal(validState(state),true);
});
