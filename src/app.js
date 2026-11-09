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
let editingFixedId = "";
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
let messageTimer = 0;
let pendingImports = [];
let homeScreenStatus = "unknown";

const accordionState = {
  fixed: false,
  addExpense: true,
  recentExpenses: false,
  months: true,
  recurringTasks: false,
  taskList: true,
  planIncome: false,
  categoryBudgets: false,
  savingsGoals: false,
  debtStrategySettings: false,
  debtForm: false,
};

const els = {
  greeting: document.getElementById("greeting"),
  appEyebrow: document.getElementById("appEyebrow"),
  syncStatus: document.getElementById("syncStatus"),
  budgetView: document.getElementById("budgetView"),
  planView: document.getElementById("planView"),
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
  setupGuide: document.getElementById("setupGuide"),
  setupProgress: document.getElementById("setupProgress"),
  dismissSetup: document.getElementById("dismissSetup"),
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
  fixedDueDay: document.getElementById("fixedDueDay"),
  fixedReminder: document.getElementById("fixedReminder"),
  fixedSubmit: document.getElementById("fixedSubmit"),
  cancelFixedEdit: document.getElementById("cancelFixedEdit"),
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
  expenseSearch: document.getElementById("expenseSearch"),
  expenseFilterCategory: document.getElementById("expenseFilterCategory"),
  menuBtn: document.getElementById("menuBtn"),
  appSwitch: document.querySelector(".app-switch"),
  addHomeScreenBtn: document.getElementById("addHomeScreenBtn"),
  homeScreenNote: document.getElementById("homeScreenNote"),
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
  planIncomeTotal: document.getElementById("planIncomeTotal"),
  planSavingsTotal: document.getElementById("planSavingsTotal"),
  incomeForm: document.getElementById("incomeForm"),
  incomeTitle: document.getElementById("incomeTitle"),
  incomeAmount: document.getElementById("incomeAmount"),
  incomeKind: document.getElementById("incomeKind"),
  incomeDate: document.getElementById("incomeDate"),
  incomeDay: document.getElementById("incomeDay"),
  incomeDateField: document.getElementById("incomeDateField"),
  incomeDayField: document.getElementById("incomeDayField"),
  incomeList: document.getElementById("incomeList"),
  categoryBudgetForm: document.getElementById("categoryBudgetForm"),
  categoryBudgetList: document.getElementById("categoryBudgetList"),
  savingsForm: document.getElementById("savingsForm"),
  savingsTitle: document.getElementById("savingsTitle"),
  savingsTarget: document.getElementById("savingsTarget"),
  savingsSaved: document.getElementById("savingsSaved"),
  savingsMonthly: document.getElementById("savingsMonthly"),
  savingsDueDate: document.getElementById("savingsDueDate"),
  savingsList: document.getElementById("savingsList"),
  insightsList: document.getElementById("insightsList"),
  cashflowList: document.getElementById("cashflowList"),
  debtExtraPayment: document.getElementById("debtExtraPayment"),
  calculateDebtWhatIf: document.getElementById("calculateDebtWhatIf"),
  debtWhatIfResult: document.getElementById("debtWhatIfResult"),
  bankImportInput: document.getElementById("bankImportInput"),
  importPreview: document.getElementById("importPreview"),
  confirmImportBtn: document.getElementById("confirmImportBtn"),
  importNote: document.getElementById("importNote"),
  backupExportBtn: document.getElementById("backupExportBtn"),
  backupImportInput: document.getElementById("backupImportInput"),
  backupNote: document.getElementById("backupNote"),
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
  appMessage: document.getElementById("appMessage"),
};

const categoryColors = {
  "Սնունդ": "#f1c453",
  "Տրանսպորտ": "#7bb7d6",
  "Տուն": "#8fc9a7",
  "Առողջություն": "#e98276",
  "Ժամանց": "#b79bd8",
  "Այլ": "#c9b89b",
};

const armenianMonths = ["հունվար", "փետրվար", "մարտ", "ապրիլ", "մայիս", "հունիս", "հուլիս", "օգոստոս", "սեպտեմբեր", "հոկտեմբեր", "նոյեմբեր", "դեկտեմբեր"];
const armenianShortMonths = ["հնվ", "փտր", "մրտ", "ապր", "մյս", "հնս", "հլս", "օգս", "սեպ", "հոկ", "նոյ", "դեկ"];

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
  if (!tg) {
    homeScreenStatus = "unsupported";
    return;
  }
  tg.ready?.();
  tg.expand?.();
  if (tg.isVersionAtLeast?.("6.1")) {
    tg.setHeaderColor?.(tg.isVersionAtLeast("6.9") ? "#f7f3ea" : "bg_color");
    tg.setBackgroundColor?.("#f7f3ea");
  }

  const name = tg.initDataUnsafe?.user?.first_name;
  if (name) els.greeting.textContent = `Բարի օր, ${name}`;

  tg.onEvent?.("homeScreenAdded", () => {
    homeScreenStatus = "added";
    renderHomeScreenInstall();
    showMessage("Խնայիկը ավելացվեց հեռախոսի գլխավոր էկրանին։", "success");
  });
  if (tg.isVersionAtLeast?.("8.0") && typeof tg.checkHomeScreenStatus === "function") {
    tg.checkHomeScreenStatus((status) => {
      homeScreenStatus = ["unsupported", "unknown", "added", "missed"].includes(status) ? status : "unknown";
      renderHomeScreenInstall();
    });
  } else {
    homeScreenStatus = "unsupported";
  }
}

function initTimePickers() {
  ["recurringTime", "recurringReminderTime", "scheduledTime", "scheduledReminderTime"].forEach((key) => {
    fillTimeSelect(els[`${key}Hour`], 24);
    fillTimeSelect(els[`${key}Minute`], 60, 5);
    resetTimePicker(key);
  });
}

function fillTimeSelect(select, max, step = 1) {
  select.innerHTML = "";
  for (let value = 0; value < max; value += step) {
    const option = document.createElement("option");
    option.value = String(value).padStart(2, "0");
    option.textContent = String(value).padStart(2, "0");
    select.append(option);
  }
}

