const STORAGE_KEY = "hy-budget-mini-app";
const MAX_AMOUNT = 100000000;
const MAX_BACKGROUND_SIZE = 1024 * 1024;
const API_BASE = window.KHNAYIK_API_BASE || "";
const tg = window.Telegram?.WebApp;
const CLOUD_MODE = Boolean(API_BASE && tg?.initData);

const state = CLOUD_MODE ? normalizeState({}) : loadState();
let activePeriod = "day";
let activeView = "budget";
let activeMonthMode = "expenses";
let selectedMonthKey = "";
let editingExpenseId = "";
let editingDebtId = "";
let displayedDay = getDateKey(new Date());
let rolloverTimer;
let isScheduledFormOpen = false;
let activeTaskFilter = "all";
let telegramRemindersLinked = false;
let lastDeviceReminderCheck = Date.now() - 60000;
let syncTimer = 0;
let isCloudReady = false;
let lastCloudUpdatedAt = "";
let syncBusy = false;
let cloudBase;
let changeJournal;
let session;
let sessionRequest;
let durableView = KhnayikSync.copy(state);
let syncDescription = "";

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
  debtsView: document.getElementById("debtsView"),
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
  salaryForm: document.getElementById("salaryForm"),
  salaryMode: document.getElementById("salaryMode"),
  salaryDay: document.getElementById("salaryDay"),
  salaryDayRow: document.getElementById("salaryDayRow"),
  salaryDayLabel: document.getElementById("salaryDayLabel"),
  salaryDayHint: document.getElementById("salaryDayHint"),
  salaryInputLabel: document.getElementById("salaryInputLabel"),
  salaryStatus: document.getElementById("salaryStatus"),
  salaryInput: document.getElementById("salaryInput"),
  fixedList: document.getElementById("fixedList"),
  fixedForm: document.getElementById("fixedForm"),
  fixedName: document.getElementById("fixedName"),
  fixedAmount: document.getElementById("fixedAmount"),
  expenseForm: document.getElementById("expenseForm"),
  expenseTitle: document.getElementById("expenseTitle"),
  expenseAmount: document.getElementById("expenseAmount"),
  expenseCategory: document.getElementById("expenseCategory"),
  expenseDate: document.getElementById("expenseDate"),
  expenseSubmit: document.getElementById("expenseSubmit"),
  cancelExpenseEdit: document.getElementById("cancelExpenseEdit"),
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
  csvExportBtn: document.getElementById("csvExportBtn"),
  excelNote: document.getElementById("excelNote"),
  backgroundInput: document.getElementById("backgroundInput"),
  removeBackgroundBtn: document.getElementById("removeBackgroundBtn"),
  backgroundNote: document.getElementById("backgroundNote"),
  totalDebt: document.getElementById("totalDebt"),
  debtFreeDate: document.getElementById("debtFreeDate"),
  debtCapacity: document.getElementById("debtCapacity"),
  debtMinimums: document.getElementById("debtMinimums"),
  debtInterest: document.getElementById("debtInterest"),
  debtPlanSummary: document.getElementById("debtPlanSummary"),
  debtRecommendation: document.getElementById("debtRecommendation"),
  debtPaymentPlan: document.getElementById("debtPaymentPlan"),
  debtStrategy: document.getElementById("debtStrategy"),
  debtSafetyReserve: document.getElementById("debtSafetyReserve"),
  debtReserveNote: document.getElementById("debtReserveNote"),
  saveDebtSettings: document.getElementById("saveDebtSettings"),
  debtForm: document.getElementById("debtForm"),
  debtFormTitle: document.getElementById("debtFormTitle"),
  debtName: document.getElementById("debtName"),
  debtType: document.getElementById("debtType"),
  debtBalance: document.getElementById("debtBalance"),
  debtRate: document.getElementById("debtRate"),
  debtMinimum: document.getElementById("debtMinimum"),
  debtDueDay: document.getElementById("debtDueDay"),
  debtLateFee: document.getElementById("debtLateFee"),
  debtPastDue: document.getElementById("debtPastDue"),
  debtReminder: document.getElementById("debtReminder"),
  debtSubmit: document.getElementById("debtSubmit"),
  cancelDebtEdit: document.getElementById("cancelDebtEdit"),
  debtCount: document.getElementById("debtCount"),
  debtList: document.getElementById("debtList"),
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
if (!CLOUD_MODE) ensureCurrentMonthBudget();
renderBackgroundPresets();
applyBackgroundImage();
bindEvents();
render();
if (CLOUD_MODE) {
  document.querySelectorAll(".app-view").forEach((view) => { view.inert = true; });
  syncFromCloud();
  setInterval(() => { if (!document.hidden) syncFromCloud(); }, 30000);
  window.addEventListener("online", syncFromCloud);
  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith("khnayik:pending:v1:")) scheduleCloudSync();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncFromCloud(); });
}
setInterval(checkReminders, 30000);
checkReminders();

function initTelegram() {
  if (!tg) return;
  tg.ready?.();
  tg.expand?.();
  if (tg.isVersionAtLeast?.("6.1")) {
    tg.setHeaderColor?.(tg.isVersionAtLeast("6.9") ? "#f7f3ea" : "bg_color");
    tg.setBackgroundColor?.("#f7f3ea");
  }

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
  els.expenseDate.value = displayedDay;
  els.expenseDate.max = displayedDay;
  els.cancelExpenseEdit.addEventListener("click", resetExpenseForm);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshCalendar();
  });
  window.addEventListener("pageshow", refreshCalendar);
  scheduleRollover();
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.dataset.view) return;
      activeView = button.dataset.view;
      renderView();
      if (activeView === "months") renderMonthlySummary();
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

  const saveSalary = () => {
    const amount = parseAmount(els.salaryInput.value, "Աշխատավարձ", true);
    if (amount === null) return;
    state.salary = amount;
    updateCurrentMonthBudget(true);
    if (saveState() === false) return;
    render();
  };
  els.salaryInput.addEventListener("change", saveSalary);
  els.salaryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSalary();
  });
  els.salaryMode.addEventListener("change", () => {
    state.salaryMode = els.salaryMode.value === "variable" ? "variable" : "fixed";
    updateCurrentMonthBudget(true);
    if (saveState() === false) return;
    render();
  });
  els.salaryDay.addEventListener("change", () => {
    const day = Number(els.salaryDay.value);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      showMessage("Աշխատավարձի օրը պետք է լինի 1-ից 31։");
      renderSalarySettings();
      return;
    }
    state.salaryDay = day;
    updateCurrentMonthBudget(false);
    if (saveState() === false) return;
    render();
  });

  els.fixedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = normalizeTitle(els.fixedName.value);
    const amount = parseAmount(els.fixedAmount.value, "Ֆիքսված ծախս");
    if (!title || amount === null) return;
    if (isDuplicate(state.fixedExpenses, title)) return showMessage("Այս ֆիքսված ծախսն արդեն կա");

    state.fixedExpenses.push({ id: crypto.randomUUID(), title, amount });
    updateCurrentMonthBudget();
    if (saveState() === false) return;
    els.fixedForm.reset();
    render();
  });

  els.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = normalizeTitle(els.expenseTitle.value);
    const amount = parseAmount(els.expenseAmount.value, "Ծախս");
    if (!title || amount === null) return;

    const original = state.expenses.find((item) => item.id === editingExpenseId);
    if (editingExpenseId && !original) return showMessage("Այս ծախսն արդեն ջնջվել է։ Չեղարկեք խմբագրումը։");
    const createdAt = expenseTimestamp(els.expenseDate.value, original?.createdAt);
    if (!createdAt) return showMessage("Ընտրեք այսօրվա կամ ավելի վաղ ամսաթիվ։");
    const changes = { title, amount, category: els.expenseCategory.value, createdAt };
    if (original) Object.assign(original, changes);
    else state.expenses.unshift({ id: crypto.randomUUID(), ...changes });
    state.expenses.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (saveState() === false) return;
    resetExpenseForm();
    render();
    if (tg?.isVersionAtLeast?.("6.1")) tg.HapticFeedback?.notificationOccurred("success");
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
  els.csvExportBtn.addEventListener("click", exportCsv);
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

  els.saveDebtSettings.addEventListener("click", saveDebtSettings);
  els.debtForm.addEventListener("submit", saveDebt);
  els.cancelDebtEdit.addEventListener("click", resetDebtForm);

  document.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTaskFilter = button.dataset.taskFilter;
      renderTasks();
    });
  });

  els.allowNotificationsBtn.addEventListener("click", requestNotifications);
  document.getElementById("reminderChannel").addEventListener("change", (event) => {
    state.appearance.reminderChannel = event.target.value;
    saveState();
    renderTasks();
  });
  els.selectAllDaysBtn.addEventListener("click", toggleAllDays);
  els.recurringTaskForm.addEventListener("submit", addRecurringTask);
  els.scheduledTaskForm.addEventListener("submit", addScheduledTask);
}

