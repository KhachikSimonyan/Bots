const STORAGE_KEY = "hy-budget-mini-app";
const MAX_AMOUNT = 100000000;
const MAX_BACKGROUND_SIZE = 1024 * 1024;
const API_BASE = window.KHNAYIK_API_BASE || localStorage.getItem("khnayik-api-base") || "";
const tg = window.Telegram?.WebApp;
const CLOUD_MODE = Boolean(API_BASE && tg?.initData);

const state = CLOUD_MODE ? normalizeState({}) : loadState();
let activePeriod = "day";
let activeView = "budget";
let activeMonthMode = "expenses";
let selectedMonthKey = "";
let isScheduledFormOpen = false;
let activeTaskFilter = "all";
let syncTimer = 0;
let isCloudReady = false;
let lastCloudUpdatedAt = "";
let hasUnsavedCloudChanges = false;

const accordionState = {
  fixed: true,
  addExpense: true,
  recentExpenses: true,
  months: true,
  recurringTasks: true,
  taskList: true,
};

const els = {
  greeting: document.getElementById("greeting"),
  appEyebrow: document.getElementById("appEyebrow"),
  syncStatus: document.getElementById("syncStatus"),
  budgetView: document.getElementById("budgetView"),
  tasksView: document.getElementById("tasksView"),
  monthsView: document.getElementById("monthsView"),
  settingsView: document.getElementById("settingsView"),
  freeMoney: document.getElementById("freeMoney"),
  budgetHint: document.getElementById("budgetHint"),
  budgetMeter: document.getElementById("budgetMeter"),
  budgetPercent: document.getElementById("budgetPercent"),
  periodLabel: document.getElementById("periodLabel"),
  periodTotal: document.getElementById("periodTotal"),
  dailyLimit: document.getElementById("dailyLimit"),
  daysLeft: document.getElementById("daysLeft"),
  allMonthsTotal: document.getElementById("allMonthsTotal"),
  monthSelect: document.getElementById("monthSelect"),
  monthList: document.getElementById("monthList"),
  salaryInput: document.getElementById("salaryInput"),
  fixedList: document.getElementById("fixedList"),
  fixedForm: document.getElementById("fixedForm"),
  fixedName: document.getElementById("fixedName"),
  fixedAmount: document.getElementById("fixedAmount"),
  expenseForm: document.getElementById("expenseForm"),
  expenseTitle: document.getElementById("expenseTitle"),
  expenseAmount: document.getElementById("expenseAmount"),
  expenseCategory: document.getElementById("expenseCategory"),
  expenseList: document.getElementById("expenseList"),
  expenseCount: document.getElementById("expenseCount"),
  clearBtn: document.getElementById("clearBtn"),
  menuBtn: document.getElementById("menuBtn"),
  expenseTemplate: document.getElementById("expenseTemplate"),
  todayTaskCount: document.getElementById("todayTaskCount"),
  allowNotificationsBtn: document.getElementById("allowNotificationsBtn"),
  recurringTaskForm: document.getElementById("recurringTaskForm"),
  recurringTitle: document.getElementById("recurringTitle"),
  recurringTimeHour: document.getElementById("recurringTimeHour"),
  recurringTimeMinute: document.getElementById("recurringTimeMinute"),
  recurringReminder: document.getElementById("recurringReminder"),
  recurringLead: document.getElementById("recurringLead"),
  recurringReminderDate: document.getElementById("recurringReminderDate"),
  recurringReminderTimeHour: document.getElementById("recurringReminderTimeHour"),
  recurringReminderTimeMinute: document.getElementById("recurringReminderTimeMinute"),
  selectAllDaysBtn: document.getElementById("selectAllDaysBtn"),
  dayGrid: document.getElementById("dayGrid"),
  scheduledTaskForm: document.getElementById("scheduledTaskForm"),
  scheduledFormToggle: document.getElementById("scheduledFormToggle"),
  scheduledToggleMeta: document.getElementById("scheduledToggleMeta"),
  scheduledTitle: document.getElementById("scheduledTitle"),
  scheduledDate: document.getElementById("scheduledDate"),
  scheduledTimeHour: document.getElementById("scheduledTimeHour"),
  scheduledTimeMinute: document.getElementById("scheduledTimeMinute"),
  scheduledReminder: document.getElementById("scheduledReminder"),
  scheduledLead: document.getElementById("scheduledLead"),
  scheduledReminderDate: document.getElementById("scheduledReminderDate"),
  scheduledReminderTimeHour: document.getElementById("scheduledReminderTimeHour"),
  scheduledReminderTimeMinute: document.getElementById("scheduledReminderTimeMinute"),
  taskList: document.getElementById("taskList"),
  taskCount: document.getElementById("taskCount"),
  backgroundPresets: document.getElementById("backgroundPresets"),
  excelExportBtn: document.getElementById("excelExportBtn"),
  excelNote: document.getElementById("excelNote"),
  backgroundInput: document.getElementById("backgroundInput"),
  removeBackgroundBtn: document.getElementById("removeBackgroundBtn"),
  backgroundNote: document.getElementById("backgroundNote"),
};

const categoryColors = {
  "Սնունդ": "#f1c453",
  "Տրանսպորտ": "#7bb7d6",
  "Տուն": "#8fc9a7",
  "Առողջություն": "#e98276",
  "Ժամանց": "#b79bd8",
  "Այլ": "#c9b89b",
};

