const STORAGE_KEY = "hy-budget-mini-app";
const tg = window.Telegram?.WebApp;

const state = loadState();
let activePeriod = "day";
let activeView = "budget";
let activeMonthMode = "expenses";
let selectedMonthKey = "";
let isScheduledFormOpen = false;
let activeTaskFilter = "all";
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
  budgetView: document.getElementById("budgetView"),
  tasksView: document.getElementById("tasksView"),
  freeMoney: document.getElementById("freeMoney"),
  budgetHint: document.getElementById("budgetHint"),
  budgetMeter: document.getElementById("budgetMeter"),
  budgetPercent: document.getElementById("budgetPercent"),
  periodLabel: document.getElementById("periodLabel"),
  periodTotal: document.getElementById("periodTotal"),
  dailyLimit: document.getElementById("dailyLimit"),
  daysLeft: document.getElementById("daysLeft"),
  monthsView: document.getElementById("monthsView"),
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
  exportBtn: document.getElementById("exportBtn"),
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
};

const categoryColors = {
  "Սնունդ": "#f1c453",
  "Տրանսպորտ": "#7bb7d6",
  "Տուն": "#8fc9a7",
  "Առողջություն": "#e98276",
  "Ժամանց": "#b79bd8",
  "Այլ": "#c9b89b",
};

initTelegram();
initTimePickers();
bindEvents();
render();
setInterval(checkReminders, 30000);
checkReminders();

function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#f7f3ea");
  tg.setBackgroundColor("#f7f3ea");

  const name = tg.initDataUnsafe?.user?.first_name;
  if (name) {
    els.greeting.textContent = `Բարի օր, ${name}`;
  }
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

function getSelectedTime(key) {
  return `${els[`${key}Hour`].value}:${els[`${key}Minute`].value}`;
}

function resetTimePicker(key) {
  els[`${key}Hour`].value = "09";
  els[`${key}Minute`].value = "00";
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

  els.salaryInput.addEventListener("input", () => {
    state.salary = toNumber(els.salaryInput.value);
    saveState();
    renderBudget();
  });

  els.fixedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.fixedName.value.trim();
    const amount = toNumber(els.fixedAmount.value);
    if (!title || !amount) return;

    state.fixedExpenses.push({
      id: crypto.randomUUID(),
      title,
      amount,
    });
    els.fixedName.value = "";
    els.fixedAmount.value = "";
    saveState();
    render();
  });

  els.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.expenseTitle.value.trim();
    const amount = toNumber(els.expenseAmount.value);
    if (!title || !amount) return;

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
    const confirmed = window.confirm("Մաքրե՞լ բոլոր ծախսերը");
    if (!confirmed) return;
    state.expenses = [];
    saveState();
    render();
  });

  els.exportBtn.addEventListener("click", exportCsv);
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

  els.selectAllDaysBtn.addEventListener("click", () => {
    const boxes = [...els.dayGrid.querySelectorAll("input")];
    const shouldCheck = boxes.some((box) => !box.checked);
    boxes.forEach((box) => {
      box.checked = shouldCheck;
    });
  });

  els.recurringTaskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.recurringTitle.value.trim();
    const time = getSelectedTime("recurringTime");
    const days = [...els.dayGrid.querySelectorAll("input:checked")].map((box) => Number(box.value));
    if (!title || !time || !days.length) return;

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
    els.recurringReminderDate.value = "";
    saveState();
    renderTasks();
    maybeRequestNotifications(state.recurringTasks[0].reminder);
  });

  els.scheduledTaskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.scheduledTitle.value.trim();
    const date = els.scheduledDate.value;
    const time = getSelectedTime("scheduledTime");
    if (!title || !date || !time) return;

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
    els.scheduledReminderDate.value = "";
    saveState();
    renderTasks();
    maybeRequestNotifications(state.scheduledTasks[0].reminder);
  });
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
}

function renderView() {
  document.querySelectorAll(".switch-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeView);
  });
  els.budgetView.classList.toggle("is-active", activeView === "budget");
  els.tasksView.classList.toggle("is-active", activeView === "tasks");
  els.monthsView.classList.toggle("is-active", activeView === "months");
  els.exportBtn.classList.toggle("is-hidden", activeView === "tasks");
  els.appEyebrow.textContent = {
    budget: "Իմ բյուջեն",
    tasks: "Իմ ժամանակը",
    months: "Ամսական պատմություն",
  }[activeView];
}

function renderBudget() {
  const fixedTotal = sum(state.fixedExpenses);
  const monthSpent = sum(filterByPeriod("month"));
  const base = Math.max(state.salary - fixedTotal, 0);
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
      saveState();
      render();
    });
    els.fixedList.append(row);
  });
}

