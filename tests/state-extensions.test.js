import assert from "node:assert/strict";
import test from "node:test";
import { emptyState, validState } from "../bot/state-store.js";

test("cloud state accepts incomes, goals and category budgets", () => {
  const state = emptyState();
  state.incomes.push({
    id: "income-1", title: "Ֆրիլանս", amount: 50000, kind: "one-time", date: "2026-11-08",
    day: null, startMonth: "2026-11", source: "manual", createdAt: "2026-11-08T12:00:00Z",
  });
  state.savingsGoals.push({
    id: "goal-1", title: "Պահուստ", target: 600000, saved: 100000, monthlyContribution: 50000,
    dueDate: "2027-11-08", startMonth: "2026-11", createdAt: "2026-11-08T12:00:00Z",
  });
  state.categoryBudgets = { "Սնունդ": 80000, "Տրանսպորտ": 30000 };
  assert.equal(validState(state), true);
  state.savingsGoals[0].saved = 700000;
  assert.equal(validState(state), false);
});
