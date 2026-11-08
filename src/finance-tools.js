/* Pure helpers for imports, category planning and monthly analysis. */
globalThis.KhnayikFinance = (() => {
  const categories = ["Սնունդ", "Տրանսպորտ", "Տուն", "Առողջություն", "Ժամանց", "Այլ"];

  const categoryRules = [
    ["Սնունդ", ["սնունդ", "մթերք", "սուրճ", "ճաշ", "ռեստորան", "սուպերմարկետ", "market", "supermarket", "coffee", "cafe", "restaurant", "food"]],
    ["Տրանսպորտ", ["տաքսի", "բենզին", "վառելիք", "ավտոբուս", "մետրո", "yandex", "gg", "taxi", "fuel", "transport"]],
    ["Տուն", ["վարձ", "կոմունալ", "էլեկտր", "գազ", "ջուր", "ինտերնետ", "տուն", "rent", "utility", "electric", "internet"]],
    ["Առողջություն", ["դեղ", "դեղատուն", "բժիշկ", "կլինիկա", "ատամ", "pharmacy", "clinic", "doctor", "medical"]],
    ["Ժամանց", ["կինո", "խաղ", "համերգ", "netflix", "spotify", "cinema", "game", "entertainment"]],
  ];

  function inferCategory(title) {
    const value = String(title || "").toLocaleLowerCase("hy-AM");
    return categoryRules.find(([, words]) => words.some((word) => value.includes(word)))?.[0] || "Այլ";
  }

  function monthKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime())
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "";
  }

  function incomeForMonth(incomes, key) {
    return (Array.isArray(incomes) ? incomes : []).filter((income) => {
      if (income.kind === "monthly") return !income.startMonth || income.startMonth <= key;
      return monthKey(income.date || income.createdAt) === key;
    }).reduce((total, income) => total + Math.max(0, Number(income.amount) || 0), 0);
  }

  function totalsByCategory(expenses, key) {
    const totals = Object.fromEntries(categories.map((category) => [category, 0]));
    for (const expense of Array.isArray(expenses) ? expenses : []) {
      if (key && monthKey(expense.createdAt) !== key) continue;
      const category = categories.includes(expense.category) ? expense.category : "Այլ";
      totals[category] += Math.max(0, Number(expense.amount) || 0);
    }
    return totals;
  }

  function parseDate(value) {
    const text = String(value || "").trim();
    let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
    const parsed = new Date(text);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
  }

  function validDate(year, month, day) {
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  }

  function parseAmount(value) {
    let text = String(value ?? "").trim().replace(/[֏$€£₽]/g, "").replace(/\s/g, "");
    const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
    text = text.replace(/[()]/g, "");
    if (text.includes(",") && text.includes(".")) text = text.replace(/,/g, "");
    else text = text.replace(",", ".");
    const number = Number(text);
    return Number.isFinite(number) ? Math.round((negative ? -1 : 1) * Math.abs(number)) : null;
  }

  function splitCsvLine(line, delimiter) {
    const cells = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(value.trim()); value = "";
      } else value += char;
    }
    cells.push(value.trim());
    return cells;
  }

  const headerNames = {
    date: ["date", "ամսաթիվ", "օր"],
    title: ["description", "details", "merchant", "title", "name", "նկարագրություն", "անվանում", "վաճառող"],
    amount: ["amount", "sum", "գումար"],
    debit: ["debit", "expense", "ելք", "ծախս"],
    credit: ["credit", "income", "մուտք", "եկամուտ"],
    type: ["type", "տեսակ", "operation"],
  };

  function findColumn(headers, names) {
    return headers.findIndex((header) => names.some((name) => header.includes(name)));
  }

  function parseStatement(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const delimiters = [",", ";", "\t"];
    const delimiter = delimiters.sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
    const headers = splitCsvLine(lines[0], delimiter).map((value) => value.toLocaleLowerCase("hy-AM").trim());
    const indexes = Object.fromEntries(Object.entries(headerNames).map(([key, names]) => [key, findColumn(headers, names)]));
    if (indexes.date < 0 || indexes.title < 0 || (indexes.amount < 0 && indexes.debit < 0 && indexes.credit < 0)) return [];
    const rows = [];
    for (const line of lines.slice(1)) {
      const cells = splitCsvLine(line, delimiter);
      const date = parseDate(cells[indexes.date]);
      const title = String(cells[indexes.title] || "").trim().slice(0, 100);
      let amount = indexes.amount >= 0 ? parseAmount(cells[indexes.amount]) : null;
      let kind = amount !== null && amount < 0 ? "expense" : "income";
      if (indexes.debit >= 0 && parseAmount(cells[indexes.debit])) { amount = Math.abs(parseAmount(cells[indexes.debit])); kind = "expense"; }
      else if (indexes.credit >= 0 && parseAmount(cells[indexes.credit])) { amount = Math.abs(parseAmount(cells[indexes.credit])); kind = "income"; }
      const type = indexes.type >= 0 ? String(cells[indexes.type] || "").toLocaleLowerCase("hy-AM") : "";
      if (/debit|expense|ելք|ծախս/.test(type)) kind = "expense";
      if (/credit|income|մուտք|եկամուտ/.test(type)) kind = "income";
      if (!date || !title || amount === null || amount === 0) continue;
      amount = Math.abs(amount);
      const externalKey = `${date}|${amount}|${title.toLocaleLowerCase("hy-AM")}`;
      rows.push({ date, title, amount, kind, category: inferCategory(title), externalKey });
    }
    return rows;
  }

  function insights({ expenses, categoryBudgets, currentMonth, previousMonth }) {
    const current = totalsByCategory(expenses, currentMonth);
    const previous = totalsByCategory(expenses, previousMonth);
    const currentTotal = Object.values(current).reduce((sum, value) => sum + value, 0);
    const previousTotal = Object.values(previous).reduce((sum, value) => sum + value, 0);
    const messages = [];
    if (previousTotal > 0) {
      const change = Math.round((currentTotal - previousTotal) / previousTotal * 100);
      messages.push(change > 0
        ? `Այս ամսվա ծախսերը նախորդ ամսից ${change}% ավելի են։`
        : change < 0 ? `Այս ամսվա ծախսերը նախորդ ամսից ${Math.abs(change)}% քիչ են։` : "Ծախսերը նախորդ ամսվա մակարդակին են։");
    }
    const largest = Object.entries(current).sort((a, b) => b[1] - a[1])[0];
    if (largest?.[1]) messages.push(`Ամենամեծ կատեգորիան «${largest[0]}»-ն է՝ ${largest[1]} ֏։`);
    for (const category of categories) {
      const limit = Math.max(0, Number(categoryBudgets?.[category]) || 0);
      if (limit && current[category] >= limit) messages.push(`«${category}» կատեգորիան գերազանցել է սահմանաչափը ${current[category] - limit} ֏-ով։`);
      else if (limit && current[category] >= limit * 0.8) messages.push(`«${category}» կատեգորիան արդեն օգտագործել է սահմանաչափի ${Math.round(current[category] / limit * 100)}%-ը։`);
    }
    const monthRows = (Array.isArray(expenses) ? expenses : []).filter((expense) => monthKey(expense.createdAt) === currentMonth);
    const average = monthRows.length ? currentTotal / monthRows.length : 0;
    const unusual = monthRows.filter((expense) => average > 0 && expense.amount >= average * 2.5).sort((a, b) => b.amount - a.amount)[0];
    if (unusual) messages.push(`Անսովոր մեծ ծախս՝ «${unusual.title}»՝ ${unusual.amount} ֏։`);
    if (!messages.length) messages.push("Ավելացրեք ավելի շատ գործարքներ՝ անհատական վերլուծություն ստանալու համար։");
    return messages.slice(0, 6);
  }

  return Object.freeze({ categories, inferCategory, incomeForMonth, totalsByCategory, parseStatement, insights, monthKey });
})();