const defaultBackgrounds = [
  {
    id: "mountain",
    title: "Լեռներ",
    image: svgBackground("#8fc9a7", "#436a90", "#f7f3ea", "M0 142 L70 64 L130 132 L188 46 L320 150 L320 200 L0 200 Z"),
  },
  {
    id: "sunset",
    title: "Մայրամուտ",
    image: svgBackground("#d86145", "#c9912b", "#fffaf0", "M0 150 C70 96 108 176 172 124 C228 78 260 114 320 82 L320 200 L0 200 Z"),
  },
  {
    id: "forest",
    title: "Կանաչ",
    image: svgBackground("#327a5f", "#8fc9a7", "#f3ead8", "M0 150 L36 92 L74 150 L110 82 L154 150 L198 74 L246 150 L286 96 L320 150 L320 200 L0 200 Z"),
  },
  {
    id: "calm",
    title: "Հանգիստ",
    image: svgBackground("#436a90", "#7bb7d6", "#fffaf0", "M0 136 C52 120 92 122 138 138 C190 156 236 150 320 112 L320 200 L0 200 Z"),
  },
];

initTelegram();
initTimePickers();
ensureCurrentMonthBudget();
renderBackgroundPresets();
applyBackgroundImage();
bindEvents();
render();
syncFromCloud();
if (CLOUD_MODE) {
  setInterval(refreshCloudState, 12000);
}
setInterval(checkReminders, 30000);
checkReminders();

function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#f7f3ea");
  tg.setBackgroundColor("#f7f3ea");

  const name = tg.initDataUnsafe?.user?.first_name;
  if (name) els.greeting.textContent = `Բարի օր, ${name}`;
}

function initTimePickers() {
  ["recurringTime", "recurringReminderTime", "scheduledTime", "scheduledReminderTime"].forEach((key) => {
    fillTimeSelect(els[`${key}Hour`], 24);
    fillTimeSelect(els[`${key}Minute`], 60);
    resetTimePicker(key);
  });
}

function fillTimeSelect(select, max) {
  select.innerHTML = "";
  for (let value = 0; value < max; value += 1) {
    const option = document.createElement("option");
    option.value = String(value).padStart(2, "0");
    option.textContent = String(value).padStart(2, "0");
    select.append(option);
  }
}

function bindEvents() {
  document.querySelectorAll(".switch-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.dataset.view) return;
      activeView = button.dataset.view;
      renderView();
    });
  });

  document.querySelectorAll("[data-month-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      activeMonthMode = button.dataset.monthMode;
      renderMonthlySummary();
    });
  });

  document.querySelectorAll("[data-accordion]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.accordion;
      accordionState[key] = !accordionState[key];
      renderAccordions();
    });
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activePeriod = button.dataset.period;
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
      button.classList.add("is-active");
      render();
    });
  });

  els.salaryInput.addEventListener("change", () => {
    const amount = parseAmount(els.salaryInput.value, "Աշխատավարձ");
    if (amount === null) {
      els.salaryInput.value = state.salary || "";
      return;
    }
    state.salary = amount;
    updateCurrentMonthBudget();
    saveState();
    render();
  });

  els.fixedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = normalizeTitle(els.fixedName.value);
    const amount = parseAmount(els.fixedAmount.value, "Ֆիքսված ծախս");
    if (!title || amount === null) return;
    if (isDuplicate(state.fixedExpenses, title)) return showMessage("Այս ֆիքսված ծախսն արդեն կա");

    state.fixedExpenses.push({ id: crypto.randomUUID(), title, amount });
    els.fixedForm.reset();
    updateCurrentMonthBudget();
    saveState();
    render();
  });

  els.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = normalizeTitle(els.expenseTitle.value);
    const amount = parseAmount(els.expenseAmount.value, "Ծախս");
    if (!title || amount === null) return;

    state.expenses.unshift({
      id: crypto.randomUUID(),
      title,
      amount,
      category: els.expenseCategory.value,
      createdAt: new Date().toISOString(),
    });
    els.expenseTitle.value = "";
    els.expenseAmount.value = "";
    saveState();
    render();
    tg?.HapticFeedback?.notificationOccurred("success");
  });

  els.clearBtn.addEventListener("click", () => {
    if (!state.expenses.length) return;
    if (!window.confirm("Մաքրե՞լ բոլոր ծախսերը")) return;
    state.expenses = [];
    saveState();
    render();
  });

  els.menuBtn.addEventListener("click", () => {
    activeView = activeView === "settings" ? "budget" : "settings";
    render();
  });
  els.excelExportBtn.addEventListener("click", exportExcel);
  els.backgroundInput.addEventListener("change", setBackgroundImage);
  els.removeBackgroundBtn.addEventListener("click", removeBackgroundImage);

  els.monthSelect.addEventListener("change", () => {
    selectedMonthKey = els.monthSelect.value;
    renderMonthlySummary();
  });

  els.scheduledFormToggle.addEventListener("click", () => {
    isScheduledFormOpen = !isScheduledFormOpen;
    renderScheduledFormVisibility();
  });

  document.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTaskFilter = button.dataset.taskFilter;
      renderTasks();
    });
  });

  els.allowNotificationsBtn.addEventListener("click", requestNotifications);
  els.selectAllDaysBtn.addEventListener("click", toggleAllDays);
  els.recurringTaskForm.addEventListener("submit", addRecurringTask);
  els.scheduledTaskForm.addEventListener("submit", addScheduledTask);
}