function saveDebtSettings() {
  const reserve = parseAmount(els.debtSafetyReserve.value, "Պաշտպանված գումար", true);
  if (reserve === null) return;
  state.debtSettings = {
    strategy: ["smart", "avalanche", "snowball"].includes(els.debtStrategy.value) ? els.debtStrategy.value : "smart",
    safetyReserve: reserve,
  };
  if (saveState() === false) return;
  renderDebts();
}

function saveDebt(event) {
  event.preventDefault();
  const title = normalizeTitle(els.debtName.value);
  const balance = parseAmount(els.debtBalance.value, "Պարտքի մնացորդ");
  const minimumPayment = parseAmount(els.debtMinimum.value, "Նվազագույն վճար", true);
  const lateFee = parseAmount(els.debtLateFee.value, "Ուշացման տույժ", true);
  const annualRate = Number(els.debtRate.value);
  const dueDay = Number(els.debtDueDay.value);
  if (!title || balance === null || minimumPayment === null || lateFee === null) return;
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1000) return showMessage("Տարեկան տոկոսը պետք է լինի 0-ից 1000 միջակայքում։");
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return showMessage("Վճարման օրը պետք է լինի 1-ից 31։");
  const existing = state.debts.find((debt) => debt.id === editingDebtId);
  const debt = {
    id: existing?.id || crypto.randomUUID(),
    title,
    type: ["card", "loan", "personal", "tax", "other"].includes(els.debtType.value) ? els.debtType.value : "other",
    balance,
    originalBalance: Math.max(balance, Number(existing?.originalBalance || balance)),
    annualRate,
    minimumPayment,
    dueDay,
    lateFee,
    paidTotal: Number(existing?.paidTotal || 0),
    pastDue: els.debtPastDue.checked,
    reminder: els.debtReminder.checked,
    timeZone: existing?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: existing?.createdAt || new Date().toISOString(),
    closedAt: "",
  };
  if (existing) Object.assign(existing, debt);
  else state.debts.unshift(debt);
  if (saveState() === false) return;
  resetDebtForm();
  render();
  maybeRequestNotifications(debt.reminder);
}

function resetDebtForm() {
  editingDebtId = "";
  els.debtForm.reset();
  els.debtRate.value = "0";
  els.debtDueDay.value = "1";
  els.debtLateFee.value = "0";
  els.debtReminder.checked = true;
  els.debtFormTitle.textContent = "Ավելացնել պարտք";
  els.debtSubmit.textContent = "Պահպանել պարտքը";
  els.cancelDebtEdit.hidden = true;
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
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  renderSalarySettings();
  renderBudget();
  renderMonthlySummary();
  renderFixedExpenses();
  renderExpenses();
  renderDebts();
  renderTasks();
  renderScheduledFormVisibility();
  renderAccordions();
  renderSyncStatus();
  applyBackgroundImage();
}

function renderSalarySettings() {
  const variable = state.salaryMode === "variable";
  const budget = state.monthlyBudgets[getMonthKey(new Date())];
  const confirmed = !variable || budget?.salaryConfirmed === true;
  els.salaryMode.value = variable ? "variable" : "fixed";
  els.salaryDay.value = String(state.salaryDay);
  els.salaryDayRow.hidden = false;
  els.salaryDayHint.hidden = false;
  els.salaryDayLabel.textContent = variable ? "Այս ամսվա ստացման օրը" : "Ստացման օրը";
  els.salaryInputLabel.textContent = variable ? "Այս ամսվա աշխատավարձ" : "Ֆիքսված գումար";
  if (document.activeElement !== els.salaryInput) els.salaryInput.value = String(state.salary ?? 0);
  els.salaryStatus.classList.toggle("is-required", !confirmed);
  els.salaryStatus.textContent = variable
    ? confirmed
      ? "Այս ամսվա գումարն ու ստացման օրը հաստատված են։ Հաջորդ ամիս դրանք պետք է նորից ստուգեք։"
      : "Այս ամսվա աշխատավարձը դեռ մուտքագրված չէ։ Նշեք օրը, գրեք գումարը և սեղմեք «Պահել»։"
    : `Ամսական գումարը պահպանված է՝ ${formatMoney(state.salary)}։ Ստացման օր՝ ${state.salaryDay}։`;
}

function renderView() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeView);
    button.setAttribute("aria-pressed", String(button.dataset.view === activeView));
  });
  els.budgetView.classList.toggle("is-active", activeView === "budget");
  els.tasksView.classList.toggle("is-active", activeView === "tasks");
  els.debtsView.classList.toggle("is-active", activeView === "debts");
  els.monthsView.classList.toggle("is-active", activeView === "months");
  els.settingsView.classList.toggle("is-active", activeView === "settings");
  els.menuBtn.classList.toggle("is-active", activeView === "settings");
  els.appEyebrow.textContent = {
    budget: "Իմ բյուջեն",
    tasks: "Իմ ժամանակը",
    debts: "Պարտքերից ազատում",
    months: "Ամսական պատմություն",
    settings: "Կարգավորումներ",
  }[activeView];
}

