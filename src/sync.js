/* Changes are durable before a form acknowledges a save. Only touched fields are replayed on a newer revision. */
globalThis.KhnayikSync = (() => {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const safeKey = (k) => !["__proto__", "constructor", "prototype"].includes(k);
  const keyedLists = new Set(["expenses", "fixedExpenses", "scheduledTasks", "recurringTasks", "debts", "debtPayments", "incomes", "savingsGoals"]);

  function diff(before, after, key = "") {
    if (before === after) return null;
    if (after === undefined) return { type: "delete" };
    if (before === undefined) return { type: "set", value: after };
    if (Array.isArray(before) && Array.isArray(after)) {
      if (keyedLists.has(key)) {
        const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));
        const edits = diff(byId(before), byId(after));
        return edits && { type: "items", edits, addedOrder: after.filter((item) => !before.some((old) => old.id === item.id)).map((item) => item.id) };
      }
      if (key === "doneDates" || key === "days") {
        const add = after.filter((item) => !before.includes(item));
        const remove = before.filter((item) => !after.includes(item));
        return add.length || remove.length ? { type: "members", add, remove } : null;
      }
    }
    if (plain(before) && plain(after)) {
      const entries = [];
      for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!safeKey(field)) continue;
        const change = diff(before[field], after[field], field);
        if (change) entries.push([field, change]);
      }
      return entries.length ? { type: "fields", entries } : null;
    }
    return JSON.stringify(before) === JSON.stringify(after) ? null : { type: "set", value: after };
  }

  function apply(value, patch) {
    if (patch.type === "set") return copy(patch.value);
    if (patch.type === "delete" || value === undefined) return undefined;
    if (patch.type === "members") return [...new Set([...value.filter((item) => !patch.remove.includes(item)), ...patch.add])];
    if (patch.type === "items") {
      const updated = apply(Object.fromEntries(value.map((item) => [item.id, item])), patch.edits);
      const order = new Set([...patch.addedOrder, ...value.map((item) => item.id)]);
      return [...order].filter((id) => Object.hasOwn(updated, id)).map((id) => updated[id]);
    }
    const result = { ...value };
    for (const [key, change] of patch.entries) {
      if (!safeKey(key)) continue;
      const next = apply(Object.hasOwn(result,key) ? result[key] : undefined, change);
      if (next === undefined) delete result[key];
      else result[key] = next;
    }
    return result;
  }

  function journal(storage, userId) {
    const prefix = "khnayik:pending:v1:" + userId + ":";
    let sequence = 0;
    function entries() {
      const keys = [];
      for (let n = 0; n < storage.length; n++) {
        const key = storage.key(n);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      return keys.sort().map((key) => {
        const raw = storage.getItem(key);
        return raw && { key, ...JSON.parse(raw) };
      }).filter(Boolean);
    }
    function add(patch) {
      const id = crypto.randomUUID();
      const latest = entries().at(-1);
      sequence = Math.max(sequence + 1, Date.now(), latest ? Number(latest.key.slice(prefix.length, prefix.length + 16)) + 1 : 0);
      const key = prefix + String(sequence).padStart(16, "0") + ":" + id;
      storage.setItem(key, JSON.stringify({ id, patch }));
    }
    return { entries, add, remove: (entry) => storage.removeItem(entry.key) };
  }
  return { diff, apply, journal, copy };
})();
