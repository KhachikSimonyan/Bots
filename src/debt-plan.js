/* Deterministic debt planning shared by the UI and tests. Monetary values are whole AMD. */
globalThis.KhnayikDebt = (() => {
  const MONTH_LIMIT = 600;

  const active = (debts) => (Array.isArray(debts) ? debts : [])
    .filter((debt) => Number(debt.balance) > 0)
    .map((debt) => ({
      ...debt,
      balance: Math.max(0, Math.round(Number(debt.balance) || 0)),
      annualRate: Math.max(0, Number(debt.annualRate) || 0),
      minimumPayment: Math.max(0, Math.round(Number(debt.minimumPayment) || 0)),
      lateFee: Math.max(0, Math.round(Number(debt.lateFee) || 0)),
    }));

  function priorityOrder(debts, strategy, extra = 0) {
    return [...debts].sort((a, b) => {
      if (Boolean(a.pastDue) !== Boolean(b.pastDue)) return a.pastDue ? -1 : 1;
      if (a.pastDue && b.pastDue && a.lateFee !== b.lateFee) return b.lateFee - a.lateFee;
      if (strategy === "snowball") return a.balance - b.balance || b.annualRate - a.annualRate;
      if (strategy === "smart") {
        const aClose = a.balance <= a.minimumPayment + extra;
        const bClose = b.balance <= b.minimumPayment + extra;
        if (aClose !== bClose) return aClose ? -1 : 1;
      }
      return b.annualRate - a.annualRate || a.balance - b.balance;
    });
  }

  function allocate(debts, available, strategy = "smart") {
    const items = active(debts);
    const capacity = Math.max(0, Math.round(Number(available) || 0));
    const minimumTotal = items.reduce((sum, debt) => sum + Math.min(debt.balance, debt.minimumPayment), 0);
    const shortfall = Math.max(0, minimumTotal - capacity);
    const payments = new Map(items.map((debt) => [debt.id, 0]));
    if (shortfall) {
      let remaining = capacity;
      for (const debt of priorityOrder(items, strategy)) {
        const payment = Math.min(remaining, debt.balance, debt.minimumPayment);
        payments.set(debt.id, payment);
        remaining -= payment;
        if (!remaining) break;
      }
      return {
        capacity,
        minimumTotal,
        shortfall,
        unused: remaining,
        targetId: priorityOrder(items, strategy)[0]?.id || "",
        payments: items.map((debt) => ({ debt, amount: payments.get(debt.id) })),
      };
    }
    for (const debt of items) payments.set(debt.id, Math.min(debt.balance, debt.minimumPayment));
    let extra = Math.max(0, capacity - minimumTotal);
    for (const debt of priorityOrder(items, strategy, extra)) {
      if (!extra) break;
      const room = Math.max(0, debt.balance - payments.get(debt.id));
      const addition = Math.min(room, extra);
      payments.set(debt.id, payments.get(debt.id) + addition);
      extra -= addition;
    }
    return {
      capacity,
      minimumTotal,
      shortfall,
      unused: extra,
      targetId: priorityOrder(items, strategy, Math.max(0, capacity - minimumTotal))[0]?.id || "",
      payments: items.map((debt) => ({ debt, amount: payments.get(debt.id) })),
    };
  }

  function simulate(debts, monthlyCapacity, strategy = "smart", startDate = new Date()) {
    const capacity = Math.max(0, Math.round(Number(monthlyCapacity) || 0));
    let items = active(debts).map((debt) => ({ ...debt }));
    let interest = 0;
    let months = 0;
    const payoffDates = {};
    if (!items.length) return { possible: true, months: 0, interest: 0, debtFreeDate: startDate, payoffDates };
    if (!capacity || items.reduce((sum, debt) => sum + Math.min(debt.balance, debt.minimumPayment), 0) > capacity) {
      return { possible: false, months: null, interest: null, debtFreeDate: null, payoffDates };
    }
    while (items.length && months < MONTH_LIMIT) {
      months += 1;
      for (const debt of items) {
        const charge = Math.round(debt.balance * debt.annualRate / 1200);
        debt.balance += charge;
        interest += charge;
      }
      const plan = allocate(items, capacity, strategy);
      if (plan.shortfall) return { possible: false, months: null, interest: null, debtFreeDate: null, payoffDates: {} };
      for (const payment of plan.payments) {
        const debt = items.find((item) => item.id === payment.debt.id);
        debt.balance = Math.max(0, debt.balance - payment.amount);
        if (debt.balance === 0 && !payoffDates[debt.id]) {
          payoffDates[debt.id] = new Date(startDate.getFullYear(), startDate.getMonth() + months, 1, 12).toISOString();
        }
      }
      items = items.filter((debt) => debt.balance > 0);
    }
    if (items.length) return { possible: false, months: null, interest: null, debtFreeDate: null, payoffDates: {} };
    const debtFreeDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, 1, 12);
    return { possible: true, months, interest, debtFreeDate, payoffDates };
  }

  function analyze({ debts, available, recurringAvailable, strategy = "smart", startDate = new Date() }) {
    const items = active(debts);
    const totalBalance = items.reduce((sum, debt) => sum + debt.balance, 0);
    const current = allocate(items, available, strategy);
    const selected = simulate(items, recurringAvailable, strategy, startDate);
    const avalanche = simulate(items, recurringAvailable, "avalanche", startDate);
    const snowball = simulate(items, recurringAvailable, "snowball", startDate);
    const target = items.find((debt) => debt.id === current.targetId);
    return { items, totalBalance, current, selected, avalanche, snowball, target };
  }

  return Object.freeze({ allocate, simulate, analyze, priorityOrder });
})();