function renderExpenses() {
  els.expenseList.innerHTML = "";
  els.expenseCount.textContent = state.expenses.length
    ? `${state.expenses.length} գրառում`
    : "Դեռ ծախս չկա";

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

  if (!selectedMonthKey || !months.some((month) => month.key === selectedMonthKey)) {
    selectedMonthKey = months[0].key;
  }

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

  if (activeMonthMode === "expenses") {
    renderMonthExpenses(selectedMonthKey);
  } else {
    renderMonthTasks(selectedMonthKey);
  }
}

function renderMonthExpenses(monthKey) {
  const expenses = state.expenses.filter((expense) => getMonthKey(new Date(expense.createdAt)) === monthKey);
  if (!expenses.length) {
    els.monthList.innerHTML = `<div class="empty-state">Այս ամսում ծախս չկա</div>`;
    return;
  }

  const max = Math.max(...expenses.map((expense) => Number(expense.amount || 0)), 1);
  addMonthTotalRow("Ընդհանուր ծախս", formatMoney(sum(expenses)));
  expenses.forEach((expense) => {
    const row = document.createElement("article");
    row.className = "month-item";
    row.innerHTML = `
      <div class="month-line">
        <strong></strong>
        <span></span>
      </div>
      <small></small>
      <div class="month-bar"><i></i></div>
    `;
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
    row.innerHTML = `
      <div class="month-line">
        <strong></strong>
        <span></span>
      </div>
      <small></small>
    `;
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

  if (!allCount) {
    els.taskList.innerHTML = `<div class="empty-state">Ավելացրեք առաջին պլանավորված գործը</div>`;
    return;
  }

  const items = [
    ...state.scheduledTasks.map((task) => ({ ...task, type: "scheduled" })),
    ...state.recurringTasks.map((task) => ({ ...task, type: "recurring" })),
  ].filter(matchesTaskFilter).sort(compareTasks);

  renderTaskFilterButtons();

  if (!items.length) {
    els.taskList.innerHTML = `<div class="empty-state">Այս ֆիլտրով գործ չկա</div>`;
    return;
  }

  items.forEach((task) => {
    const row = document.createElement("article");
    row.className = "task-item";
    row.innerHTML = `
      <label class="task-check">
        <input type="checkbox" />
        <span></span>
      </label>
      <div class="task-info">
        <strong></strong>
        <small></small>
      </div>
      <div class="task-actions">
        <button class="reminder-chip" type="button"></button>
        <button class="delete-task" type="button">×</button>
      </div>
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

function renderTaskFilterButtons() {
  document.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.taskFilter === activeTaskFilter);
  });
}

function matchesTaskFilter(task) {
  if (activeTaskFilter === "done") return isTaskDone(task);
  if (activeTaskFilter === "todo") return !isTaskDone(task);
  if (activeTaskFilter === "reminder") return task.reminder;
  if (activeTaskFilter === "no-reminder") return !task.reminder;
  return true;
}

function getTodayTasks() {
  const todayKey = getDateKey(new Date());
  const day = new Date().getDay();
  return [
    ...state.scheduledTasks.filter((task) => task.date === todayKey && !task.done),
    ...state.recurringTasks.filter((task) => task.days.includes(day) && !task.doneDates.includes(todayKey)),
  ];
}

function compareTasks(a, b) {
  const aDate = a.type === "scheduled" ? `${a.date}T${a.time}` : `9999-12-31T${a.time}`;
  const bDate = b.type === "scheduled" ? `${b.date}T${b.time}` : `9999-12-31T${b.time}`;
  return aDate.localeCompare(bDate);
}

function getTaskMeta(task) {
  const reminderText = getReminderText(task);
  if (task.type === "scheduled") {
    return `${formatTaskDate(task.date)} ${task.time}${reminderText}`;
  }

  return `${formatDays(task.days)} · ${task.time}${reminderText}`;
}

function getReminderText(task) {
  if (!task.reminder) return " · հիշեցում չկա";
  if (task.reminderAt) return ` · հիշեցում ${formatReminderAt(task.reminderAt)}`;
  return ` · հիշեցում ${getLeadText(task.leadMinutes)}`;
}

function getLeadText(minutes) {
  if (!minutes) return "ժամին";
  if (minutes === 60) return "1 ժամ շուտ";
  return `${minutes} րոպե շուտ`;
}

function formatDays(days) {
  const names = ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ"];
  if (days.length === 7) return "ամեն օր";
  return days.sort((a, b) => a - b).map((day) => names[day]).join(", ");
}

function formatTaskDate(value) {
  return new Intl.DateTimeFormat("hy-AM", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00`));
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

function isTaskDone(task) {
  if (task.type === "scheduled") return task.done;
  return task.doneDates.includes(getDateKey(new Date()));
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
  if (task.type === "scheduled") {
    state.scheduledTasks = state.scheduledTasks.filter((entry) => entry.id !== task.id);
  } else {
    state.recurringTasks = state.recurringTasks.filter((entry) => entry.id !== task.id);
  }
  saveState();
  renderTasks();
}

function checkReminders() {
  const now = new Date();
  const today = getDateKey(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  state.scheduledTasks.forEach((task) => {
    if (!task.reminder || task.done) return;
    const due = new Date(`${task.date}T${task.time}`);
    const reminderAt = task.reminderAt ? new Date(task.reminderAt) : new Date(due.getTime() - task.leadMinutes * 60000);
    const reminderEnd = task.reminderAt ? new Date(reminderAt.getTime() + 60000) : new Date(due.getTime() + 60000);
    const key = `scheduled-${task.id}`;
    if (now >= reminderAt && now <= reminderEnd && !state.notified[key]) {
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

function notifyTask(title) {
  tg?.HapticFeedback?.notificationOccurred("warning");
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Գործի հիշեցում", { body: title });
    return;
  }
  window.alert(`Հիշեցում՝ ${title}`);
}

function requestNotifications() {
  if (!("Notification" in window)) {
    window.alert("Այս browser-ը չի աջակցում հիշեցումների notification-ներ։");
    return;
  }
  Notification.requestPermission().then(() => {
    renderTasks();
  });
}

function maybeRequestNotifications(enabled) {
  if (!enabled || !("Notification" in window) || Notification.permission !== "default") return;
  requestNotifications();
}

function getNotificationButtonText() {
  if (!("Notification" in window)) return "Հիշեցումներ՝ ներսում";
  if (Notification.permission === "granted") return "Հիշեցումները միացված են";
  if (Notification.permission === "denied") return "Հիշեցումները արգելված են";
  return "Միացնել հիշեցումները";
}

function getCustomReminderAt(date, time) {
  if (!date || !time) return "";
  return new Date(`${date}T${time}`).toISOString();
}

function getMonthOptions() {
  const formatter = new Intl.DateTimeFormat("hy-AM", {
    month: "long",
    year: "numeric",
  });
  const grouped = new Map();

  state.expenses.forEach((expense) => {
    const date = new Date(expense.createdAt);
    const key = getMonthKey(date);
    grouped.set(key, {
      key,
      date,
      label: formatter.format(date),
    });
  });

  state.scheduledTasks.forEach((task) => {
    const date = new Date(`${task.date}T00:00`);
    const key = getMonthKey(date);
    grouped.set(key, {
      key,
      date,
      label: formatter.format(date),
    });
  });

  state.recurringTasks.forEach((task) => {
    const date = new Date(task.createdAt || Date.now());
    const key = getMonthKey(date);
    grouped.set(key, {
      key,
      date,
      label: formatter.format(date),
    });
  });

  return [...grouped.values()].sort((a, b) => b.date - a.date);
}

function getTasksForMonth(monthKey) {
  const scheduled = state.scheduledTasks
    .filter((task) => task.date.startsWith(monthKey))
    .map((task) => ({
      title: task.title,
      done: task.done,
      meta: `${formatTaskDate(task.date)} ${task.time}${getReminderText(task)}`,
    }));

  const recurring = state.recurringTasks
    .filter((task) => getMonthKey(new Date(task.createdAt || Date.now())) <= monthKey)
    .map((task) => ({
      title: task.title,
      done: false,
      meta: `${formatDays(task.days)} · ${task.time}${getReminderText(task)}`,
    }));

  return [...scheduled, ...recurring];
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
  return {
    day: "Այսօր",
    week: "Այս շաբաթ",
    month: "Այս ամիս",
  }[activePeriod];
}

function loadState() {
  const fallback = {
    salary: 0,
    fixedExpenses: [],
    expenses: [],
    recurringTasks: [],
    scheduledTasks: [],
    notified: {},
  };

  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return fallback;
  }
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function toNumber(value) {
  return Number(String(value).replace(/[^\d.]/g, "")) || 0;
}

function formatMoney(value) {
  return `֏${Math.round(value).toLocaleString("hy-AM")}`;
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

function exportCsv() {
  const rows = [
    ["title", "amount", "category", "createdAt"],
    ...state.expenses.map((item) => [item.title, item.amount, item.category, item.createdAt]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "expenses.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