function renderBudget() {
  const currentBudget = getBudgetForMonth(getMonthKey(new Date()));
  const fixedTotal = sum(currentBudget.fixedExpenses);
  const monthExpenses = sum(filterByPeriod("month"));
  const monthDebtPaid = sum(filterDebtPayments("month"));
  const monthSpent = monthExpenses + monthDebtPaid;
  const base = currentBudget.salary - fixedTotal;
  const free = base - monthSpent;
  const usage = base > 0 ? Math.round(monthSpent / base * 100) : 0;
  const daysLeft = getDaysUntilNextSalary();
  const dailyLimit = Math.max(0, Math.floor(free / daysLeft));

  els.freeMoney.textContent = formatMoney(free);
  els.budgetHint.textContent = `Ֆիքսված՝ ${formatMoney(fixedTotal)} · Ծախսեր՝ ${formatMoney(monthExpenses)} · Պարտքեր՝ ${formatMoney(monthDebtPaid)}`;
  const noBudget = base <= 0 && free < 0;
  els.budgetPercent.textContent = noBudget ? "Պակասուրդ" : `${usage}%`;
  els.budgetMeter.style.strokeDashoffset = String(327 * (1 - (noBudget ? 1 : Math.min(usage, 100) / 100)));
  els.periodLabel.textContent = getPeriodLabel();
  els.periodTotal.textContent = formatMoney(sum(filterByPeriod(activePeriod)) + sum(filterDebtPayments(activePeriod)));
  els.dailyLimit.textContent = formatMoney(dailyLimit);
  els.daysLeft.textContent = String(daysLeft);
}

function renderDebts() {
  const settings = state.debtSettings || { strategy: "smart", safetyReserve: 0 };
  els.debtStrategy.value = settings.strategy;
  if (document.activeElement !== els.debtSafetyReserve) els.debtSafetyReserve.value = String(settings.safetyReserve || 0);
  const inputs = debtPlanInputs();
  const result = KhnayikDebt.analyze({
    debts: state.debts,
    available: inputs.available,
    recurringAvailable: inputs.recurringAvailable,
    strategy: settings.strategy,
  });
  els.totalDebt.textContent = formatMoney(result.totalBalance);
  els.debtCapacity.textContent = formatMoney(result.current.capacity);
  els.debtMinimums.textContent = formatMoney(result.current.minimumTotal);
  els.debtInterest.textContent = result.selected.possible ? formatMoney(result.selected.interest) : "—";
  els.debtFreeDate.textContent = result.selected.possible && result.selected.debtFreeDate
    ? new Intl.DateTimeFormat("hy-AM", { month: "long", year: "numeric" }).format(result.selected.debtFreeDate)
    : result.items.length ? "Տվյալները բավարար չեն" : "—";
  els.debtReserveNote.textContent = settings.safetyReserve
    ? `Յուրաքանչյուր ամիս պաշտպանվում է ${formatMoney(settings.safetyReserve)}։`
    : `Ավտոմատ պաշտպանված գումար՝ ${formatMoney(inputs.protectedNow)} այս ամսվա մնացած մասի համար։`;

  els.debtPaymentPlan.innerHTML = "";
  els.debtRecommendation.classList.toggle("is-warning", Boolean(result.current.shortfall));
  if (!result.items.length) {
    els.debtPlanSummary.textContent = "Ավելացրեք պարտքերը՝ անհատական պլան ստանալու համար։";
    els.debtRecommendation.textContent = "Խնայիկը կհամեմատի տոկոսները, նվազագույն վճարները և արագ փակվող պարտքերը։";
  } else if (result.current.shortfall) {
    els.debtPlanSummary.textContent = "Այս ամսվա ազատ գումարը չի ծածկում բոլոր նվազագույն վճարները։";
    els.debtRecommendation.textContent = `Պակասում է ${formatMoney(result.current.shortfall)}։ Մի ուշացրեք՝ կապվեք պարտատիրոջ հետ և խնդրեք կառավարելի վճարման պլան։`;
  } else {
    const targetPayment = result.current.payments.find((payment) => payment.debt.id === result.current.targetId)?.amount || 0;
    els.debtPlanSummary.textContent = result.selected.possible
      ? `${result.selected.months} ամսվա գնահատական · ընդհանուր տոկոս՝ ${formatMoney(result.selected.interest)}`
      : "Մեծացրեք պաշտպանված գումարից հետո հասանելի վճարումը՝ մարման ամսաթիվ ստանալու համար։";
    els.debtRecommendation.textContent = result.target
      ? `Այս ամսվա գլխավոր նպատակը՝ «${result.target.title}»։ Առաջարկվող վճարում՝ ${formatMoney(targetPayment)}։`
      : "Բոլոր պարտքերը փակված են։";
  }
  for (const payment of result.current.payments) {
    const line = document.createElement("div");
    line.className = "debt-plan-line" + (payment.debt.id === result.current.targetId ? " is-target" : "");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = payment.debt.title;
    const detail = document.createElement("span");
    detail.textContent = payment.debt.id === result.current.targetId ? "Գլխավոր նպատակ" : "Նվազագույն վճար";
    copy.append(title, detail);
    const amount = document.createElement("b");
    amount.textContent = formatMoney(payment.amount);
    line.append(copy, amount);
    els.debtPaymentPlan.append(line);
  }
  renderDebtList();
}

function debtPlanInputs() {
  const budget = getBudgetForMonth(getMonthKey(new Date()));
  const salary = Number(budget.salary || 0);
  const fixed = sum(budget.fixedExpenses);
  const spent = sum(filterByPeriod("month"));
  const debtPaid = sum(filterDebtPayments("month"));
  const averageLiving = averageMonthlyExpenses();
  const configured = Number(state.debtSettings?.safetyReserve || 0);
  const protectedNow = configured || Math.round(Math.max(0, averageLiving - spent) + salary * 0.05);
  const protectedRecurring = configured || Math.round(averageLiving + salary * 0.05);
  return {
    protectedNow,
    available: Math.max(0, salary - fixed - spent - debtPaid - protectedNow),
    recurringAvailable: Math.max(0, salary - fixed - protectedRecurring),
  };
}

function averageMonthlyExpenses() {
  const totals = new Map();
  for (const expense of state.expenses) {
    const key = getMonthKey(new Date(expense.createdAt));
    totals.set(key, (totals.get(key) || 0) + Number(expense.amount || 0));
  }
  const current = getMonthKey(new Date());
  const completed = [...totals.entries()].filter(([key]) => key < current).sort(([a],[b]) => b.localeCompare(a)).slice(0,3);
  if (completed.length) return Math.round(completed.reduce((sum,[,value]) => sum + value, 0) / completed.length);
  return totals.get(current) || 0;
}