function bindEvents() {
  els.expenseDate.value = displayedDay;
  els.expenseDate.max = displayedDay;
  els.incomeDate.value = displayedDay;
  els.savingsDueDate.min = displayedDay;
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
      document.querySelectorAll(".tab").forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
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
    const dueDay = Number(els.fixedDueDay.value);
    if (!title || amount === null) return;
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return showMessage("Վճարման օրը պետք է լինի 1-ից 31։");
    const existing = state.fixedExpenses.find((item) => item.id === editingFixedId);
    if (isDuplicate(state.fixedExpenses.filter((item) => item.id !== editingFixedId), title)) return showMessage("Այս ֆիքսված ծախսն արդեն կա");
    const changes = {
      title, amount, dueDay, reminder: els.fixedReminder.checked,
      timeZone: existing?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (existing) Object.assign(existing, changes);
    else state.fixedExpenses.push({ id: crypto.randomUUID(), ...changes, paidMonths: [], createdAt: new Date().toISOString() });
    updateCurrentMonthBudget();
    if (saveState() === false) return;
    resetFixedForm();
    render();
  });
  els.cancelFixedEdit.addEventListener("click", resetFixedForm);

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
  els.expenseSearch.addEventListener("input", renderExpenses);
  els.expenseFilterCategory.addEventListener("change", renderExpenses);

  els.menuBtn.addEventListener("click", () => {
    activeView = activeView === "settings" ? "budget" : "settings";
    render();
  });
  els.addHomeScreenBtn.addEventListener("click", requestHomeScreenInstall);
  els.excelExportBtn.addEventListener("click", exportExcel);
  els.csvExportBtn.addEventListener("click", exportCsv);
  els.backgroundInput.addEventListener("change", setBackgroundImage);
  els.removeBackgroundBtn.addEventListener("click", removeBackgroundImage);
  els.backupExportBtn.addEventListener("click", exportBackup);
  els.backupImportInput.addEventListener("change", importBackup);
  els.bankImportInput.addEventListener("change", loadBankStatement);
  els.confirmImportBtn.addEventListener("click", confirmBankImport);

  els.monthSelect.addEventListener("change", () => {
    selectedMonthKey = els.monthSelect.value;
    renderMonthlySummary();
  });

  els.scheduledFormToggle.addEventListener("click", () => {
    isScheduledFormOpen = !isScheduledFormOpen;
    renderScheduledFormVisibility();
  });

  els.dismissSetup.addEventListener("click", () => {
    state.appearance.onboardingDismissed = true;
    saveState();
    renderSetupGuide();
  });
  document.querySelectorAll("[data-setup]").forEach((button) => {
    button.addEventListener("click", () => openSetupStep(button.dataset.setup));
  });

  els.saveDebtSettings.addEventListener("click", saveDebtSettings);
  els.debtForm.addEventListener("submit", saveDebt);
  els.cancelDebtEdit.addEventListener("click", resetDebtForm);
  els.calculateDebtWhatIf.addEventListener("click", calculateDebtWhatIf);

  els.incomeKind.addEventListener("change", renderIncomeFields);
  els.incomeForm.addEventListener("submit", addIncome);
  els.categoryBudgetForm.addEventListener("submit", saveCategoryBudgets);
  els.savingsForm.addEventListener("submit", addSavingsGoal);

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
  const dueDayText = els.debtDueDay.value.trim();
  const dueDay = dueDayText ? Number(dueDayText) : null;
  if (!title || balance === null || minimumPayment === null || lateFee === null) return;
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1000) return showMessage("Տարեկան տոկոսը պետք է լինի 0-ից 1000 միջակայքում։");
  if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return showMessage("Վճարման օրը պետք է լինի 1-ից 31 կամ դաշտը թողեք դատարկ։");
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
    reminder: dueDay !== null && els.debtReminder.checked,
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
  els.debtDueDay.value = "";
  els.debtLateFee.value = "0";
  els.debtReminder.checked = true;
  els.debtFormTitle.textContent = "Ավելացնել պարտք";
  els.debtSubmit.textContent = "Պահպանել պարտքը";
  els.cancelDebtEdit.hidden = true;
  const advanced = els.debtRate.closest?.("details");
  if (advanced) advanced.open = false;
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
  renderPlan();
  renderSetupGuide();
  renderMonthlySummary();
  renderFixedExpenses();
  renderExpenses();
  renderDebts();
  renderTasks();
  renderScheduledFormVisibility();
  renderAccordions();
  renderSyncStatus();
  renderHomeScreenInstall();
  renderIncomeFields();
  applyBackgroundImage();
}

function renderSetupGuide() {
  const steps = {
    salary: Number(state.salary) > 0,
    fixed: state.fixedExpenses.length > 0,
    expense: state.expenses.length > 0,
  };
  const complete = Object.values(steps).filter(Boolean).length;
  els.setupGuide.hidden = state.appearance.onboardingDismissed === true || complete === 3;
  els.setupProgress.textContent = `${complete}/3 քայլ պատրաստ է`;
  document.querySelectorAll("[data-setup]").forEach((button) => {
    const done = steps[button.dataset.setup];
    button.classList.toggle("is-done", done);
    button.querySelector("span").textContent = done ? "✓" : ({ salary: "1", fixed: "2", expense: "3" }[button.dataset.setup]);
  });
}

function openSetupStep(step) {
  activeView = "budget";
  if (step === "salary" || step === "fixed") accordionState.fixed = true;
  if (step === "expense") accordionState.addExpense = true;
  renderView();
  renderAccordions();
  const target = step === "salary" ? els.salaryInput : step === "fixed" ? els.fixedName : els.expenseTitle;
  target.scrollIntoView?.({ behavior: "smooth", block: "center" });
  window.setTimeout(() => target.focus(), 250);
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
    button.setAttribute("aria-selected", String(button.dataset.view === activeView));
    button.tabIndex = button.dataset.view === activeView ? 0 : -1;
  });
  els.budgetView.classList.toggle("is-active", activeView === "budget");
  els.planView.classList.toggle("is-active", activeView === "plan");
  els.tasksView.classList.toggle("is-active", activeView === "tasks");
  els.debtsView.classList.toggle("is-active", activeView === "debts");
  els.monthsView.classList.toggle("is-active", activeView === "months");
  els.settingsView.classList.toggle("is-active", activeView === "settings");
  els.appSwitch.hidden = activeView === "settings";
  els.menuBtn.classList.toggle("is-active", activeView === "settings");
  els.menuBtn.textContent = activeView === "settings" ? "Վերադառնալ" : "Կարգավորումներ";
  els.menuBtn.setAttribute("aria-label", activeView === "settings" ? "Վերադառնալ բյուջե" : "Բացել կարգավորումները");
  els.appEyebrow.textContent = {
    budget: "Իմ բյուջեն",
    plan: "Ֆինանսական պլան",
    tasks: "Իմ ժամանակը",
    debts: "Պարտքերից ազատում",
    months: "Ամսական պատմություն",
    settings: "Կարգավորումներ",
  }[activeView];
}

