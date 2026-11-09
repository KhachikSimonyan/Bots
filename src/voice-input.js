/* Pure Armenian voice-command parsing helpers. */
globalThis.KhnayikVoice = (() => {
  const commandWords = [
    "գրանցիր", "գրանցել", "ավելացրու", "ավելացնել", "ստեղծիր", "ստեղծել",
    "հիշեցրու", "հիշեցնել", "պլանավորիր", "պլանավորել", "ծախս", "ծախսը", "գործ", "գործը",
  ];
  const units = new Map([
    ["զրո", 0], ["մեկ", 1], ["երկու", 2], ["երեք", 3], ["չորս", 4],
    ["հինգ", 5], ["վեց", 6], ["յոթ", 7], ["ութ", 8], ["ինը", 9],
  ]);
  const tens = new Map([
    ["տաս", 10], ["քսան", 20], ["երեսուն", 30], ["քառասուն", 40], ["հիսուն", 50],
    ["վաթսուն", 60], ["յոթանասուն", 70], ["ութսուն", 80], ["իննսուն", 90],
  ]);

  function clean(value) {
    return String(value || "")
      .toLocaleLowerCase("hy-AM")
      .replace(/[։:](?=\s|$)/g, " ")
      .replace(/[«»"'՞՜՛՝,!?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(value, days) {
    const date = new Date(value);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date;
  }

  function numericAmount(text) {
    const match = text.match(/(?:^|\s)(\d[\d\s.,]*)(?=\s*(?:դրամ|դր|֏|$))/u);
    if (!match) return null;
    const digits = match[1].replace(/\D/g, "");
    const amount = Number(digits);
    return Number.isSafeInteger(amount) && amount > 0 ? { amount, raw: match[0].trim() } : null;
  }

  function spokenAmount(text) {
    const tokens = text.split(" ");
    for (let start = 0; start < tokens.length; start += 1) {
      let total = 0;
      let group = 0;
      let matched = 0;
      for (let index = start; index < tokens.length; index += 1) {
        const token = tokens[index].replace(/ին$/, "");
        if (units.has(token)) group += units.get(token);
        else if (tens.has(token)) group += tens.get(token);
        else if (token === "հարյուր") group = (group || 1) * 100;
        else if (token === "հազար") { total += (group || 1) * 1000; group = 0; }
        else if (token === "միլիոն") { total += (group || 1) * 1000000; group = 0; }
        else break;
        matched += 1;
      }
      const amount = total + group;
      if (matched && amount > 0) return { amount, raw: tokens.slice(start, start + matched).join(" ") };
    }
    return null;
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function stripWords(text, words) {
    let result = ` ${text} `;
    for (const word of words.filter(Boolean)) {
      result = result.replace(new RegExp(`\\s${escapeRegex(word)}(?=\\s|$)`, "gu"), " ");
    }
    return result.replace(/\s+/g, " ").trim();
  }

  function parseExpense(transcript) {
    const text = clean(transcript);
    const found = numericAmount(text) || spokenAmount(text);
    if (!found) return { error: "amount", transcript: text };
    let title = stripWords(text, [...commandWords, found.raw, "դրամ", "դր", "֏", "կանխիկ", "քարտով", "քարտ"]);
    title = title.replace(/^ի համար\s+|\s+ի համար$/gu, "").trim();
    if (!title) return { error: "title", amount: found.amount, transcript: text };
    return { title, amount: found.amount, transcript: text };
  }

  function parseTime(text) {
    let match = text.match(/(?:ժամը?\s*)?(\d{1,2})(?:[:։](\d{1,2}))(?=\s|$)/u);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour < 24 && minute < 60) return { time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, raw: match[0].trim() };
    }
    match = text.match(/ժամը?\s+(\d{1,2})(?:-?ին)?(?=\s|$)/u);
    if (match && Number(match[1]) < 24) {
      return { time: `${String(Number(match[1])).padStart(2, "0")}:00`, raw: match[0].trim() };
    }
    return null;
  }

  function parseTask(transcript, now = new Date()) {
    const text = clean(transcript);
    let offset = 0;
    let datePhrase = "";
    if (/(?:^|\s)մյուս օրը(?:\s|$)/u.test(text)) { offset = 2; datePhrase = "մյուս օրը"; }
    else if (/(?:^|\s)վաղը(?:\s|$)/u.test(text)) { offset = 1; datePhrase = "վաղը"; }
    else if (/(?:^|\s)այսօր(?:\s|$)/u.test(text)) { datePhrase = "այսօր"; }
    const time = parseTime(text);
    const title = stripWords(text, [...commandWords, datePhrase, time?.raw, "խնդրում եմ"])
      .replace(/^ի մասին\s+|\s+ի մասին$/gu, "")
      .trim();
    if (!title) return { error: "title", transcript: text };
    return { title, date: dateKey(addDays(now, offset)), time: time?.time || "09:00", transcript: text };
  }

  return Object.freeze({ parseExpense, parseTask });
})();