function addRecurringTask(event) {
  event.preventDefault();
  const title = normalizeTitle(els.recurringTitle.value);
  const time = getSelectedTime("recurringTime");
  const days = [...els.dayGrid.querySelectorAll("input:checked")].map((box) => Number(box.value));
  if (!title || !days.length) return showMessage("Գրեք գործը և ընտրեք օրերը");
  if (isDuplicate(state.recurringTasks, title)) return showMessage("Այս ֆիքսված գործն արդեն կա");

  state.recurringTasks.unshift({
    id: crypto.randomUUID(),
    title,
    time,
    days,
    reminder: els.recurringReminder.checked,
    leadMinutes: Number(els.recurringLead.value),
    reminderAt: getCustomReminderAt(els.recurringReminderDate.value, getSelectedTime("recurringReminderTime")),
    doneDates: [],
    createdAt: new Date().toISOString(),
  });
  els.recurringTaskForm.reset();
  resetTimePicker("recurringTime");
  resetTimePicker("recurringReminderTime");
  els.recurringReminder.checked = true;
  els.recurringLead.value = "15";
  saveState();
  renderTasks();
  maybeRequestNotifications(state.recurringTasks[0].reminder);
}

function addScheduledTask(event) {
  event.preventDefault();
  const title = normalizeTitle(els.scheduledTitle.value);
  const date = els.scheduledDate.value;
  const time = getSelectedTime("scheduledTime");
  if (!title || !date) return showMessage("Գրեք գործը և ընտրեք ամսաթիվը");

  state.scheduledTasks.unshift({
    id: crypto.randomUUID(),
    title,
    date,
    time,
    reminder: els.scheduledReminder.checked,
    leadMinutes: Number(els.scheduledLead.value),
    reminderAt: getCustomReminderAt(els.scheduledReminderDate.value, getSelectedTime("scheduledReminderTime")),
    done: false,
    createdAt: new Date().toISOString(),
  });
  els.scheduledTaskForm.reset();
  resetTimePicker("scheduledTime");
  resetTimePicker("scheduledReminderTime");
  els.scheduledReminder.checked = true;
  els.scheduledLead.value = "15";
  saveState();
  renderTasks();
  maybeRequestNotifications(state.scheduledTasks[0].reminder);
}

function render() {
  renderView();
  els.salaryInput.value = state.salary || "";
  renderBudget();
  renderMonthlySummary();
  renderFixedExpenses();
  renderExpenses();
  renderTasks();
  renderScheduledFormVisibility();
  renderAccordions();
  renderSyncStatus();
  applyBackgroundImage();
}

function renderView() {
  document.querySelectorAll(".switch-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeView);
  });
  els.budgetView.classList.toggle("is-active", activeView === "budget");
  els.tasksView.classList.toggle("is-active", activeView === "tasks");
  els.monthsView.classList.toggle("is-active", activeView === "months");
  els.settingsView.classList.toggle("is-active", activeView === "settings");
  els.menuBtn.classList.toggle("is-active", activeView === "settings");
  els.appEyebrow.textContent = {
    budget: "Իմ բյուջեն",
    tasks: "Իմ ժամանակը",
    months: "Ամսական պատմություն",
    settings: "Կարգավորումներ",
  }[activeView];
}

function renderBudget() {
  const currentBudget = getBudgetForMonth(getMonthKey(new Date()));
  const fixedTotal = sum(currentBudget.fixedExpenses);
  const monthSpent = sum(filterByPeriod("month"));
  const base = Math.max(currentBudget.salary - fixedTotal, 0);
  const free = Math.max(base - monthSpent, 0);
  const usage = base ? Math.min(Math.round((monthSpent / base) * 100), 100) : 0;
  const daysLeft = getDaysLeftInMonth();
  const dailyLimit = daysLeft ? Math.floor(free / daysLeft) : free;

  els.freeMoney.textContent = formatMoney(free);
  els.budgetHint.textContent = `Ֆիքսված՝ ${formatMoney(fixedTotal)} · Այս ամիս ծախսված՝ ${formatMoney(monthSpent)}`;
  els.budgetPercent.textContent = `${usage}%`;
  els.budgetMeter.style.strokeDashoffset = String(327 - (327 * usage) / 100);
  els.periodLabel.textContent = getPeriodLabel();
  els.periodTotal.textContent = formatMoney(sum(filterByPeriod(activePeriod)));
  els.dailyLimit.textContent = formatMoney(dailyLimit);
  els.daysLeft.textContent = String(daysLeft);
}

function renderFixedExpenses() {
  els.fixedList.innerHTML = "";
  if (!state.fixedExpenses.length) {
    els.fixedList.innerHTML = `<div class="empty-state">Մշտական ծախսեր դեռ չկան</div>`;
    return;
  }

  state.fixedExpenses.forEach((item) => {
    const row = document.createElement("div");
    row.className = "fixed-item";
    row.innerHTML = `<strong></strong><span></span><button type="button">×</button>`;
    row.querySelector("strong").textContent = item.title;
    row.querySelector("span").textContent = formatMoney(item.amount);
    row.querySelector("button").addEventListener("click", () => {
      state.fixedExpenses = state.fixedExpenses.filter((expense) => expense.id !== item.id);
      updateCurrentMonthBudget();
      saveState();
      render();
    });
    els.fixedList.append(row);
  });
}