function renderBudget() {
  const monthKey = getMonthKey(new Date());
  const currentBudget = getBudgetForMonth(monthKey);
  const fixedTotal = sum(currentBudget.fixedExpenses);
  const extraIncome = KhnayikFinance.incomeForMonth(state.incomes, monthKey);
  const savingsReserve = monthlySavingsContribution();
  const monthExpenses = sum(filterByPeriod("month"));
  const monthDebtPaid = sum(filterDebtPayments("month"));
  const monthSpent = monthExpenses + monthDebtPaid;
  const totalIncome = currentBudget.salary + extraIncome;
  const base = totalIncome - fixedTotal - savingsReserve;
  const free = base - monthSpent;
  const usage = base > 0 ? Math.round(monthSpent / base * 100) : 0;
  const daysLeft = getDaysUntilNextSalary();
  const dailyLimit = Math.max(0, Math.floor(free / daysLeft));

  els.freeMoney.textContent = formatMoney(free);
  els.budgetHint.textContent = `Պարտադիր պահումներ՝ ${formatMoney(fixedTotal + savingsReserve)} · Այս ամիս ելք՝ ${formatMoney(monthSpent)}`;
  const noBudget = base <= 0 && free < 0;
  els.budgetPercent.textContent = noBudget ? "Պակասուրդ" : `${usage}%`;
  els.budgetMeter.style.strokeDashoffset = String(327 * (1 - (noBudget ? 1 : Math.min(usage, 100) / 100)));
  els.periodLabel.textContent = getPeriodLabel();
  els.periodTotal.textContent = formatMoney(sum(filterByPeriod(activePeriod)) + sum(filterDebtPayments(activePeriod)));
  els.dailyLimit.textContent = formatMoney(dailyLimit);
  els.daysLeft.textContent = String(daysLeft);
}

function renderIncomeFields() {
  const monthly = els.incomeKind.value === "monthly";
  els.incomeDateField.hidden = monthly;
  els.incomeDayField.hidden = !monthly;
  els.incomeDate.required = !monthly;
}

function addIncome(event) {
  event.preventDefault();
  const title = normalizeTitle(els.incomeTitle.value);
  const amount = parseAmount(els.incomeAmount.value, "Եկամուտ");
  const kind = els.incomeKind.value === "monthly" ? "monthly" : "one-time";
  const day = Number(els.incomeDay.value);
  if (!title || amount === null) return;
  if (kind === "monthly" && (!Number.isInteger(day) || day < 1 || day > 31)) return showMessage("Եկամտի օրը պետք է լինի 1-ից 31։");
  if (kind === "one-time" && !els.incomeDate.value) return showMessage("Ընտրեք եկամտի ամսաթիվը։");
  state.incomes.unshift({
    id: crypto.randomUUID(), title, amount, kind,
    date: kind === "one-time" ? els.incomeDate.value : "",
    day: kind === "monthly" ? day : null,
    startMonth: getMonthKey(new Date()), source: "manual", createdAt: new Date().toISOString(),
  });
  if (saveState() === false) return;
  els.incomeForm.reset();
  els.incomeDate.value = getDateKey(new Date());
  els.incomeDay.value = "1";
  render();
}

function saveCategoryBudgets(event) {
  event.preventDefault();
  const next = {};
  els.categoryBudgetList.querySelectorAll("input[data-category]").forEach((input) => {
    const amount = parseAmount(input.value || "0", `${input.dataset.category} սահմանաչափ`, true);
    if (amount !== null) next[input.dataset.category] = amount;
  });
  state.categoryBudgets = next;
  if (saveState() === false) return;
  renderPlan();
  showMessage("Կատեգորիաների սահմանաչափերը պահպանված են։", "success");
}

function addSavingsGoal(event) {
  event.preventDefault();
  const title = normalizeTitle(els.savingsTitle.value);
  const target = parseAmount(els.savingsTarget.value, "Թիրախային գումար");
  const saved = parseAmount(els.savingsSaved.value, "Կուտակված գումար", true);
  const monthlyContribution = parseAmount(els.savingsMonthly.value, "Ամսական ներդրում", true);
  if (!title || target === null || saved === null || monthlyContribution === null) return;
  if (saved > target) return showMessage("Կուտակված գումարը չի կարող գերազանցել թիրախը։");
  state.savingsGoals.unshift({
    id: crypto.randomUUID(), title, target, saved, monthlyContribution,
    dueDate: els.savingsDueDate.value || "", startMonth: getMonthKey(new Date()), createdAt: new Date().toISOString(),
  });
  if (saveState() === false) return;
  els.savingsForm.reset();
  els.savingsSaved.value = "0";
  els.savingsMonthly.value = "0";
  render();
}

function monthlySavingsContribution(monthKey = getMonthKey(new Date())) {
  return (state.savingsGoals || []).filter((goal) => goal.saved < goal.target && (!goal.startMonth || goal.startMonth <= monthKey))
    .reduce((total, goal) => total + Math.max(0, Number(goal.monthlyContribution) || 0), 0);
}

function renderPlan() {
  const currentMonth = getMonthKey(new Date());
  els.planIncomeTotal.textContent = formatMoney(KhnayikFinance.incomeForMonth(state.incomes, currentMonth));
  els.planSavingsTotal.textContent = formatMoney(monthlySavingsContribution());
  renderIncomes();
  renderCategoryBudgets();
  renderSavingsGoals();
  renderInsights();
  renderCashflow();
}

function renderIncomes() {
  els.incomeList.innerHTML = "";
  if (!state.incomes.length) {
    els.incomeList.innerHTML = `<div class="empty-state">Լրացուցիչ եկամուտ դեռ չկա</div>`;
    return;
  }
  for (const income of state.incomes) {
    const row = document.createElement("article");
    row.className = "plan-item";
    const meta = income.kind === "monthly" ? `Ամեն ամսվա ${income.day}-ին` : formatDate(`${income.date}T12:00:00`);
    row.innerHTML = `<div class="plan-item-head"><strong></strong><b></b></div><span class="plan-item-meta"></span><div class="plan-item-actions"></div>`;
    row.querySelector("strong").textContent = income.title;
    row.querySelector("b").textContent = formatMoney(income.amount);
    row.querySelector(".plan-item-meta").textContent = `${meta}${income.source === "bank" ? " · բանկային ներմուծում" : ""}`;
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "Ջնջել";
    remove.addEventListener("click", () => deleteRecord("incomes", income.id));
    row.querySelector(".plan-item-actions").append(remove);
    els.incomeList.append(row);
  }
}

function renderCategoryBudgets() {
  const totals = KhnayikFinance.totalsByCategory(state.expenses, getMonthKey(new Date()));
  els.categoryBudgetList.innerHTML = "";
  for (const category of KhnayikFinance.categories) {
    const limit = Number(state.categoryBudgets[category] || 0);
    const spent = Number(totals[category] || 0);
    const row = document.createElement("label");
    row.className = "category-budget-row";
    const copy = document.createElement("span");
    copy.className = "category-budget-copy";
    const title = document.createElement("strong"); title.textContent = category;
    const meta = document.createElement("small"); meta.textContent = limit ? `${formatMoney(spent)} / ${formatMoney(limit)}` : `${formatMoney(spent)} ծախսված · սահմանաչափ չկա`;
    const progress = document.createElement("span"); progress.className = "category-progress";
    const bar = document.createElement("i"); bar.style.width = `${limit ? Math.min(100, spent / limit * 100) : 0}%`;
    progress.append(bar); copy.append(title, meta, progress);
    const input = document.createElement("input"); input.inputMode = "numeric"; input.value = String(limit); input.dataset.category = category; input.setAttribute("aria-label", `${category} կատեգորիայի սահմանաչափ`);
    row.append(copy, input); els.categoryBudgetList.append(row);
  }
}