function renderDebtList() {
  els.debtList.innerHTML = "";
  const activeCount = state.debts.filter((debt) => debt.balance > 0).length;
  els.debtCount.textContent = activeCount ? `${activeCount} ակտիվ պարտք` : state.debts.length ? "Բոլոր պարտքերը փակված են" : "Դեռ պարտք չկա";
  if (!state.debts.length) {
    els.debtList.innerHTML = `<div class="empty-state">Ավելացրեք առաջին պարտքը՝ մարման պլանը տեսնելու համար։</div>`;
    return;
  }
  const typeNames = { card:"Վարկային քարտ", loan:"Վարկ", personal:"Անձնական", tax:"Հարկային", other:"Այլ" };
  for (const debt of [...state.debts].sort((a,b) => Number(a.balance === 0) - Number(b.balance === 0))) {
    const row = document.createElement("article");
    row.className = "debt-item" + (debt.balance === 0 ? " is-closed" : "");
    const head = document.createElement("div");
    head.className = "debt-item-head";
    const title = document.createElement("strong");
    title.textContent = debt.title;
    const balance = document.createElement("b");
    balance.textContent = debt.balance === 0 ? "Փակված" : formatMoney(debt.balance);
    head.append(title,balance);
    const meta = document.createElement("div");
    meta.className = "debt-item-meta";
    meta.textContent = `${typeNames[debt.type] || "Այլ"} · ${debt.annualRate}% տարեկան · նվազագույնը ${formatMoney(debt.minimumPayment)} · օրը՝ ${debt.dueDay}${debt.pastDue ? " · ՈՒՇԱՑԱԾ" : ""}`;
    const progress = document.createElement("div");
    progress.className = "debt-item-progress";
    const bar = document.createElement("i");
    const paidPercent = debt.originalBalance > 0 ? Math.round((1 - debt.balance / debt.originalBalance) * 100) : 100;
    bar.style.width = `${Math.max(0, Math.min(100, paidPercent))}%`;
    progress.append(bar);
    const actions = document.createElement("div");
    actions.className = "debt-item-actions";
    if (debt.balance > 0) actions.append(debtPaymentForm(debt));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Խմբագրել";
    edit.addEventListener("click", () => editDebt(debt.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Ջնջել";
    remove.addEventListener("click", () => deleteDebt(debt.id));
    actions.append(edit, remove);
    row.append(head,meta,progress,actions);
    els.debtList.append(row);
  }
}

function debtPaymentForm(debt) {
  const form = document.createElement("form");
  form.className = "debt-pay-form";
  const input = document.createElement("input");
  input.inputMode = "numeric";
  input.placeholder = "վճարված գումար";
  input.setAttribute("aria-label", `«${debt.title}» պարտքի վճարված գումար`);
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Գրանցել վճարում";
  form.append(input,button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    registerDebtPayment(debt.id, input.value);
  });
  return form;
}

function registerDebtPayment(debtId, value) {
  const debt = state.debts.find((item) => item.id === debtId);
  const amount = parseAmount(value, "Պարտքի վճարում");
  if (!debt || amount === null) return;
  if (amount > debt.balance) return showMessage("Վճարումը չի կարող գերազանցել պարտքի մնացորդը։");
  debt.balance -= amount;
  debt.paidTotal += amount;
  debt.pastDue = false;
  debt.closedAt = debt.balance === 0 ? new Date().toISOString() : "";
  state.debtPayments.unshift({
    id: crypto.randomUUID(), debtId: debt.id, title: debt.title,
    amount, createdAt: new Date().toISOString(),
  });
  if (saveState() === false) return;
  render();
  tg?.HapticFeedback?.notificationOccurred?.("success");
}

function rollbackDebtPayment(paymentId) {
  const index = state.debtPayments.findIndex((payment) => payment.id === paymentId);
  if (index === -1) return;
  const payment = state.debtPayments[index];
  const debt = state.debts.find((item) => item.id === payment.debtId);
  if (!debt) return showMessage("Այս վճարման պարտքն այլևս չկա, ուստի այն հնարավոր չէ ավտոմատ չեղարկել։");
  if (!window.confirm(`Չեղարկե՞լ «${payment.title}» պարտքի ${formatMoney(payment.amount)} վճարումը։`)) return;
  debt.balance += Number(payment.amount || 0);
  debt.originalBalance = Math.max(debt.originalBalance, debt.balance);
  debt.paidTotal = Math.max(0, debt.paidTotal - Number(payment.amount || 0));
  debt.closedAt = "";
  state.debtPayments.splice(index, 1);
  if (saveState() === false) return;
  render();
}

function deleteDebt(debtId) {
  const debt = state.debts.find((item) => item.id === debtId);
  if (!debt) return;
  const payments = state.debtPayments.filter((payment) => payment.debtId === debtId);
  const historyNote = payments.length ? ` և դրա ${payments.length} վճարման գրառում${payments.length === 1 ? "ը" : "ները"}` : "";
  if (!window.confirm(`Ջնջե՞լ «${debt.title}» պարտքը${historyNote}։`)) return;
  state.debts = state.debts.filter((item) => item.id !== debtId);
  state.debtPayments = state.debtPayments.filter((payment) => payment.debtId !== debtId);
  if (saveState() === false) return;
  render();
}

function editDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  editingDebtId = id;
  els.debtName.value = debt.title;
  els.debtType.value = debt.type;
  els.debtBalance.value = String(debt.balance);
  els.debtRate.value = String(debt.annualRate);
  els.debtMinimum.value = String(debt.minimumPayment);
  els.debtDueDay.value = String(debt.dueDay);
  els.debtLateFee.value = String(debt.lateFee);
  els.debtPastDue.checked = debt.pastDue;
  els.debtReminder.checked = debt.reminder;
  els.debtFormTitle.textContent = "Խմբագրել պարտքը";
  els.debtSubmit.textContent = "Պահպանել փոփոխությունները";
  els.cancelDebtEdit.hidden = false;
  activeView = "debts";
  renderView();
  els.debtName.focus();
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
    const remove = row.querySelector("button");
    remove.setAttribute("aria-label", `Ջնջել ֆիքսված ծախսը՝ ${item.title}`);
    remove.addEventListener("click", () => deleteRecord("fixedExpenses", item.id));
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
    const remove = node.querySelector("button");
    remove.setAttribute("aria-label", `Ջնջել «${expense.title}» ծախսը`);
    remove.addEventListener("click", () => deleteRecord("expenses", expense.id));
    els.expenseList.append(node);
  });
}

function resetExpenseForm() {
  editingExpenseId = "";
  els.expenseForm.reset();
  els.expenseDate.value = getDateKey(new Date());
  els.expenseSubmit.textContent = "Պահպանել ծախսը";
  els.cancelExpenseEdit.hidden = true;
}

function editExpense(id) {
  const item = state.expenses.find((expense) => expense.id === id);
  if (!item) return;
  editingExpenseId = id;
  els.expenseTitle.value = item.title;
  els.expenseAmount.value = item.amount;
  els.expenseCategory.value = item.category;
  els.expenseDate.value = getDateKey(new Date(item.createdAt));
  els.expenseSubmit.textContent = "Պահպանել փոփոխությունները";
  els.cancelExpenseEdit.hidden = false;
  activeView = "budget";
  accordionState.addExpense = true;
  renderView();
  renderAccordions();
  els.expenseTitle.focus();
}

function expenseTimestamp(day, original) {
  const time = original ? new Date(original) : new Date();
  const chosen = new Date(`${day}T12:00`);
  if (!Number.isFinite(chosen.getTime()) || getDateKey(chosen) !== day || day > getDateKey(new Date())) return null;
  if (day === getDateKey(time)) return time.toISOString();
  chosen.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
  return chosen.toISOString();
}