function renderExpenses() {
  els.expenseList.innerHTML = "";
  els.expenseCount.textContent = state.expenses.length ? `${state.expenses.length} գրառում` : "Դեռ ծախս չկա";
  if (!state.expenses.length) {
    els.expenseList.innerHTML = `<div class="empty-state">Ավելացրեք առաջին ծախսը</div>`;
    return;
  }

  state.expenses.slice(0, 30).forEach((expense) => {
    const node = els.expenseTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".expense-icon").style.background = categoryColors[expense.category] || categoryColors["Այլ"];
    node.querySelector(".expense-info strong").textContent = expense.title;
    node.querySelector(".expense-info span").textContent = `${expense.category} · ${formatDate(expense.createdAt)}`;
    node.querySelector(".expense-side b").textContent = formatMoney(expense.amount);
    node.querySelector("button").addEventListener("click", () => {
      state.expenses = state.expenses.filter((item) => item.id !== expense.id);
      saveState();
      render();
    });
    els.expenseList.append(node);
  });
}

function renderMonthlySummary() {
  els.monthList.innerHTML = "";
  els.allMonthsTotal.textContent = formatMoney(sum(state.expenses));

  const months = getMonthOptions();
  if (!months.length) {
    els.monthList.innerHTML = `<div class="empty-state">Ամսական պատմություն դեռ չկա</div>`;
    els.monthSelect.innerHTML = "";
    return;
  }

  if (!selectedMonthKey || !months.some((month) => month.key === selectedMonthKey)) selectedMonthKey = months[0].key;

  els.monthSelect.innerHTML = "";
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month.key;
    option.textContent = month.label;
    option.selected = month.key === selectedMonthKey;
    els.monthSelect.append(option);
  });

  document.querySelectorAll("[data-month-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.monthMode === activeMonthMode);
  });

  if (activeMonthMode === "expenses") renderMonthExpenses(selectedMonthKey);
  else renderMonthTasks(selectedMonthKey);
}

function renderMonthExpenses(monthKey) {
  const expenses = state.expenses.filter((expense) => getMonthKey(new Date(expense.createdAt)) === monthKey);
  const budget = getBudgetForMonth(monthKey);
  const fixedTotal = sum(budget.fixedExpenses);
  const spent = sum(expenses);
  addMonthTotalRow("Աշխատավարձ", formatMoney(budget.salary));
  addMonthTotalRow("Ֆիքսված ծախսեր", formatMoney(fixedTotal));
  addMonthTotalRow("Ընդհանուր ծախս", formatMoney(spent));
  addMonthTotalRow("Ազատ մնացորդ", formatMoney(Math.max(budget.salary - fixedTotal - spent, 0)));
  if (!expenses.length) return;

  const max = Math.max(...expenses.map((expense) => Number(expense.amount || 0)), 1);
  expenses.forEach((expense) => {
    const row = document.createElement("article");
    row.className = "month-item";
    row.innerHTML = `<div class="month-line"><strong></strong><span></span></div><small></small><div class="month-bar"><i></i></div>`;
    row.querySelector("strong").textContent = expense.title;
    row.querySelector("span").textContent = formatMoney(expense.amount);
    row.querySelector("small").textContent = `${expense.category} · ${formatDate(expense.createdAt)}`;
    row.querySelector("i").style.width = `${Math.max((expense.amount / max) * 100, 8)}%`;
    els.monthList.append(row);
  });
}

function renderMonthTasks(monthKey) {
  const tasks = getTasksForMonth(monthKey);
  if (!tasks.length) {
    els.monthList.innerHTML = `<div class="empty-state">Այս ամսում գործ չկա</div>`;
    return;
  }

  addMonthTotalRow("Ընդհանուր գործ", `${tasks.length}`);
  tasks.forEach((task) => {
    const row = document.createElement("article");
    row.className = "month-item";
    row.innerHTML = `<div class="month-line"><strong></strong><span></span></div><small></small>`;
    row.querySelector("strong").textContent = task.title;
    row.querySelector("span").textContent = task.done ? "Կատարված" : "Պլանավորված";
    row.querySelector("small").textContent = task.meta;
    els.monthList.append(row);
  });
}

function addMonthTotalRow(label, value) {
  const row = document.createElement("article");
  row.className = "month-item month-total";
  row.innerHTML = `<div class="month-line"><strong></strong><span></span></div>`;
  row.querySelector("strong").textContent = label;
  row.querySelector("span").textContent = value;
  els.monthList.append(row);
}

