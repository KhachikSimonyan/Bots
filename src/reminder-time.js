// Shared by the Mini App and the scheduled Worker. All stored instants are UTC.
(() => {
  const DAY = 86400000;
  const MINUTE = 60000;
  const formats = new Map();

  function formatter(zone) {
    if (!formats.has(zone)) {
      const format = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23", numberingSystem: "latn",
      });
      if (formats.size > 64) formats.clear();
      formats.set(zone, format);
    }
    return formats.get(zone);
  }

  function localParts(ms, zone) {
    const fields = Object.fromEntries(formatter(zone).formatToParts(ms).map(({type,value}) => [type,value]));
    return { date: fields.year + "-" + fields.month + "-" + fields.day, time: fields.hour + ":" + fields.minute };
  }

  function dayKey(ms, zone) {
    return localParts(ms, zone).date;
  }

  function asUtc(day, time) {
    return Date.parse(day + "T" + time + ":00Z");
  }

  function shiftDay(day, count) {
    return new Date(asUtc(day, "00:00") + count * DAY).toISOString().slice(0, 10);
  }

  // At a DST fold take the first occurrence. For a spring gap move the wall
  // time forward by the gap, as the browser does for a local Date.
  function instant(day, time, zone) {
    const wall = asUtc(day, time);
    const offsets = new Set();
    for (const sample of [wall - DAY, wall + DAY]) {
      const local = localParts(sample, zone);
      offsets.add(asUtc(local.date, local.time) - sample);
    }
    const candidates = [...offsets].map(offset => wall - offset).sort((a,b) => a-b);
    for (const ms of candidates) {
      const local = localParts(ms, zone);
      if (local.date === day && local.time === time) return ms;
    }
    return candidates.at(-1);
  }

  function next(task, type, from, defaultZone = "Asia/Yerevan") {
    if (!task?.reminder || !task.id || !task.title || (type === "scheduled" && task.done)) return null;
    try {
      const zone = task.timeZone || defaultZone;
      const created = Date.parse(task.createdAt);
      const start = Number.isFinite(created) ? Math.max(from, created) : from;
      const maxLead = type === "fixed" ? 31 * 1440 : 1440;
      const lead = Math.max(0, Math.min(maxLead, Number(task.leadMinutes) || 0)) * MINUTE;
      const done = new Set(Array.isArray(task.doneDates) ? task.doneDates : []);
      const paidMonths = new Set(Array.isArray(task.paidMonths) ? task.paidMonths : []);
      if (type === "debt" || type === "fixed") {
        if (!Number.isInteger(Number(task.dueDay)) || Number(task.dueDay) < 1 || Number(task.dueDay) > 31) return null;
        const dueDay = Number(task.dueDay);
        const first = dayKey(start + lead, zone);
        const [firstYear, firstMonth] = first.split("-").map(Number);
        for (let offset = 0; offset < 24; offset++) {
          const monthIndex = firstMonth - 1 + offset;
          const year = firstYear + Math.floor(monthIndex / 12);
          const month = ((monthIndex % 12) + 12) % 12;
          const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
          const day = `${year}-${String(month + 1).padStart(2,"0")}-${String(Math.min(dueDay,lastDay)).padStart(2,"0")}`;
          if (type === "fixed" && paidMonths.has(day.slice(0,7))) continue;
          const at = instant(day, task.time || "09:00", zone) - lead;
          if (Number.isFinite(at) && at >= start) return { at, key: type + "-" + task.id + "-" + day };
        }
        return null;
      }
      if (task.reminderAt || type === "scheduled") {
        const at = task.reminderAt ? Date.parse(task.reminderAt) : instant(task.date, task.time || "09:00", zone) - lead;
        if (!Number.isFinite(at) || at < start) return null;
        if (type === "recurring" && done.has(dayKey(at, zone))) return null;
        const key = type === "scheduled" ? "scheduled-" + task.id + "-" + dayKey(at, zone) : "recurring-custom-" + task.id;
        return { at, key };
      }
      if (!Array.isArray(task.days) || !task.days.length) return null;
      const first = dayKey(start + lead, zone);
      // Completion dates may be present for future occurrences after restore.
      // A weekly schedule has a next occurrence within seven free days.
      for (let i = 0; i < 8 + 7 * done.size; i++) {
        const day = shiftDay(first, i);
        if (done.has(day) || !task.days.includes(new Date(asUtc(day,"00:00")).getUTCDay())) continue;
        const at = instant(day, task.time || "09:00", zone) - lead;
        if (Number.isFinite(at) && at >= start) return { at, key: "recurring-" + task.id + "-" + day };
      }
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
    return null;
  }

  globalThis.KhnayikReminderTime = Object.freeze({ next, dayKey });
})();