function renderSavingsGoals() {
  els.savingsList.innerHTML = "";
  if (!state.savingsGoals.length) {
    els.savingsList.innerHTML = `<div class="empty-state">Խնայողության նպատակ դեռ չկա</div>`;
    return;
  }
  for (const goal of state.savingsGoals) {
    const percent = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
    const row = document.createElement("article");
    row.className = "plan-item";
    row.innerHTML = `<div class="plan-item-head"><strong></strong><b></b></div><span class="plan-item-meta"></span><div class="goal-progress"><i></i></div><div class="plan-item-actions"></div>`;
    row.querySelector("strong").textContent = goal.title;
    row.querySelector("b").textContent = `${percent}%`;
    row.querySelector(".plan-item-meta").textContent = `${formatMoney(goal.saved)} / ${formatMoney(goal.target)} · ամսական ${formatMoney(goal.monthlyContribution)}${goal.dueDate ? ` · մինչև ${formatDate(`${goal.dueDate}T12:00:00`)}` : ""}`;
    row.querySelector("i").style.width = `${percent}%`;
    const add = document.createElement("button"); add.type = "button"; add.textContent = "Ավելացնել գումար";
    add.addEventListener("click", () => {
      const value = window.prompt(`Որքա՞ն ավելացնել «${goal.title}» նպատակին`, "0");
      if (value === null) return;
      const amount = parseAmount(value, "Խնայողություն");
      if (amount === null) return;
      goal.saved = Math.min(goal.target, goal.saved + amount);
      if (saveState() !== false) render();
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Ջնջել";
    remove.addEventListener("click", () => deleteRecord("savingsGoals", goal.id));
    row.querySelector(".plan-item-actions").append(add, remove);
    els.savingsList.append(row);
  }
}

function previousMonthKey(date = new Date()) {
  return getMonthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1, 12));
}

function renderInsights() {
  const messages = KhnayikFinance.insights({
    expenses: state.expenses, categoryBudgets: state.categoryBudgets,
    currentMonth: getMonthKey(new Date()), previousMonth: previousMonthKey(),
  });
  els.insightsList.innerHTML = "";
  for (const message of messages) {
    const row = document.createElement("div"); row.className = "insight-item"; row.textContent = message; els.insightsList.append(row);
  }
}

function nextMonthlyDate(day, from = new Date(), allowToday = true) {
  for (let offset = 0; offset < 3; offset += 1) {
    const year = from.getFullYear();
    const month = from.getMonth() + offset;
    const last = new Date(year, month + 1, 0).getDate();
    const candidate = new Date(year, month, Math.min(day, last), 12);
    const candidateKey = getDateKey(candidate);
    const todayKey = getDateKey(from);
    if (candidateKey > todayKey || (allowToday && candidateKey === todayKey)) return candidate;
  }
  return null;
}

function renderCashflow() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 35, 23, 59);
  const monthKey = getMonthKey(now);
  const budget = getBudgetForMonth(monthKey);
  const savings = monthlySavingsContribution(monthKey);
  const paidFixed = budget.fixedExpenses.filter((item) => (item.paidMonths || []).includes(monthKey));
  const todayKey = getDateKey(now);
  const salaryThisMonthDay = Math.min(state.salaryDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  const salaryReceived = salaryThisMonthDay <= now.getDate() ? Number(budget.salary || 0) : 0;
  const receivedIncome = state.incomes.filter((income) => income.kind === "monthly"
    ? (income.startMonth || monthKey) <= monthKey && Number(income.day || 1) <= now.getDate()
    : income.date?.startsWith(monthKey) && income.date <= todayKey).reduce((sum, income) => sum + Number(income.amount || 0), 0);
  let balance = salaryReceived + receivedIncome
    - sum(filterByPeriod("month")) - sum(filterDebtPayments("month")) - sum(paidFixed);
  const events = [];
  const push = (date, title, amount, reserved = false) => { if (date && date <= end && Number(amount)) events.push({ date, title, amount, reserved }); };
  push(nextMonthlyDate(state.salaryDay, now, false), "Աշխատավարձ", Number(state.salary || 0));
  for (const income of state.incomes) {
    if (income.kind === "monthly") push(nextMonthlyDate(income.day || 1, now, false), income.title, Number(income.amount || 0));
    else {
      const date = new Date(`${income.date}T12:00:00`);
      if (date >= now) push(date, income.title, Number(income.amount || 0));
    }
  }
  for (const item of budget.fixedExpenses) {
    if ((item.paidMonths || []).includes(monthKey)) continue;
    push(nextMonthlyDate(item.dueDay || 1, now), item.title, -Number(item.amount || 0));
  }
  for (const debt of state.debts.filter((item) => item.balance > 0 && item.dueDay)) {
    const paid = state.debtPayments.filter((payment) => payment.debtId === debt.id && getMonthKey(new Date(payment.createdAt)) === monthKey).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    push(nextMonthlyDate(debt.dueDay, now), `Պարտք՝ ${debt.title}`, -Math.max(0, Number(debt.minimumPayment || 0) - paid));
  }
  if (savings) push(nextMonthlyDate(state.salaryDay, now, false), "Խնայողության նպատակներ", -savings);
  events.sort((a, b) => a.date - b.date || b.amount - a.amount);
  els.cashflowList.innerHTML = "";
  if (!events.length) {
    els.cashflowList.innerHTML = `<div class="empty-state">Առաջիկա 35 օրվա պլանային շարժ չկա</div>`;
    return;
  }
  for (const event of events) {
    balance += event.amount;
    const row = document.createElement("article"); row.className = "cashflow-item" + (balance < 0 ? " is-negative" : "");
    const copy = document.createElement("div"); copy.innerHTML = `<strong></strong><small></small>`;
    copy.querySelector("strong").textContent = event.title;
    copy.querySelector("small").textContent = `${formatDate(event.date)} · հետո՝ ${formatMoney(balance)}`;
    const amount = document.createElement("span"); amount.className = `cashflow-amount ${event.amount >= 0 ? "is-income" : "is-expense"}`; amount.textContent = `${event.amount >= 0 ? "+" : "−"}${formatMoney(Math.abs(event.amount))}`;
    row.append(copy, amount); els.cashflowList.append(row);
  }
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
  els.debtInterest.textContent = result.items.length && result.selected.possible ? formatMoney(result.selected.interest) : "—";
  els.debtFreeDate.textContent = result.items.length && result.selected.possible && result.selected.debtFreeDate
    ? formatArmenianMonth(result.selected.debtFreeDate)
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
    const plannedDate = result.selected.payoffDates?.[payment.debt.id];
    const plannedText = plannedDate
      ? ` · պլանային փակում՝ ${formatArmenianMonth(new Date(plannedDate))}`
      : "";
    detail.textContent = (payment.debt.id === result.current.targetId ? "Գլխավոր նպատակ" : "Նվազագույն վճար") + plannedText;
    copy.append(title, detail);
    const amount = document.createElement("b");
    amount.textContent = formatMoney(payment.amount);
    line.append(copy, amount);
    els.debtPaymentPlan.append(line);
  }
  renderDebtList(result);
}