function renderTasks() {
  const todayItems = getTodayTasks();
  const allCount = state.recurringTasks.length + state.scheduledTasks.length;
  els.todayTaskCount.textContent = `${todayItems.length} գործ`;
  els.taskCount.textContent = allCount ? `${allCount} գործ` : "Դեռ գործ չկա";
  els.allowNotificationsBtn.textContent = getNotificationButtonText();
  els.taskList.innerHTML = "";
  renderTaskFilterButtons();

  if (!allCount) {
    els.taskList.innerHTML = `<div class="empty-state">Ավելացրեք առաջին պլանավորված գործը</div>`;
    return;
  }

  const items = [
    ...state.scheduledTasks.map((task) => ({ ...task, type: "scheduled" })),
    ...state.recurringTasks.map((task) => ({ ...task, type: "recurring" })),
  ].filter(matchesTaskFilter).sort(compareTasks);

  if (!items.length) {
    els.taskList.innerHTML = `<div class="empty-state">Այս ֆիլտրով գործ չկա</div>`;
    return;
  }

  items.forEach((task) => {
    const row = document.createElement("article");
    row.className = "task-item";
    row.innerHTML = `
      <label class="task-check"><input type="checkbox" /><span></span></label>
      <div class="task-info"><strong></strong><small></small></div>
      <div class="task-actions"><button class="reminder-chip" type="button"></button><button class="delete-task" type="button">×</button></div>
    `;

    const checkbox = row.querySelector(".task-check input");
    checkbox.checked = isTaskDone(task);
    checkbox.addEventListener("change", () => toggleTaskDone(task, checkbox.checked));
    row.querySelector(".task-info strong").textContent = task.title;
    row.querySelector(".task-info small").textContent = getTaskMeta(task);

    const reminderBtn = row.querySelector(".reminder-chip");
    reminderBtn.textContent = task.reminder ? "Հիշեցում կա" : "Առանց հիշեցման";
    reminderBtn.classList.toggle("is-off", !task.reminder);
    reminderBtn.addEventListener("click", () => toggleTaskReminder(task));
    row.querySelector(".delete-task").addEventListener("click", () => deleteTask(task));
    els.taskList.append(row);
  });
}

function renderScheduledFormVisibility() {
  els.scheduledTaskForm.classList.toggle("is-hidden", !isScheduledFormOpen);
  els.scheduledFormToggle.setAttribute("aria-expanded", String(isScheduledFormOpen));
  els.scheduledFormToggle.classList.toggle("is-open", isScheduledFormOpen);
  els.scheduledToggleMeta.textContent = isScheduledFormOpen ? "Փակել" : "Բացել";
}

function renderAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((button) => {
    const key = button.dataset.accordion;
    const isOpen = Boolean(accordionState[key]);
    const panel = document.getElementById(`${key}Panel`);
    const meta = button.querySelector(".section-toggle-meta");
    button.setAttribute("aria-expanded", String(isOpen));
    button.classList.toggle("is-open", isOpen);
    if (panel) panel.classList.toggle("is-hidden", !isOpen);
    if (meta) meta.textContent = isOpen ? "Փակել" : "Բացել";
  });
}

function renderSyncStatus(text) {
  if (text) {
    els.syncStatus.textContent = text;
    return;
  }
  if (!API_BASE || !getInitData()) {
    els.syncStatus.textContent = "Preview ռեժիմ՝ պահվում է միայն այս սարքում";
    return;
  }
  els.syncStatus.textContent = isCloudReady ? "Database-ը միացված է" : "Database-ից բեռնում է";
}

async function syncFromCloud() {
  if (!CLOUD_MODE) return;
  try {
    renderSyncStatus("Բեռնում է database-ից");
    const data = await api("/api/state");
    if (data?.state) {
      Object.assign(state, normalizeState(data.state));
      lastCloudUpdatedAt = data.updatedAt || "";
      isCloudReady = true;
      hasUnsavedCloudChanges = false;
      render();
    }
  } catch {
    renderSyncStatus("Database կապ չկա");
  }
}

function queueCloudSave() {
  if (!CLOUD_MODE) return;
  hasUnsavedCloudChanges = true;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(saveCloudState, 700);
}

async function saveCloudState() {
  try {
    renderSyncStatus("Պահվում է database-ում");
    const data = await api("/api/state", {
      method: "PUT",
      body: JSON.stringify({ state, lastKnownUpdatedAt: lastCloudUpdatedAt }),
    });
    isCloudReady = true;
    lastCloudUpdatedAt = data.updatedAt || lastCloudUpdatedAt;
    hasUnsavedCloudChanges = false;
    renderSyncStatus("Database-ը միացված է");
  } catch (error) {
    if (error?.data?.state) {
      Object.assign(state, mergeStates(error.data.state, state));
      lastCloudUpdatedAt = error.data.updatedAt || lastCloudUpdatedAt;
      hasUnsavedCloudChanges = false;
      saveCloudState();
      render();
      return;
    }
    renderSyncStatus("Database պահպանումը չստացվեց");
  }
}

async function refreshCloudState() {
  if (!CLOUD_MODE || hasUnsavedCloudChanges) return;
  try {
    const data = await api("/api/state");
    if (!data?.updatedAt || data.updatedAt === lastCloudUpdatedAt) return;
    Object.assign(state, normalizeState(data.state));
    lastCloudUpdatedAt = data.updatedAt;
    isCloudReady = true;
    render();
  } catch {
    renderSyncStatus("Database կապը ժամանակավոր չկա");
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const error = new Error(`API ${response.status}`);
    try {
      error.data = await response.json();
    } catch {
      error.data = null;
    }
    throw error;
  }
  return response.json();
}

function saveState() {
  ensureCurrentMonthBudget();
  if (CLOUD_MODE) {
    queueCloudSave();
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const fallback = normalizeState({});
  try {
    return normalizeState({ ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) });
  } catch {
    return fallback;
  }
}

function normalizeState(value) {
  return {
    salary: Math.max(0, Number(value.salary || 0)),
    fixedExpenses: Array.isArray(value.fixedExpenses) ? value.fixedExpenses : [],
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    recurringTasks: Array.isArray(value.recurringTasks) ? value.recurringTasks : [],
    scheduledTasks: Array.isArray(value.scheduledTasks) ? value.scheduledTasks : [],
    monthlyBudgets: value.monthlyBudgets && typeof value.monthlyBudgets === "object" ? value.monthlyBudgets : {},
    notified: value.notified && typeof value.notified === "object" ? value.notified : {},
    appearance: value.appearance && typeof value.appearance === "object" ? value.appearance : {},
  };
}