function scheduleRollover() {
  window.clearTimeout(rolloverTimer);
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 50);
  rolloverTimer = window.setTimeout(refreshCalendar, Math.max(100, midnight - Date.now()));
}

function refreshCalendar() {
  const today = getDateKey(new Date());
  if (displayedDay !== today) {
    if (!editingExpenseId && els.expenseDate.value === displayedDay) els.expenseDate.value = today;
    displayedDay = today;
    els.expenseDate.max = today;
    if ((!CLOUD_MODE || isCloudReady) && !state.monthlyBudgets[getMonthKey(new Date())]) {
      ensureCurrentMonthBudget();
      saveState();
    }
    render();
  }
  scheduleRollover();
}

function renderMonthlySummary() {
  els.monthList.innerHTML = "";
  els.allMonthsTotal.textContent = formatMoney(sum(state.expenses) + sum(state.debtPayments));

  const months = getMonthOptions();
  if (!months.length) {
    els.monthList.innerHTML = `<div class="empty-state">Ամսական պատմություն դեռ չկա</div>`;
    els.monthSelect.innerHTML = "";
    return;
  }

  if (!months.some((month) => month.key === selectedMonthKey)) selectedMonthKey = getMonthKey(new Date());

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
    button.setAttribute("aria-pressed", String(button.dataset.monthMode === activeMonthMode));
  });

  if (activeMonthMode === "expenses") renderMonthExpenses(selectedMonthKey);
  else renderMonthTasks(selectedMonthKey);
}