function debtPlanInputs() {
  const monthKey = getMonthKey(new Date());
  const budget = getBudgetForMonth(monthKey);
  const salary = Number(budget.salary || 0) + KhnayikFinance.incomeForMonth(state.incomes, monthKey);
  const fixed = sum(budget.fixedExpenses);
  const savings = monthlySavingsContribution();
  const spent = sum(filterByPeriod("month"));
  const debtPaid = sum(filterDebtPayments("month"));
  const averageLiving = averageMonthlyExpenses();
  const configured = Number(state.debtSettings?.safetyReserve || 0);
  const protectedNow = configured || Math.round(Math.max(0, averageLiving - spent) + salary * 0.05);
  const protectedRecurring = configured || Math.round(averageLiving + salary * 0.05);
  return {
    protectedNow,
    available: Math.max(0, salary - fixed - savings - spent - debtPaid - protectedNow),
    recurringAvailable: Math.max(0, salary - fixed - savings - protectedRecurring),
  };
}

function calculateDebtWhatIf() {
  const extra = parseAmount(els.debtExtraPayment.value, "Հավելյալ պարտքի վճարում", true);
  if (extra === null) return;
  const inputs = debtPlanInputs();
  const base = KhnayikDebt.analyze({ debts: state.debts, available: inputs.available, recurringAvailable: inputs.recurringAvailable, strategy: state.debtSettings.strategy }).selected;
  const improved = KhnayikDebt.analyze({ debts: state.debts, available: inputs.available + extra, recurringAvailable: inputs.recurringAvailable + extra, strategy: state.debtSettings.strategy }).selected;
  if (!state.debts.some((debt) => debt.balance > 0)) {
    els.debtWhatIfResult.textContent = "Ակտիվ պարտք չկա։";
  } else if (!improved.possible) {
    els.debtWhatIfResult.textContent = "Այս գումարով դեռ հնարավոր չէ վստահելի մարման ամսաթիվ հաշվարկել։";
  } else if (!base.possible) {
    els.debtWhatIfResult.textContent = `${formatMoney(extra)} հավելումով կանխատեսվող ազատումը կլինի ${formatArmenianMonth(improved.debtFreeDate)}։`;
  } else {
    els.debtWhatIfResult.textContent = `Կխնայեք մոտ ${Math.max(0, base.months - improved.months)} ամիս և ${formatMoney(Math.max(0, base.interest - improved.interest))} տոկոս։ Նոր գնահատական՝ ${formatArmenianMonth(improved.debtFreeDate)}։`;
  }
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

function renderDebtList(result) {
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
    const deadline = debt.dueDay ? `վճարման օրը՝ ${debt.dueDay}` : "առանց վերջնաժամկետի՝ պլանով պարտադիր մարում";
    const plannedDate = result.selected.payoffDates?.[debt.id];
    const planned = plannedDate
      ? ` · պլանային փակում՝ ${formatArmenianMonth(new Date(plannedDate))}`
      : "";
    meta.textContent = `${typeNames[debt.type] || "Այլ"} · ${debt.annualRate}% տարեկան · նվազագույնը ${formatMoney(debt.minimumPayment)} · ${deadline}${planned}${debt.pastDue ? " · ՈՒՇԱՑԱԾ" : ""}`;
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
  els.debtDueDay.value = debt.dueDay ? String(debt.dueDay) : "";
  els.debtLateFee.value = String(debt.lateFee);
  els.debtPastDue.checked = debt.pastDue;
  els.debtReminder.checked = debt.reminder;
  els.debtFormTitle.textContent = "Խմբագրել պարտքը";
  els.debtSubmit.textContent = "Պահպանել փոփոխությունները";
  els.cancelDebtEdit.hidden = false;
  const advanced = els.debtRate.closest?.("details");
  if (advanced) advanced.open = true;
  activeView = "debts";
  accordionState.debtForm = true;
  renderView();
  renderAccordions();
  els.debtName.focus();
}

function renderFixedExpenses() {
  els.fixedList.innerHTML = "";
  if (!state.fixedExpenses.length) {
    els.fixedList.innerHTML = `<div class="empty-state">Մշտական ծախսեր դեռ չկան</div>`;
    return;
  }

  state.fixedExpenses.forEach((item) => {
    const monthKey = getMonthKey(new Date());
    const paid = (item.paidMonths || []).includes(monthKey);
    const row = document.createElement("div");
    row.className = "fixed-item";
    const copy = document.createElement("div");
    copy.className = "fixed-item-copy";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = `${formatMoney(item.amount)}${item.dueDay ? ` · ամեն ամսվա ${item.dueDay}-ին${item.reminder ? " · հիշեցում՝ 2 օր շուտ" : ""}` : ""} · ${paid ? "այս ամիս վճարված է" : "այս ամիս չի վճարվել"}`;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "fixed-item-actions";
    const paidButton = document.createElement("button");
    paidButton.type = "button";
    paidButton.classList.toggle("is-paid", paid);
    paidButton.textContent = paid ? "Վճարված" : "Նշել վճարված";
    paidButton.setAttribute("aria-pressed", String(paid));
    paidButton.addEventListener("click", () => toggleFixedPaid(item.id));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Փոխել";
    edit.addEventListener("click", () => editFixedExpense(item.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Ջնջել ֆիքսված ծախսը՝ ${item.title}`);
    remove.addEventListener("click", () => deleteRecord("fixedExpenses", item.id));
    actions.append(paidButton, edit, remove);
    row.append(copy, actions);
    els.fixedList.append(row);
  });
}

function toggleFixedPaid(id) {
  const item = state.fixedExpenses.find((expense) => expense.id === id);
  if (!item) return;
  const monthKey = getMonthKey(new Date());
  item.paidMonths ||= [];
  item.paidMonths = item.paidMonths.includes(monthKey)
    ? item.paidMonths.filter((key) => key !== monthKey)
    : [...item.paidMonths, monthKey].sort();
  updateCurrentMonthBudget();
  if (saveState() === false) return;
  render();
}

function editFixedExpense(id) {
  const item = state.fixedExpenses.find((expense) => expense.id === id);
  if (!item) return;
  editingFixedId = id;
  els.fixedName.value = item.title;
  els.fixedAmount.value = String(item.amount);
  els.fixedDueDay.value = item.dueDay ? String(item.dueDay) : "1";
  els.fixedReminder.checked = item.reminder !== false;
  els.fixedSubmit.textContent = "Պահպանել";
  els.cancelFixedEdit.hidden = false;
  els.fixedName.focus();
}

function resetFixedForm() {
  editingFixedId = "";
  els.fixedForm.reset();
  els.fixedReminder.checked = true;
  els.fixedSubmit.textContent = "Ավելացնել";
  els.cancelFixedEdit.hidden = true;
}

function renderExpenses() {
  els.expenseList.innerHTML = "";
  const query = els.expenseSearch.value.trim().toLocaleLowerCase("hy-AM");
  const category = els.expenseFilterCategory.value;
  const filtered = state.expenses.filter((expense) => (!query || expense.title.toLocaleLowerCase("hy-AM").includes(query)
    || String(expense.amount).includes(query)) && (!category || expense.category === category));
  els.expenseCount.textContent = state.expenses.length ? `${filtered.length}/${state.expenses.length} գրառում` : "Դեռ ծախս չկա";
  if (!state.expenses.length) {
    els.expenseList.innerHTML = `<div class="empty-state">Ավելացրեք առաջին ծախսը</div>`;
    return;
  }

  if (!filtered.length) {
    els.expenseList.innerHTML = `<div class="empty-state">Այս որոնմամբ ծախս չկա</div>`;
    return;
  }

  filtered.slice(0, 60).forEach((expense) => {
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
    button.setAttribute("aria-selected", String(button.dataset.monthMode === activeMonthMode));
  });

  if (activeMonthMode === "expenses") renderMonthExpenses(selectedMonthKey);
  else renderMonthTasks(selectedMonthKey);
}

function renderMonthExpenses(monthKey) {
  const expenses = state.expenses.filter((expense) => getMonthKey(new Date(expense.createdAt)) === monthKey);
  const debtPayments = state.debtPayments.filter((payment) => getMonthKey(new Date(payment.createdAt)) === monthKey);
  const budget = getBudgetForMonth(monthKey);
  const extraIncome = KhnayikFinance.incomeForMonth(state.incomes, monthKey);
  const savings = monthlySavingsContribution(monthKey);
  const fixedTotal = sum(budget.fixedExpenses);
  const fixedPaid = budget.fixedExpenses.filter((item) => (item.paidMonths || []).includes(monthKey)).length;
  const spent = sum(expenses);
  const debtPaid = sum(debtPayments);
  const salaryLabel = budget.salaryMode === "fixed"
    ? `Աշխատավարձ (${budget.salaryDay || state.salaryDay}-ին)` : "Աշխատավարձ";
  const salaryValue = budget.salaryMode === "variable" && budget.salaryConfirmed === false
    ? "Չի մուտքագրվել" : formatMoney(budget.salary);
  addMonthTotalRow(salaryLabel, salaryValue);
  if (extraIncome) addMonthTotalRow("Այլ եկամուտներ", formatMoney(extraIncome));
  addMonthTotalRow("Ֆիքսված ծախսեր", formatMoney(fixedTotal));
  if (budget.fixedExpenses.length) addMonthTotalRow("Վճարված ֆիքսվածներ", `${fixedPaid}/${budget.fixedExpenses.length}`);
  addMonthTotalRow("Առօրյա ծախսեր", formatMoney(spent));
  addMonthTotalRow("Պարտքերի վճարումներ", formatMoney(debtPaid));
  if (savings) addMonthTotalRow("Պլանավորված խնայողություն", formatMoney(savings));
  addMonthTotalRow("Ազատ մնացորդ", formatMoney(budget.salary + extraIncome - fixedTotal - savings - spent - debtPaid));
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
      <div class="task-actions"><button class="reminder-chip" type="button"></button><button class="reminder-chip snooze-task" type="button">Վաղը</button><button class="delete-task" type="button">×</button></div>
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
    const snooze = row.querySelector(".snooze-task");
    snooze.setAttribute("aria-label", `Վաղը հիշեցնել՝ ${task.title}`);
    snooze.addEventListener("click", () => snoozeTask(task));
    const remove = row.querySelector(".delete-task");
    remove.setAttribute("aria-label", `Ջնջել գործը՝ ${task.title}`);
    remove.addEventListener("click", () => deleteTask(task));
    els.taskList.append(row);
  });
}

function snoozeTask(task) {
  const list = task.type === "scheduled" ? state.scheduledTasks : state.recurringTasks;
  const item = list.find((entry) => entry.id === task.id);
  if (!item) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  item.reminder = true;
  item.reminderAt = tomorrow.toISOString();
  if (saveState() === false) return;
  renderTasks();
  showMessage(`«${item.title}» գործը կհիշեցվի վաղը՝ 09:00։`, "success");
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
  const description = CLOUD_MODE
    ? syncDescription || "Բեռնվում են հաշվի տվյալները"
    : "Նախադիտում․ պահվում է միայն այս սարքում";
  const needsAttention = CLOUD_MODE && !/համաժամացված|պահվում են սերվերում/i.test(description);
  els.syncStatus.textContent = description;
  els.syncStatus.hidden = !needsAttention;
}

function renderHomeScreenInstall() {
  if (!els.addHomeScreenBtn || !els.homeScreenNote) return;
  const supported = Boolean(tg?.isVersionAtLeast?.("8.0") && typeof tg.addToHomeScreen === "function");
  const added = homeScreenStatus === "added";
  els.addHomeScreenBtn.disabled = added;
  els.addHomeScreenBtn.classList.toggle("is-complete", added);
  els.addHomeScreenBtn.textContent = added ? "Ավելացված է գլխավոր էկրանին" : "Ավելացնել գլխավոր էկրանին";
  els.homeScreenNote.textContent = added
    ? "Խնայիկի նշանն արդեն կա հեռախոսի գլխավոր էկրանին։"
    : supported
      ? "Telegram-ը կբացի հեռախոսի հաստատման պատուհանը։"
      : "Բացեք Խնայիկը Telegram-ի թարմացված բջջային հավելվածում՝ այս կոճակն օգտագործելու համար։";
}

function requestHomeScreenInstall() {
  const supported = Boolean(tg?.isVersionAtLeast?.("8.0") && typeof tg.addToHomeScreen === "function");
  if (!supported) {
    showMessage("Այս գործողությունը հասանելի է Telegram-ի թարմացված բջջային հավելվածում։");
    return;
  }
  if (homeScreenStatus === "added") {
    showMessage("Խնայիկն արդեն ավելացված է գլխավոր էկրանին։", "success");
    return;
  }
  tg.HapticFeedback?.impactOccurred?.("light");
  tg.addToHomeScreen();
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
  const fixedExpenses = (Array.isArray(value.fixedExpenses) ? value.fixedExpenses : []).map((item) => ({
    ...item,
    dueDay: Number.isInteger(Number(item.dueDay)) && Number(item.dueDay) >= 1 && Number(item.dueDay) <= 31
      ? Number(item.dueDay) : null,
    reminder: item.reminder !== false,
    paidMonths: Array.isArray(item.paidMonths) ? item.paidMonths : [],
  }));
  const debts = (Array.isArray(value.debts) ? value.debts : []).map((item) => {
    const balance = Math.max(0, Math.round(Number(item.balance) || 0));
    const paidTotal = Math.max(0, Math.round(Number(item.paidTotal) || 0));
    return {
      ...item,
      balance,
      originalBalance: Math.max(balance, paidTotal + balance, Math.round(Number(item.originalBalance) || 0)),
      annualRate: Math.max(0, Number(item.annualRate) || 0),
      minimumPayment: Math.max(0, Math.round(Number(item.minimumPayment) || 0)),
      dueDay: Number.isInteger(Number(item.dueDay)) && Number(item.dueDay) >= 1 && Number(item.dueDay) <= 31
        ? Number(item.dueDay) : null,
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
  const incomes = (Array.isArray(value.incomes) ? value.incomes : []).map((item) => ({
    ...item,
    amount: Math.max(0, Math.round(Number(item.amount) || 0)),
    kind: item.kind === "monthly" ? "monthly" : "one-time",
    date: typeof item.date === "string" ? item.date : "",
    day: Number.isInteger(Number(item.day)) && Number(item.day) >= 1 && Number(item.day) <= 31 ? Number(item.day) : null,
    startMonth: typeof item.startMonth === "string" ? item.startMonth : "",
    source: item.source === "bank" ? "bank" : "manual",
  }));
  const savingsGoals = (Array.isArray(value.savingsGoals) ? value.savingsGoals : []).map((item) => ({
    ...item,
    target: Math.max(0, Math.round(Number(item.target) || 0)),
    saved: Math.max(0, Math.round(Number(item.saved) || 0)),
    monthlyContribution: Math.max(0, Math.round(Number(item.monthlyContribution) || 0)),
    dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
    startMonth: typeof item.startMonth === "string" ? item.startMonth : "",
  }));
  const categoryBudgets = {};
  for (const category of KhnayikFinance.categories) categoryBudgets[category] = Math.max(0, Math.round(Number(value.categoryBudgets?.[category]) || 0));
  return {
    salary: Math.max(0, Number(value.salary || 0)),
    salaryMode,
    salaryDay,
    fixedExpenses,
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    recurringTasks: Array.isArray(value.recurringTasks) ? value.recurringTasks : [],
    scheduledTasks: Array.isArray(value.scheduledTasks) ? value.scheduledTasks : [],
    debts,
    debtPayments: Array.isArray(value.debtPayments) ? value.debtPayments : [],
    debtSettings: {
      strategy: ["smart", "avalanche", "snowball"].includes(debtSettings.strategy) ? debtSettings.strategy : "smart",
      safetyReserve: Math.max(0, Math.round(Number(debtSettings.safetyReserve) || 0)),
    },
    incomes,
    savingsGoals,
    categoryBudgets,
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
    const extraIncome = KhnayikFinance.incomeForMonth(state.incomes, key);
    const savings = monthlySavingsContribution(key);
    const spent = monthlySpent.get(key) || 0;
    const debtPaid = monthlyDebtPaid.get(key) || 0;
    return [key, budget.salary, extraIncome, fixed, savings, spent, debtPaid, budget.salary + extraIncome - fixed - savings - spent - debtPaid];
  });
  const tasks = [
    ["Անուն", "Տեսակ", "Ժամ", "Հիշեցում"],
    ...state.scheduledTasks.map((task) => [task.title, "Մեկանգամյա", new Date(`${task.date}T${task.time}`), task.reminder ? "Այո" : "Ոչ"]),
    ...state.recurringTasks.map((task) => [task.title, "Կրկնվող", `${formatDays(task.days)} ${task.time}`, task.reminder ? "Այո" : "Ոչ"]),
  ];
  const projectionInputs = debtPlanInputs();
  const debtProjection = KhnayikDebt.analyze({
    debts: state.debts,
    available: projectionInputs.available,
    recurringAvailable: projectionInputs.recurringAvailable,
    strategy: state.debtSettings.strategy,
  }).selected.payoffDates;
  const tables = [
    { name: "Ծախսեր", rows: expenseRows() },
    { name: "Ֆիքսված ծախսեր", rows: [["Անուն", "Գումար", "Վճարման օր", "Հիշեցում", "Վճարված ամիսներ"],
      ...state.fixedExpenses.map((item) => [item.title, item.amount, item.dueDay || "", item.reminder ? "2 օր շուտ" : "Ոչ", (item.paidMonths || []).join(", ")])] },
    { name: "Պարտքեր", rows: [["Անուն", "Մնացորդ", "Տարեկան տոկոս", "Նվազագույն վճար", "Վճարման օր", "Պլանային փակում", "Կարգավիճակ"],
      ...state.debts.map((debt) => [debt.title, debt.balance, debt.annualRate, debt.minimumPayment, debt.dueDay || "",
        debtProjection?.[debt.id] ? new Date(debtProjection[debt.id]) : "", debt.balance ? "Ակտիվ" : "Փակված"])] },
    { name: "Պարտքի վճարումներ", rows: [["Պարտք", "Գումար", "Ամսաթիվ"],
      ...state.debtPayments.map((payment) => [payment.title, payment.amount, new Date(payment.createdAt)])] },
    { name: "Եկամուտներ", rows: [["Անուն", "Գումար", "Տեսակ", "Ամսաթիվ կամ օր", "Աղբյուր"],
      ...state.incomes.map((income) => [income.title, income.amount, income.kind === "monthly" ? "Ամենամսյա" : "Մեկանգամյա",
        income.kind === "monthly" ? income.day : income.date, income.source || "manual"])] },
    { name: "Խնայողության նպատակներ", rows: [["Նպատակ", "Թիրախ", "Կուտակված", "Ամսական ներդրում", "Ցանկալի ամսաթիվ"],
      ...state.savingsGoals.map((goal) => [goal.title, goal.target, goal.saved, goal.monthlyContribution, goal.dueDate || ""])] },
    { name: "Կատեգորիաների բյուջե", rows: [["Կատեգորիա", "Ամսական սահմանաչափ"],
      ...KhnayikFinance.categories.map((category) => [category, Number(state.categoryBudgets[category] || 0)])] },
    { name: "Գործեր", rows: tasks },
    { name: "Ամիսներ", rows: [["Ամիս", "Աշխատավարձ", "Այլ եկամուտ", "Ֆիքսված", "Խնայողություն", "Ծախս", "Պարտքի վճարում", "Մնացորդ"], ...months] },
  ];
  downloadBlob(KhnayikExport.workbook(tables), `khnayik-${getDateKey(new Date())}.xlsx`);
  els.excelNote.textContent = "Excel ֆայլը պատրաստ է։";
}

function exportBackup() {
  const payload = { app: "Խնայիկ", version: 2, exportedAt: new Date().toISOString(), state };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `khnayik-backup-${getDateKey(new Date())}.json`);
  els.backupNote.textContent = "Ամբողջական պահուստը պատրաստ է։ Պահեք ֆայլը անվտանգ վայրում։";
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error("too-large");
    const parsed = JSON.parse(await file.text());
    const raw = parsed?.state ?? parsed;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid");
    if (!window.confirm("Վերականգնումը կփոխարինի Խնայիկի ներկայիս բոլոր տվյալները։ Շարունակե՞լ։")) return;
    const restored = normalizeState(raw);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, restored);
    ensureCurrentMonthBudget();
    if (saveState() === false) throw new Error("save");
    pendingImports = [];
    render();
    els.backupNote.textContent = "Տվյալները հաջողությամբ վերականգնվեցին։";
  } catch {
    showMessage("Պահուստային ֆայլը հնարավոր չէ կարդալ կամ այն վնասված է։");
  } finally {
    event.target.value = "";
  }
}

async function loadBankStatement(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const rows = KhnayikFinance.parseStatement(await file.text());
    const known = new Set([
      ...state.expenses.map((item) => item.externalKey).filter(Boolean),
      ...state.incomes.map((item) => item.externalKey).filter(Boolean),
    ]);
    pendingImports = rows.filter((row) => {
      if (known.has(row.externalKey)) return false;
      known.add(row.externalKey);
      return true;
    });
    renderImportPreview();
    els.importNote.textContent = rows.length
      ? `${rows.length} գործարք ճանաչվեց, ${rows.length - pendingImports.length} կրկնություն բաց թողնվեց։`
      : "Ֆայլում ճանաչելի գործարք չգտնվեց։ Ստուգեք սյունակների անվանումները։";
  } catch {
    pendingImports = [];
    renderImportPreview();
    showMessage("Քաղվածքը հնարավոր չէ կարդալ։ Օգտագործեք UTF-8 CSV կամ TSV ֆայլ։");
  } finally {
    event.target.value = "";
  }
}

function renderImportPreview() {
  els.importPreview.innerHTML = "";
  els.confirmImportBtn.hidden = !pendingImports.length;
  pendingImports.slice(0, 100).forEach((item, index) => {
    const row = document.createElement("article"); row.className = "import-item";
    const label = document.createElement("label");
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = true; checkbox.dataset.importIndex = String(index);
    const copy = document.createElement("span"); copy.className = "import-item-copy"; copy.innerHTML = `<strong></strong><small></small>`;
    copy.querySelector("strong").textContent = item.title;
    copy.querySelector("small").textContent = `${item.date} · ${item.kind === "expense" ? item.category : "Եկամուտ"}`;
    label.append(checkbox, copy);
    const amount = document.createElement("b"); amount.textContent = `${item.kind === "income" ? "+" : "−"}${formatMoney(item.amount)}`;
    row.append(label, amount); els.importPreview.append(row);
  });
  if (pendingImports.length > 100) {
    const note = document.createElement("p"); note.className = "backup-note"; note.textContent = `Ցուցադրված են առաջին 100 գործարքները ${pendingImports.length}-ից։`; els.importPreview.append(note);
  }
}

function confirmBankImport() {
  const selected = [...els.importPreview.querySelectorAll("input[data-import-index]:checked")]
    .map((input) => pendingImports[Number(input.dataset.importIndex)]).filter(Boolean);
  if (!selected.length) return showMessage("Ընտրեք առնվազն մեկ գործարք։");
  for (const item of selected) {
    if (item.kind === "expense") state.expenses.push({
      id: crypto.randomUUID(), title: item.title, amount: item.amount, category: item.category,
      createdAt: new Date(`${item.date}T12:00:00`).toISOString(), source: "bank", externalKey: item.externalKey,
    });
    else state.incomes.push({
      id: crypto.randomUUID(), title: item.title, amount: item.amount, kind: "one-time", date: item.date,
      day: null, startMonth: item.date.slice(0, 7), source: "bank", externalKey: item.externalKey, createdAt: new Date().toISOString(),
    });
  }
  state.expenses.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  pendingImports = [];
  if (saveState() === false) return;
  render();
  renderImportPreview();
  els.importNote.textContent = `${selected.length} գործարք գրանցվեց։`;
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
  const debtReminders = state.debts.filter((debt) => debt.balance > 0 && debt.dueDay).map((debt) => ({
    ...debt,
    title: `Պարտքի վճարման օր՝ ${debt.title}`,
    time: "09:00",
    leadMinutes: 1440,
  }));
  const fixedReminders = state.fixedExpenses.filter((item) => item.dueDay).map((item) => ({
    ...item,
    title: `Ֆիքսված ծախս՝ ${item.title}`,
    time: "09:00",
    leadMinutes: 2880,
    paidMonths: item.paidMonths,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  for (const [type, tasks] of [["scheduled", state.scheduledTasks], ["recurring", state.recurringTasks], ["debt", debtReminders], ["fixed", fixedReminders]]) {
    for (const task of tasks) {
      let occurrence = KhnayikReminderTime.next(task, type, from, defaultZone);
      while (occurrence && occurrence.at <= now) {
        if (!state.notified[occurrence.key]) {
          const heading = type === "debt" ? "Պարտքի հիշեցում" : type === "fixed" ? "Ֆիքսված ծախսի հիշեցում" : "Գործի հիշեցում";
          notifyTask(task.title, heading);
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
  for (const item of state.incomes) {
    if (item.kind === "one-time" && item.date) months.add(item.date.slice(0, 7));
    else if (item.startMonth) months.add(item.startMonth);
  }
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
  return [...months].sort().reverse().map((key) => ({ key, label: formatArmenianMonth(new Date(`${key}-01T12:00`)) }));
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

function formatArmenianMonth(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${armenianMonths[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTaskDate(value) {
  const date = new Date(`${value}T00:00`);
  return `${date.getDate()} ${armenianShortMonths[date.getMonth()]}`;
}

function formatReminderAt(value) {
  const date = new Date(value);
  return `${date.getDate()} ${armenianShortMonths[date.getMonth()]}, ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}

function formatDate(value) {
  const date = new Date(value);
  return `${date.getDate()} ${armenianShortMonths[date.getMonth()]} ${date.getFullYear()}, ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
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

function showMessage(message, type = "error") {
  window.clearTimeout(messageTimer);
  els.appMessage.textContent = message;
  els.appMessage.classList.toggle("is-success", type === "success");
  els.appMessage.hidden = false;
  tg?.HapticFeedback?.notificationOccurred?.(type === "success" ? "success" : "error");
  messageTimer = window.setTimeout(() => { els.appMessage.hidden = true; }, 5000);
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