function mergeStates(remoteValue, localValue) {
  const remote = normalizeState(remoteValue);
  const local = normalizeState(localValue);
  return normalizeState({
    ...remote,
    ...local,
    fixedExpenses: mergeById(remote.fixedExpenses, local.fixedExpenses),
    expenses: mergeById(remote.expenses, local.expenses).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    recurringTasks: mergeById(remote.recurringTasks, local.recurringTasks),
    scheduledTasks: mergeById(remote.scheduledTasks, local.scheduledTasks).sort((a, b) => `${a.date || ""}T${a.time || ""}`.localeCompare(`${b.date || ""}T${b.time || ""}`)),
    monthlyBudgets: { ...remote.monthlyBudgets, ...local.monthlyBudgets },
    notified: { ...remote.notified, ...local.notified },
    appearance: { ...remote.appearance, ...local.appearance },
  });
}

function mergeById(remoteItems, localItems) {
  const merged = new Map();
  [...remoteItems, ...localItems].forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
  });
  return [...merged.values()];
}

function ensureCurrentMonthBudget() {
  const key = getMonthKey(new Date());
  if (!state.monthlyBudgets[key]) updateCurrentMonthBudget();
}

function updateCurrentMonthBudget() {
  const key = getMonthKey(new Date());
  state.monthlyBudgets[key] = {
    salary: Number(state.salary || 0),
    fixedExpenses: state.fixedExpenses.map((item) => ({ ...item })),
    savedAt: new Date().toISOString(),
  };
}

function getBudgetForMonth(monthKey) {
  return state.monthlyBudgets[monthKey] || {
    salary: monthKey === getMonthKey(new Date()) ? state.salary : 0,
    fixedExpenses: monthKey === getMonthKey(new Date()) ? state.fixedExpenses : [],
  };
}

function renderBackgroundPresets() {
  els.backgroundPresets.innerHTML = "";
  defaultBackgrounds.forEach((preset) => {
    const button = document.createElement("button");
    button.className = "preset-card";
    button.type = "button";
    button.dataset.backgroundId = preset.id;
    button.style.backgroundImage = `url("${preset.image}")`;
    button.innerHTML = `<span></span>`;
    button.querySelector("span").textContent = preset.title;
    button.addEventListener("click", () => setDefaultBackground(preset));
    els.backgroundPresets.append(button);
  });
}

function setDefaultBackground(preset) {
  state.appearance = {
    ...state.appearance,
    backgroundImage: preset.image,
    backgroundName: preset.title,
    backgroundPreset: preset.id,
  };
  saveState();
  applyBackgroundImage();
  renderBackgroundPresetsActive();
  els.backgroundNote.textContent = `Ֆոնը դրված է՝ ${preset.title}`;
}

function setBackgroundImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showMessage("Ընտրեք նկար ֆայլ");
    event.target.value = "";
    return;
  }
  if (file.size > MAX_BACKGROUND_SIZE) {
    showMessage("Նկարը մեծ է։ Ընտրեք մինչև 1MB ֆայլ");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.appearance = {
      ...state.appearance,
      backgroundImage: String(reader.result || ""),
      backgroundName: file.name,
      backgroundPreset: "",
    };
    saveState();
    applyBackgroundImage();
    els.backgroundNote.textContent = `Ֆոնը դրված է՝ ${file.name}`;
    event.target.value = "";
  });
  reader.readAsDataURL(file);
}

function removeBackgroundImage() {
  state.appearance = { ...state.appearance, backgroundImage: "", backgroundName: "", backgroundPreset: "" };
  saveState();
  applyBackgroundImage();
  renderBackgroundPresetsActive();
  els.backgroundNote.textContent = "Ֆոնային նկարը հեռացված է";
}

function applyBackgroundImage() {
  const image = state.appearance?.backgroundImage;
  document.body.classList.toggle("has-custom-bg", Boolean(image));
  if (image) {
    document.documentElement.style.setProperty("--custom-bg-image", `url("${image}")`);
    if (els.backgroundNote && state.appearance?.backgroundName) {
      els.backgroundNote.textContent = `Ֆոնը դրված է՝ ${state.appearance.backgroundName}`;
    }
  } else {
    document.documentElement.style.removeProperty("--custom-bg-image");
  }
  renderBackgroundPresetsActive();
}

function renderBackgroundPresetsActive() {
  if (!els.backgroundPresets) return;
  els.backgroundPresets.querySelectorAll(".preset-card").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.backgroundId === state.appearance?.backgroundPreset);
  });
}