function renderMonthExpenses(monthKey) {
  const expenses = state.expenses.filter((expense) => getMonthKey(new Date(expense.createdAt)) === monthKey);
  const debtPayments = state.debtPayments.filter((payment) => getMonthKey(new Date(payment.createdAt)) === monthKey);
  const budget = getBudgetForMonth(monthKey);
  const fixedTotal = sum(budget.fixedExpenses);
  const spent = sum(expenses);
  const debtPaid = sum(debtPayments);
  const salaryLabel = budget.salaryMode === "fixed"
    ? `Աշխատավարձ (${budget.salaryDay || state.salaryDay}-ին)` : "Աշխատավարձ";
  const salaryValue = budget.salaryMode === "variable" && budget.salaryConfirmed === false
    ? "Չի մուտքագրվել" : formatMoney(budget.salary);
  addMonthTotalRow(salaryLabel, salaryValue);
  addMonthTotalRow("Ֆիքսված ծախսեր", formatMoney(fixedTotal));
  addMonthTotalRow("Առօրյա ծախսեր", formatMoney(spent));
  addMonthTotalRow("Պարտքերի վճարումներ", formatMoney(debtPaid));
  addMonthTotalRow("Ազատ մնացորդ", formatMoney(budget.salary - fixedTotal - spent - debtPaid));
  if (!expenses.length && !debtPayments.length) return;

  const max = Math.max(...expenses.map((expense) => Number(expense.amount || 0)), ...debtPayments.map((payment) => Number(payment.amount || 0)), 1);
  expenses.forEach((expense) => {
    const row = document.createElement("article");
    row.className = "month-item";
    row.innerHTML = `<div class="month-line"><strong></strong><span></span></div><small></small><div class="month-bar"><i></i></div>`;
    row.querySelector("strong").textContent = expense.title;
    row.querySelector("span").textContent = formatMoney(expense.amount);
    row.querySelector("small").textContent = `${expense.category} · ${formatDate(expense.createdAt)}`;
    row.querySelector("i").style.width = `${Math.max((expense.amount / max) * 100, 8)}%`;
    const actions = document.createElement("div");
    actions.className = "month-actions";
    for (const [label, handler] of [["Խմբագրել", () => editExpense(expense.id)], ["Ջնջել", () => deleteRecord("expenses", expense.id)]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button compact";
      button.textContent = label;
      button.setAttribute("aria-label", `${label} «${expense.title}» ծախսը`);
      button.addEventListener("click", handler);
      actions.append(button);
    }
    row.append(actions);
    els.monthList.append(row);
  });
  debtPayments.forEach((payment) => {
    const row = document.createElement("article");
    row.className = "month-item";
    row.innerHTML = `<div class="month-line"><strong></strong><span></span></div><small></small><div class="month-bar"><i></i></div>`;
    row.querySelector("strong").textContent = `Պարտք՝ ${payment.title}`;
    row.querySelector("span").textContent = formatMoney(payment.amount);
    row.querySelector("small").textContent = `Պարտքի մարում · ${formatDate(payment.createdAt)}`;
    row.querySelector("i").style.width = `${Math.max((payment.amount / max) * 100, 8)}%`;
    const actions = document.createElement("div");
    actions.className = "month-actions";
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "secondary-button compact";
    undo.textContent = "Չեղարկել վճարումը";
    undo.addEventListener("click", () => rollbackDebtPayment(payment.id));
    actions.append(undo);
    row.append(actions);
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
  document.getElementById("reminderChannelSetting").hidden = !CLOUD_MODE;
  document.getElementById("reminderChannel").value = reminderChannel();
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
    checkbox.setAttribute("aria-label", `Նշել կատարված՝ ${task.title}`);
    checkbox.checked = isTaskDone(task);
    checkbox.addEventListener("change", () => toggleTaskDone(task, checkbox.checked));
    row.querySelector(".task-info strong").textContent = task.title;
    row.querySelector(".task-info small").textContent = getTaskMeta(task);

    const reminderBtn = row.querySelector(".reminder-chip");
    reminderBtn.textContent = task.reminder ? "Հիշեցում կա" : "Առանց հիշեցման";
    reminderBtn.classList.toggle("is-off", !task.reminder);
    reminderBtn.setAttribute("aria-pressed", String(task.reminder));
    reminderBtn.setAttribute("aria-label", `Հիշեցնել՝ ${task.title}`);
    reminderBtn.addEventListener("click", () => toggleTaskReminder(task));
    const remove = row.querySelector(".delete-task");
    remove.setAttribute("aria-label", `Ջնջել գործը՝ ${task.title}`);
    remove.addEventListener("click", () => deleteTask(task));
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
  if (text) syncDescription = text;
  els.syncStatus.textContent = CLOUD_MODE
    ? syncDescription || "Բեռնվում են հաշվի տվյալները"
    : "Նախադիտում․ պահվում է միայն այս սարքում";
}

function scheduleCloudSync(delay = 200) {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncFromCloud, delay);
}

function applyCloudView() {
  const current = changeJournal.entries().reduce((view, entry) => KhnayikSync.apply(view, entry.patch), cloudBase);
  const changed = JSON.stringify(state) !== JSON.stringify(current);
  Object.assign(state, normalizeState(current));
  durableView = KhnayikSync.copy(state);
  if (changed) render();
}

async function syncFromCloud() {
  if (!CLOUD_MODE || syncBusy) return;
  syncBusy = true;
  try {
    const data = await api("/api/state" + (isCloudReady ? "?since=" + encodeURIComponent(lastCloudUpdatedAt) : ""));
    updateReminderLink(data.telegramLinked);
    if (!isCloudReady) {
      changeJournal = KhnayikSync.journal(localStorage, session.userId);
      // Read the durable journal before unlocking the forms. A failed read must not permit an overwrite.
      changeJournal.entries();
      if (!data.state) throw new Error("Սերվերը չվերադարձրեց հաշվի տվյալները");
      cloudBase = normalizeState(data.state);
      lastCloudUpdatedAt = data.updatedAt;
      applyCloudView();
      isCloudReady = true;
      document.querySelectorAll(".app-view").forEach((view) => { view.inert = false; });
      if (!state.monthlyBudgets[getMonthKey(new Date())]) {
        ensureCurrentMonthBudget();
        saveState();
      }
      render();
    } else if (data.state) {
      cloudBase = normalizeState(data.state);
      lastCloudUpdatedAt = data.updatedAt;
      applyCloudView();
    }

    for (let count = 0; count < 10; count++) {
      const [entry] = changeJournal.entries();
      if (!entry) break;
      renderSyncStatus("Փոփոխությունները պահվում են սերվերում");
      const next = KhnayikSync.apply(cloudBase, entry.patch);
      let saved;
      try {
        saved = await api("/api/state", {method: "PUT", body: JSON.stringify({
          state: next, lastKnownUpdatedAt: lastCloudUpdatedAt, mutationId: entry.id,
        })});
      } catch (error) {
        if (error.status !== 409 || !error.data?.state) throw error;
        cloudBase = normalizeState(error.data.state);
        lastCloudUpdatedAt = error.data.updatedAt;
        applyCloudView();
        continue;
      }
      cloudBase = saved.state ? normalizeState(saved.state) : next;
      lastCloudUpdatedAt = saved.updatedAt;
      changeJournal.remove(entry);
      applyCloudView();
    }
    if (changeJournal.entries().length) {
      renderSyncStatus("Փոփոխությունները սպասում են համաժամացման");
      scheduleCloudSync(1000);
    } else renderSyncStatus("Սերվերի տվյալները համաժամացված են");
  } catch (error) {
    const hasQueue = isCloudReady && changeJournal;
    const reason = error.status === 401 ? "Նորից բացեք հավելվածը Telegram-ից" : error.message;
    renderSyncStatus(hasQueue ? "Կապի սխալ․ տեղում պահված փոփոխությունները կուղարկվեն կապը վերականգնելիս։ " + reason : "Չհաջողվեց բեռնել տվյալները։ " + reason);
    if (error.status !== 401) scheduleCloudSync(10000);
  } finally {
    syncBusy = false;
  }
}

async function api(path, options = {}) {
  async function request(route, init) {
    const response = await fetch(API_BASE + route, { ...init, cache: "no-store", redirect: "error" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      const error = new Error(data?.error || "Տվյալների ծառայությունը հասանելի չէ (" + response.status + ")");
      Object.assign(error, { status: response.status, data });
      throw error;
    }
    return data;
  }
  if (!session || session.expires <= Date.now()) {
    sessionRequest ||= request("/api/session", {method:"POST", headers:{"X-Telegram-Init-Data":getInitData()}})
      .finally(() => { sessionRequest = null; });
    session = await sessionRequest;
    if (!session.userId || !session.token) throw new Error("Մուտքի տվյալները թերի են");
  }
  return request(path, {...options, headers: {
    ...(options.body ? {"Content-Type":"application/json"} : {}),
    Authorization:"Bearer " + session.token,
  }});
}

function saveState() {
  if (CLOUD_MODE && !isCloudReady) {
    Object.assign(state, KhnayikSync.copy(durableView));
    renderSyncStatus("Սպասեք հաշվի տվյալների բեռնմանը");
    return false;
  }
  ensureCurrentMonthBudget();
  try {
    if (CLOUD_MODE) {
      const patch = KhnayikSync.diff(durableView, state);
      if (patch) changeJournal.add(patch);
      scheduleCloudSync();
      renderSyncStatus("Պահված է սարքում․ սպասում է սերվերին");
    } else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    durableView = KhnayikSync.copy(state);
    return true;
  } catch {
    Object.assign(state, KhnayikSync.copy(durableView));
    showMessage("Սարքում չհաջողվեց պահպանել փոփոխությունը։ Ազատեք տարածք և կրկին փորձեք։");
    return false;
  }
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
  const salaryMode = value.salaryMode === "variable" ? "variable" : "fixed";
  const salaryDay = Number.isInteger(Number(value.salaryDay)) && Number(value.salaryDay) >= 1 && Number(value.salaryDay) <= 31
    ? Number(value.salaryDay) : 1;
  const debts = (Array.isArray(value.debts) ? value.debts : []).map((item) => {
    const balance = Math.max(0, Math.round(Number(item.balance) || 0));
    const paidTotal = Math.max(0, Math.round(Number(item.paidTotal) || 0));
    return {
      ...item,
      balance,
      originalBalance: Math.max(balance, paidTotal + balance, Math.round(Number(item.originalBalance) || 0)),
      annualRate: Math.max(0, Number(item.annualRate) || 0),
      minimumPayment: Math.max(0, Math.round(Number(item.minimumPayment) || 0)),
      dueDay: Math.min(31, Math.max(1, Math.round(Number(item.dueDay) || 1))),
      lateFee: Math.max(0, Math.round(Number(item.lateFee) || 0)),
      paidTotal,
      type: ["card", "loan", "personal", "tax", "other"].includes(item.type) ? item.type : "other",
      pastDue: Boolean(item.pastDue),
      reminder: item.reminder !== false,
      createdAt: item.createdAt || new Date().toISOString(),
      closedAt: item.closedAt || "",
    };
  });
  const debtSettings = value.debtSettings && typeof value.debtSettings === "object" ? value.debtSettings : {};
  return {
    salary: Math.max(0, Number(value.salary || 0)),
    salaryMode,
    salaryDay,
    fixedExpenses: Array.isArray(value.fixedExpenses) ? value.fixedExpenses : [],
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    recurringTasks: Array.isArray(value.recurringTasks) ? value.recurringTasks : [],
    scheduledTasks: Array.isArray(value.scheduledTasks) ? value.scheduledTasks : [],
    debts,
    debtPayments: Array.isArray(value.debtPayments) ? value.debtPayments : [],
    debtSettings: {
      strategy: ["smart", "avalanche", "snowball"].includes(debtSettings.strategy) ? debtSettings.strategy : "smart",
      safetyReserve: Math.max(0, Math.round(Number(debtSettings.safetyReserve) || 0)),
    },
    monthlyBudgets: value.monthlyBudgets && typeof value.monthlyBudgets === "object" ? value.monthlyBudgets : {},
    notified: value.notified && typeof value.notified === "object" ? value.notified : {},
    appearance: value.appearance && typeof value.appearance === "object" ? value.appearance : {},
  };
}

function ensureCurrentMonthBudget() {
  const key = getMonthKey(new Date());
  const current = state.monthlyBudgets[key];
  if (current) {
    if (state.salaryMode === "variable") state.salary = Number(current.salary || 0);
    return;
  }
  if (state.salaryMode === "variable") state.salary = 0;
  updateCurrentMonthBudget(state.salaryMode === "fixed");
}

function updateCurrentMonthBudget(confirmSalary = false) {
  const key = getMonthKey(new Date());
  const previous = state.monthlyBudgets[key];
  const salaryConfirmed = state.salaryMode === "fixed" || confirmSalary || previous?.salaryConfirmed === true;
  state.monthlyBudgets[key] = {
    salary: salaryConfirmed ? Number(state.salary || 0) : 0,
    salaryMode: state.salaryMode,
    salaryDay: state.salaryDay,
    salaryConfirmed,
    fixedExpenses: state.fixedExpenses.map((item) => ({ ...item })),
    savedAt: new Date().toISOString(),
  };
}

function getBudgetForMonth(monthKey) {
  if (state.monthlyBudgets[monthKey]) return state.monthlyBudgets[monthKey];
  if (state.salaryMode === "variable") return {
    salary: 0, salaryMode: "variable", salaryDay: state.salaryDay,
    salaryConfirmed: false, fixedExpenses: state.fixedExpenses,
  };
  if (monthKey === getMonthKey(new Date())) return {
    salary: state.salary, salaryMode: "fixed", salaryDay: state.salaryDay,
    salaryConfirmed: true, fixedExpenses: state.fixedExpenses,
  };
  const earlier = Object.keys(state.monthlyBudgets).filter((key) => key < monthKey).sort().pop();
  return state.monthlyBudgets[earlier] || {
    salary: state.salary, salaryMode: "fixed", salaryDay: state.salaryDay,
    salaryConfirmed: true, fixedExpenses: state.fixedExpenses,
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

function expenseRows() {
  return [
    ["Անուն", "Գումար", "Կատեգորիա", "Ամսաթիվ"],
    ...state.expenses.map((item) => [item.title, item.amount, item.category, new Date(item.createdAt)]),
  ];
}

function exportCsv() {
  const rows = expenseRows().map((row) => row.map((value) => {
    if (!(value instanceof Date)) return value;
    const offset = -value.getTimezoneOffset();
    const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const mm = String(Math.abs(offset) % 60).padStart(2, "0");
    const local = new Date(value.getTime() + offset * 60000).toISOString().slice(0, 19);
    return `${local}${offset < 0 ? "-" : "+"}${hh}:${mm}`;
  }));
  downloadBlob(KhnayikExport.csv(rows), `khnayik-expenses-${getDateKey(new Date())}.csv`);
  els.excelNote.textContent = "Ծախսերի CSV ֆայլը պատրաստ է։";
}

function exportExcel() {
  const monthlySpent = new Map();
  const monthlyDebtPaid = new Map();
  for (const item of state.expenses) {
    const key = getMonthKey(new Date(item.createdAt));
    monthlySpent.set(key, (monthlySpent.get(key) || 0) + Number(item.amount));
  }
  for (const item of state.debtPayments) {
    const key = getMonthKey(new Date(item.createdAt));
    monthlyDebtPaid.set(key, (monthlyDebtPaid.get(key) || 0) + Number(item.amount));
  }
  const months = getMonthOptions().map(({ key }) => {
    const budget = getBudgetForMonth(key);
    const fixed = sum(budget.fixedExpenses);
    const spent = monthlySpent.get(key) || 0;
    const debtPaid = monthlyDebtPaid.get(key) || 0;
    return [key, budget.salary, fixed, spent, debtPaid, budget.salary - fixed - spent - debtPaid];
  });
  const tasks = [
    ["Անուն", "Տեսակ", "Ժամ", "Հիշեցում"],
    ...state.scheduledTasks.map((task) => [task.title, "Մեկանգամյա", new Date(`${task.date}T${task.time}`), task.reminder ? "Այո" : "Ոչ"]),
    ...state.recurringTasks.map((task) => [task.title, "Կրկնվող", `${formatDays(task.days)} ${task.time}`, task.reminder ? "Այո" : "Ոչ"]),
  ];
  const tables = [
    { name: "Ծախսեր", rows: expenseRows() },
    { name: "Պարտքեր", rows: [["Անուն", "Մնացորդ", "Տարեկան տոկոս", "Նվազագույն վճար", "Վճարման օր", "Կարգավիճակ"],
      ...state.debts.map((debt) => [debt.title, debt.balance, debt.annualRate, debt.minimumPayment, debt.dueDay, debt.balance ? "Ակտիվ" : "Փակված"])] },
    { name: "Պարտքի վճարումներ", rows: [["Պարտք", "Գումար", "Ամսաթիվ"],
      ...state.debtPayments.map((payment) => [payment.title, payment.amount, new Date(payment.createdAt)])] },
    { name: "Գործեր", rows: tasks },
    { name: "Ամիսներ", rows: [["Ամիս", "Աշխատավարձ", "Ֆիքսված", "Ծախս", "Պարտքի վճարում", "Մնացորդ"], ...months] },
  ];
  downloadBlob(KhnayikExport.workbook(tables), `khnayik-${getDateKey(new Date())}.xlsx`);
  els.excelNote.textContent = "Excel ֆայլը պատրաստ է։";
}

function reminderChannel() {
  return CLOUD_MODE ? (state.appearance.reminderChannel || "telegram") : "device";
}

function checkReminders() {
  const now = Date.now();
  const from = Math.max(lastDeviceReminderCheck, now - 86400000);
  lastDeviceReminderCheck = now;
  if (reminderChannel() === "telegram") return;
  let changed = false;
  const defaultZone = CLOUD_MODE ? "Asia/Yerevan" : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const debtReminders = state.debts.filter((debt) => debt.balance > 0).map((debt) => ({
    ...debt,
    title: `Պարտքի վճարման օր՝ ${debt.title}`,
    time: "09:00",
    leadMinutes: 1440,
  }));
  for (const [type, tasks] of [["scheduled", state.scheduledTasks], ["recurring", state.recurringTasks], ["debt", debtReminders]]) {
    for (const task of tasks) {
      let occurrence = KhnayikReminderTime.next(task, type, from, defaultZone);
      while (occurrence && occurrence.at <= now) {
        if (!state.notified[occurrence.key]) {
          notifyTask(task.title, type === "debt" ? "Պարտքի հիշեցում" : "Գործի հիշեցում");
          state.notified[occurrence.key] = true;
          changed = true;
        }
        occurrence = KhnayikReminderTime.next(task, type, occurrence.at + 1, defaultZone);
      }
    }
  }
  if (changed) saveState();
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
  deleteRecord(task.type === "scheduled" ? "scheduledTasks" : "recurringTasks", task.id);
}

function deleteRecord(key, id) {
  const list = state[key];
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return;
  const item = list[index];
  list.splice(index, 1);
  if (key === "fixedExpenses") updateCurrentMonthBudget();
  if (saveState() === false) return;
  render();
  offerUndo(key, item, index);
}

const deletedRecords = [];
let undoTimer;
function offerUndo(key, item, index) {
  deletedRecords.push({key, item, index});
  const bar = document.getElementById("undoBar");
  const message = document.getElementById("undoMessage");
  const button = document.getElementById("undoButton");
  const dismiss = () => {
    deletedRecords.length = 0;
    bar.hidden = true;
  };
  const refresh = () => {
    clearTimeout(undoTimer);
    if (!deletedRecords.length) return dismiss();
    message.textContent = `Ջնջվեց «${deletedRecords.at(-1).item.title}»։`;
    bar.hidden = false;
    undoTimer = setTimeout(dismiss, 20000);
  };
  button.onclick = () => {
    const deleted = deletedRecords.at(-1);
    if (!deleted) return;
    const records = state[deleted.key];
    if (!records.some((entry) => entry.id === deleted.item.id)) {
      records.splice(Math.min(deleted.index, records.length), 0, deleted.item);
      if (deleted.key === "fixedExpenses") updateCurrentMonthBudget();
      if (saveState() === false) return;
    }
    deletedRecords.pop();
    render();
    refresh();
  };
  refresh();
}

function getMonthOptions() {
  const now = new Date();
  const months = new Set([getMonthKey(now), ...Object.keys(state.monthlyBudgets)]);
  for (const item of state.expenses) months.add(getMonthKey(new Date(item.createdAt)));
  for (const item of state.debtPayments) months.add(getMonthKey(new Date(item.createdAt)));
  for (const task of state.scheduledTasks) months.add(task.date.slice(0, 7));
  // The recurrence has no end date. Include its past months, this month and next month's plan.
  const horizon = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12);
  let firstRecurringMonth = null;
  for (const task of state.recurringTasks) {
    const firstDay = new Date(task.createdAt || now);
    for (let offset = 0; offset < 7; offset++) {
      if (task.days.includes(firstDay.getDay())) {
        const month = getMonthKey(firstDay);
        if (firstRecurringMonth === null || month < firstRecurringMonth) firstRecurringMonth = month;
        break;
      }
      firstDay.setDate(firstDay.getDate() + 1);
    }
    for (const day of task.doneDates || []) months.add(day.slice(0, 7));
  }
  if (firstRecurringMonth) {
    const cursor = new Date(`${firstRecurringMonth}-01T12:00`);
    while (cursor <= horizon) {
      months.add(getMonthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const formatter = new Intl.DateTimeFormat("hy-AM", { month: "long", year: "numeric" });
  return [...months].sort().reverse().map((key) => ({ key, label: formatter.format(new Date(`${key}-01T12:00`)) }));
}

function getTasksForMonth(monthKey) {
  const scheduled = state.scheduledTasks
    .filter((task) => task.date.startsWith(monthKey))
    .map((task) => ({ date: task.date, title: task.title, done: task.done, meta: `${formatTaskDate(task.date)} ${task.time}${getReminderText(task)}` }));
  const items = [...scheduled];
  for (const task of state.recurringTasks) {
    const start = getDateKey(new Date(task.createdAt || Date.now()));
    const done = new Set(task.doneDates || []);
    const date = new Date(`${monthKey}-01T12:00`);
    while (getMonthKey(date) === monthKey) {
      const day = getDateKey(date);
      if (done.has(day) || (day >= start && task.days.includes(date.getDay()))) {
        items.push({ date: day, title: task.title, done: done.has(day), meta: `${formatTaskDate(day)} ${task.time}${getReminderText(task)}` });
      }
      date.setDate(date.getDate() + 1);
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
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

function updateReminderLink(linked) {
  if (typeof linked !== "boolean") return;
  telegramRemindersLinked = linked;
  if (els.allowNotificationsBtn) els.allowNotificationsBtn.textContent = getNotificationButtonText();
}

async function requestNotifications() {
  const channel = reminderChannel();
  try {
    if (channel !== "telegram") {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (channel === "device" && (!("Notification" in window) || Notification.permission !== "granted")) {
        showMessage("Այս սարքում համակարգային ծանուցումներն անջատված են։ Բաց հավելվածում հիշեցումը կերևա էկրանին։");
      }
    }
    if (channel !== "device") {
      if (!telegramRemindersLinked && tg?.isVersionAtLeast?.("6.9") && tg.requestWriteAccess) {
        await new Promise(resolve => tg.requestWriteAccess(resolve));
      }
      const result = await api("/api/reminder-access", { method: "POST" });
      updateReminderLink(result.telegramLinked);
      if (!result.telegramLinked) showMessage("Բացեք բոտի անձնական զրույցը և ուղարկեք /start։ Հետո վերադարձեք ու կրկին սեղմեք այս կոճակը։");
    }
  } catch {
    showMessage("Չհաջողվեց ստուգել հիշեցումների կապը։ Կրկին փորձեք։");
  }
  renderTasks();
}

function maybeRequestNotifications(enabled) {
  if (enabled && reminderChannel() !== "telegram" && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(renderTasks).catch(() => {});
  }
}

function notifyTask(title, heading = "Գործի հիշեցում") {
  tg?.HapticFeedback?.notificationOccurred?.("warning");
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(heading, { body: title });
      return;
    } catch { /* Some mobile webviews expose Notification without its constructor. */ }
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

function filterDebtPayments(period) {
  const now = new Date();
  return state.debtPayments.filter((payment) => {
    const date = new Date(payment.createdAt);
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

function getDaysUntilNextSalary(now = new Date(), salaryDay = state.salaryDay) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const requestedDay = Math.min(31, Math.max(1, Number(salaryDay) || 1));
  const effectiveDay = (targetYear, targetMonth) => Math.min(
    requestedDay,
    new Date(targetYear, targetMonth + 1, 0).getDate(),
  );

  let targetYear = year;
  let targetMonth = month;
  let targetDay = effectiveDay(targetYear, targetMonth);
  if (today >= targetDay) {
    targetMonth += 1;
    if (targetMonth === 12) {
      targetYear += 1;
      targetMonth = 0;
    }
    targetDay = effectiveDay(targetYear, targetMonth);
  }

  const todayOrdinal = Date.UTC(year, month, today);
  const targetOrdinal = Date.UTC(targetYear, targetMonth, targetDay);
  return Math.max(1, Math.round((targetOrdinal - todayOrdinal) / 86400000));
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
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date(value));
}

function parseAmount(value, label, allowZero = false) {
  const text = String(value).trim();
  if (!text && allowZero) return 0;
  const amount = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(amount) || (!allowZero && amount === 0)) {
    showMessage(`${label}․ գրեք ${allowZero ? "զրո կամ դրական ամբողջ" : "դրական ամբողջ"} գումար դրամով, միայն թվանշաններով։`);
    return null;
  }
  if (amount > MAX_AMOUNT) {
    showMessage(`${label} գումարը չափազանց մեծ է`);
    return null;
  }
  return amount;
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
  if (tg?.initData && tg.isVersionAtLeast?.("6.2") && tg.showAlert) tg.showAlert(message);
  else window.alert(message);
}

function getNotificationButtonText() {
  const channel = reminderChannel();
  const telegram = telegramRemindersLinked ? "Telegram-ը միացված է" : "Միացնել Telegram-ի հիշեցումները";
  if (channel === "telegram") return telegram;
  const device = "Notification" in window && Notification.permission === "granted"
    ? "Սարքի ծանուցումները միացված են" : "Սարքի հիշեցումների կարգավորումներ";
  return channel === "both" ? telegram + " · " + device : device;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
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