function exportExcel() {
  const months = getMonthOptions().map((month) => {
    const budget = getBudgetForMonth(month.key);
    const expenses = state.expenses.filter((expense) => getMonthKey(new Date(expense.createdAt)) === month.key);
    const fixedTotal = sum(budget.fixedExpenses);
    const spent = sum(expenses);
    return {
      month: month.label,
      salary: budget.salary,
      fixedTotal,
      spent,
      free: Math.max(budget.salary - fixedTotal - spent, 0),
    };
  });

  const html = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        ${excelTable("Ծախսեր", ["Անուն", "Գումար", "Կատեգորիա", "Ամսաթիվ"], state.expenses.map((item) => [
          item.title,
          item.amount,
          item.category,
          formatDate(item.createdAt),
        ]))}
        ${excelTable("Գործեր", ["Անուն", "Տեսակ", "Ժամ", "Հիշեցում"], [
          ...state.scheduledTasks.map((task) => [task.title, "Մեկանգամյա", `${task.date} ${task.time}`, task.reminder ? "Այո" : "Ոչ"]),
          ...state.recurringTasks.map((task) => [task.title, "Կրկնվող", `${formatDays(task.days)} ${task.time}`, task.reminder ? "Այո" : "Ոչ"]),
        ])}
        ${excelTable("Ամիսներ", ["Ամիս", "Աշխատավարձ", "Ֆիքսված", "Ծախս", "Մնացորդ"], months.map((month) => [
          month.month,
          month.salary,
          month.fixedTotal,
          month.spent,
          month.free,
        ]))}
      </body>
    </html>
  `;
  downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), `khnayik-${getDateKey(new Date())}.xls`);
  els.excelNote.textContent = "Excel ֆայլը պատրաստ է";
}

function excelTable(title, headers, rows) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <table border="1">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function checkReminders() {
  const now = new Date();
  const today = getDateKey(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  state.scheduledTasks.forEach((task) => {
    if (!task.reminder || task.done) return;
    const due = new Date(`${task.date}T${task.time}`);
    const reminderAt = task.reminderAt ? new Date(task.reminderAt) : new Date(due.getTime() - task.leadMinutes * 60000);
    const key = `scheduled-${task.id}-${getDateKey(reminderAt)}`;
    if (now >= reminderAt && now <= new Date(reminderAt.getTime() + 60000) && !state.notified[key]) {
      notifyTask(task.title);
      state.notified[key] = true;
      saveState();
    }
  });

  state.recurringTasks.forEach((task) => {
    if (!task.reminder) return;
    if (task.reminderAt) {
      const reminderAt = new Date(task.reminderAt);
      const key = `recurring-custom-${task.id}`;
      if (now >= reminderAt && now <= new Date(reminderAt.getTime() + 60000) && !state.notified[key]) {
        notifyTask(task.title);
        state.notified[key] = true;
        saveState();
      }
      return;
    }
    if (!task.days.includes(now.getDay())) return;
    const [hours, minutes] = task.time.split(":").map(Number);
    const reminderMinute = hours * 60 + minutes - task.leadMinutes;
    const key = `recurring-${task.id}-${today}`;
    if (minutesNow >= reminderMinute && minutesNow <= reminderMinute + 1 && !state.notified[key]) {
      notifyTask(task.title);
      state.notified[key] = true;
      saveState();
    }
  });
}

function toggleTaskDone(task, isDone) {
  if (task.type === "scheduled") {
    const item = state.scheduledTasks.find((entry) => entry.id === task.id);
    if (item) item.done = isDone;
  } else {
    const item = state.recurringTasks.find((entry) => entry.id === task.id);
    const today = getDateKey(new Date());
    if (item && isDone && !item.doneDates.includes(today)) item.doneDates.push(today);
    if (item && !isDone) item.doneDates = item.doneDates.filter((date) => date !== today);
  }
  saveState();
  renderTasks();
}

function toggleTaskReminder(task) {
  const list = task.type === "scheduled" ? state.scheduledTasks : state.recurringTasks;
  const item = list.find((entry) => entry.id === task.id);
  if (!item) return;
  item.reminder = !item.reminder;
  saveState();
  renderTasks();
  maybeRequestNotifications(item.reminder);
}

function deleteTask(task) {
  const listKey = task.type === "scheduled" ? "scheduledTasks" : "recurringTasks";
  state[listKey] = state[listKey].filter((entry) => entry.id !== task.id);
  saveState();
  renderTasks();
}

function getMonthOptions() {
  const formatter = new Intl.DateTimeFormat("hy-AM", { month: "long", year: "numeric" });
  const grouped = new Map();
  const add = (date) => grouped.set(getMonthKey(date), { key: getMonthKey(date), date, label: formatter.format(date) });

  Object.keys(state.monthlyBudgets).forEach((key) => add(new Date(`${key}-01T00:00`)));
  state.expenses.forEach((expense) => add(new Date(expense.createdAt)));
  state.scheduledTasks.forEach((task) => add(new Date(`${task.date}T00:00`)));
  state.recurringTasks.forEach((task) => add(new Date(task.createdAt || Date.now())));
  return [...grouped.values()].sort((a, b) => b.date - a.date);
}

function getTasksForMonth(monthKey) {
  const scheduled = state.scheduledTasks
    .filter((task) => task.date.startsWith(monthKey))
    .map((task) => ({ title: task.title, done: task.done, meta: `${formatTaskDate(task.date)} ${task.time}${getReminderText(task)}` }));
  const recurring = state.recurringTasks
    .filter((task) => getMonthKey(new Date(task.createdAt || Date.now())) <= monthKey)
    .map((task) => ({ title: task.title, done: false, meta: `${formatDays(task.days)} · ${task.time}${getReminderText(task)}` }));
  return [...scheduled, ...recurring];
}

function getTodayTasks() {
  const todayKey = getDateKey(new Date());
  const day = new Date().getDay();
  return [
    ...state.scheduledTasks.filter((task) => task.date === todayKey && !task.done),
    ...state.recurringTasks.filter((task) => task.days.includes(day) && !task.doneDates.includes(todayKey)),
  ];
}

function matchesTaskFilter(task) {
  if (activeTaskFilter === "done") return isTaskDone(task);
  if (activeTaskFilter === "todo") return !isTaskDone(task);
  if (activeTaskFilter === "reminder") return task.reminder;
  if (activeTaskFilter === "no-reminder") return !task.reminder;
  return true;
}

function renderTaskFilterButtons() {
  document.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.taskFilter === activeTaskFilter);
  });
}

function isTaskDone(task) {
  if (task.type === "scheduled") return task.done;
  return task.doneDates.includes(getDateKey(new Date()));
}

function compareTasks(a, b) {
  const aDate = a.type === "scheduled" ? `${a.date}T${a.time}` : `9999-12-31T${a.time}`;
  const bDate = b.type === "scheduled" ? `${b.date}T${b.time}` : `9999-12-31T${b.time}`;
  return aDate.localeCompare(bDate);
}

function getTaskMeta(task) {
  const reminderText = getReminderText(task);
  if (task.type === "scheduled") return `${formatTaskDate(task.date)} ${task.time}${reminderText}`;
  return `${formatDays(task.days)} · ${task.time}${reminderText}`;
}

function getReminderText(task) {
  if (!task.reminder) return " · հիշեցում չկա";
  if (task.reminderAt) return ` · հիշեցում ${formatReminderAt(task.reminderAt)}`;
  return ` · հիշեցում ${getLeadText(task.leadMinutes)}`;
}

function requestNotifications() {
  if (!("Notification" in window)) return showMessage("Այս browser-ը չի աջակցում notification-ներ");
  Notification.requestPermission().then(renderTasks);
}

function maybeRequestNotifications(enabled) {
  if (!enabled || !("Notification" in window) || Notification.permission !== "default") return;
  requestNotifications();
}

function notifyTask(title) {
  tg?.HapticFeedback?.notificationOccurred("warning");
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Գործի հիշեցում", { body: title });
    return;
  }
  window.alert(`Հիշեցում՝ ${title}`);
}

function toggleAllDays() {
  const boxes = [...els.dayGrid.querySelectorAll("input")];
  const shouldCheck = boxes.some((box) => !box.checked);
  boxes.forEach((box) => {
    box.checked = shouldCheck;
  });
}

function getSelectedTime(key) {
  return `${els[`${key}Hour`].value}:${els[`${key}Minute`].value}`;
}

function resetTimePicker(key) {
  els[`${key}Hour`].value = "09";
  els[`${key}Minute`].value = "00";
}

function getCustomReminderAt(date, time) {
  if (!date || !time) return "";
  return new Date(`${date}T${time}`).toISOString();
}

function filterByPeriod(period) {
  const now = new Date();
  return state.expenses.filter((expense) => {
    const date = new Date(expense.createdAt);
    if (period === "day") return date.toDateString() === now.toDateString();
    if (period === "week") return date >= startOfWeek(now);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function getDaysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

function getPeriodLabel() {
  return { day: "Այսօր", week: "Այս շաբաթ", month: "Այս ամիս" }[activePeriod];
}

function getLeadText(minutes) {
  if (!minutes) return "ժամին";
  if (minutes === 60) return "1 ժամ շուտ";
  return `${minutes} րոպե շուտ`;
}

function formatDays(days) {
  const names = ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ"];
  if (days.length === 7) return "ամեն օր";
  return [...days].sort((a, b) => a - b).map((day) => names[day]).join(", ");
}

function formatTaskDate(value) {
  return new Intl.DateTimeFormat("hy-AM", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00`));
}

function formatReminderAt(value) {
  return new Intl.DateTimeFormat("hy-AM", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("hy-AM", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date(value));
}

function parseAmount(value, label) {
  const amount = Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage(`${label} գումարը պետք է լինի դրական`);
    return null;
  }
  if (amount > MAX_AMOUNT) {
    showMessage(`${label} գումարը չափազանց մեծ է`);
    return null;
  }
  return Math.round(amount);
}

function normalizeTitle(value) {
  const title = String(value || "").trim().replace(/\s+/g, " ");
  if (!title) showMessage("Լրացրեք անվանումը");
  if (title.length > 80) {
    showMessage("Անվանումը շատ երկար է");
    return "";
  }
  return title;
}

function isDuplicate(items, title) {
  return items.some((item) => item.title.trim().toLowerCase() === title.trim().toLowerCase());
}

function showMessage(message) {
  tg?.showAlert?.(message) || window.alert(message);
}

function getNotificationButtonText() {
  if (API_BASE && getInitData()) return "Telegram հիշեցումներ";
  if (!("Notification" in window)) return "Հիշեցումներ՝ ներսում";
  if (Notification.permission === "granted") return "Հիշեցումները միացված են";
  if (Notification.permission === "denied") return "Հիշեցումները արգելված են";
  return "Միացնել հիշեցումները";
}

function getInitData() {
  return tg?.initData || "";
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function formatMoney(value) {
  return `֏${Math.round(value).toLocaleString("hy-AM")}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgBackground(a, b, c, shape) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${a}"/>
          <stop offset="0.58" stop-color="${b}"/>
          <stop offset="1" stop-color="${c}"/>
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#g)"/>
      <circle cx="250" cy="48" r="34" fill="${c}" opacity="0.72"/>
      <path d="${shape}" fill="rgba(255,255,255,0.38)"/>
      <path d="${shape}" transform="translate(0 20)" fill="rgba(32,35,31,0.18)"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
