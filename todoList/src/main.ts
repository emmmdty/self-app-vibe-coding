import "./styles.css";

import {
  addStepToTask,
  addTask,
  countTasks,
  deleteTaskById,
  filterTasksByList,
  isSmartListId,
  listActiveCount,
  patchTask,
  removeStep,
  sortTasks,
  toggleStep,
  toggleTaskCompletion
} from "./state";
import { canUseSystemNotification, dueReminderTaskIds, markTasksAsNotified, maybeSendSystemNotification, scheduleReminderLoop } from "./reminder";
import { DEFAULT_SELECTED_LIST_ID, DEFAULT_USER_LIST_ID, loadState, saveState } from "./storage";
import { applyThemeColor } from "./theme";
import type { AppState, Task, TaskList } from "./types";
import { applyViewportMode, isViewportMode, setViewportButtonsActive } from "./viewport";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function createListId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `list-${crypto.randomUUID()}`;
  }
  return `list-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDatetimeLocal(isoDate: string | null): string {
  if (!isoDate) {
    return "";
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
}

function getListDisplayName(list: TaskList): string {
  if (!list.isSmart) {
    return list.name;
  }
  if (list.id === "my-day") {
    return "My Day";
  }
  if (list.id === "important") {
    return "Important";
  }
  if (list.id === "planned") {
    return "Planned";
  }
  return "Tasks";
}

const elements = {
  appFrame: required<HTMLElement>("#app-frame"),
  themeColor: required<HTMLInputElement>("#theme-color"),
  viewportButtons: document.querySelectorAll<HTMLButtonElement>(".viewport-btn"),
  notificationToggle: required<HTMLButtonElement>("#notification-toggle"),
  smartLists: required<HTMLUListElement>("#smart-lists"),
  customLists: required<HTMLUListElement>("#custom-lists"),
  listForm: required<HTMLFormElement>("#list-form"),
  listInput: required<HTMLInputElement>("#list-input"),
  currentListTitle: required<HTMLElement>("#current-list-title"),
  activeCount: required<HTMLElement>("#active-count"),
  completedCount: required<HTMLElement>("#completed-count"),
  sortMode: required<HTMLSelectElement>("#sort-mode"),
  taskForm: required<HTMLFormElement>("#task-form"),
  taskInput: required<HTMLInputElement>("#task-input"),
  taskList: required<HTMLUListElement>("#task-list"),
  emptyTip: required<HTMLElement>("#empty-tip"),
  detailPane: required<HTMLElement>("#detail-pane"),
  detailEmpty: required<HTMLElement>("#detail-empty"),
  detailContent: required<HTMLElement>("#detail-content"),
  detailCompleted: required<HTMLInputElement>("#detail-completed"),
  detailTitle: required<HTMLInputElement>("#detail-title"),
  detailImportant: required<HTMLButtonElement>("#detail-important"),
  detailMyDay: required<HTMLButtonElement>("#detail-myday"),
  detailDueDate: required<HTMLInputElement>("#detail-due-date"),
  detailReminder: required<HTMLInputElement>("#detail-reminder"),
  detailRepeat: required<HTMLSelectElement>("#detail-repeat"),
  detailNotes: required<HTMLTextAreaElement>("#detail-notes"),
  stepsList: required<HTMLUListElement>("#steps-list"),
  stepForm: required<HTMLFormElement>("#step-form"),
  stepInput: required<HTMLInputElement>("#step-input"),
  detailDelete: required<HTMLButtonElement>("#detail-delete"),
  toastStack: required<HTMLElement>("#toast-stack")
};

let state: AppState = loadState();
let reminderTimer: number | null = null;

function persist(nextState: AppState): void {
  state = nextState;
  saveState(state);
}

function updateTasks(nextTasks: Task[]): void {
  persist({ ...state, tasks: nextTasks });
}

function updateLists(nextLists: TaskList[]): void {
  persist({ ...state, lists: nextLists });
}

function updatePrefs<K extends keyof AppState["prefs"]>(key: K, value: AppState["prefs"][K]): void {
  persist({ ...state, prefs: { ...state.prefs, [key]: value } });
}

function setSelectedList(listId: string): void {
  const visibleIds = new Set(getVisibleTasks(listId).map((task) => task.id));
  const selectedTaskId = state.selectedTaskId && visibleIds.has(state.selectedTaskId) ? state.selectedTaskId : null;
  persist({ ...state, selectedListId: listId, selectedTaskId });
}

function setSelectedTask(taskId: string | null): void {
  persist({ ...state, selectedTaskId: taskId });
}

function getVisibleTasks(listId = state.selectedListId): Task[] {
  return sortTasks(filterTasksByList(state.tasks, listId), state.prefs.sortMode);
}

function getSelectedTask(): Task | null {
  if (!state.selectedTaskId) {
    return null;
  }
  return state.tasks.find((task) => task.id === state.selectedTaskId) ?? null;
}

function pushToast(message: string, actionLabel?: string, action?: () => void): void {
  const toast = document.createElement("div");
  toast.className = "toast";

  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);

  if (actionLabel && action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      action();
      toast.remove();
    });
    toast.append(button);
  }

  elements.toastStack.append(toast);
  window.setTimeout(() => toast.remove(), 4500);
}

function renderLists(): void {
  const sorted = [...state.lists].sort((a, b) => a.order - b.order);
  const smartLists = sorted.filter((list) => list.isSmart);
  const customLists = sorted.filter((list) => !list.isSmart);

  elements.smartLists.innerHTML = "";
  elements.customLists.innerHTML = "";

  const renderListButton = (list: TaskList, parent: HTMLElement) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-item-btn";
    button.dataset.listId = list.id;
    if (state.selectedListId === list.id) {
      button.classList.add("is-active");
    }

    const name = document.createElement("span");
    name.textContent = getListDisplayName(list);

    const count = document.createElement("span");
    count.className = "nav-item-count";
    count.textContent = String(listActiveCount(state.tasks, list.id));

    button.append(name, count);
    item.append(button);
    parent.append(item);
  };

  smartLists.forEach((list) => renderListButton(list, elements.smartLists));
  customLists.forEach((list) => renderListButton(list, elements.customLists));
}

function formatDateLabel(task: Task): string | null {
  if (!task.dueDate) {
    return null;
  }
  const parsed = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric"
  });
}

function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || task.completed) {
    return false;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  const todayKey = `${year}-${month}-${day}`;
  return task.dueDate < todayKey;
}

function renderTaskList(): void {
  const visibleTasks = getVisibleTasks();
  const counts = countTasks(visibleTasks);
  const selectedList = state.lists.find((list) => list.id === state.selectedListId);

  elements.currentListTitle.textContent = selectedList ? getListDisplayName(selectedList) : "Tasks";
  elements.activeCount.textContent = String(counts.activeCount);
  elements.completedCount.textContent = String(counts.completedCount);

  elements.taskList.innerHTML = "";
  for (const task of visibleTasks) {
    const item = document.createElement("li");
    item.className = "task-item";
    item.dataset.taskId = task.id;
    item.classList.toggle("is-overdue", isTaskOverdue(task));
    item.classList.toggle("is-reminder-on", Boolean(task.reminderAt && !task.completed));
    if (state.selectedTaskId === task.id) {
      item.classList.add("is-selected");
    }

    const mainRow = document.createElement("div");
    mainRow.className = "task-row-main";

    const checkbox = document.createElement("input");
    checkbox.className = "task-check";
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.dataset.action = "toggle";
    checkbox.setAttribute("aria-label", `标记任务${task.text}完成`);

    const title = document.createElement("span");
    title.className = "task-title";
    if (task.completed) {
      title.classList.add("completed");
    }
    title.textContent = task.text;

    const star = document.createElement("button");
    star.type = "button";
    star.className = "star-btn";
    star.dataset.action = "star";
    if (task.important) {
      star.classList.add("is-on");
    }
    star.textContent = "★";
    star.setAttribute("aria-label", "切换重要标记");

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.dataset.action = "delete";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "删除任务");

    mainRow.append(checkbox, title, star, remove);

    const metaRow = document.createElement("div");
    metaRow.className = "task-meta";
    const dueLabel = formatDateLabel(task);
    if (dueLabel) {
      const chip = document.createElement("span");
      chip.className = "meta-chip";
      chip.classList.add("meta-chip--due");
      chip.textContent = `截止 ${dueLabel}`;
      metaRow.append(chip);
    }
    if (task.reminderAt) {
      const chip = document.createElement("span");
      chip.className = "meta-chip";
      chip.classList.add("meta-chip--reminder");
      chip.textContent = "提醒";
      metaRow.append(chip);
    }
    if (task.steps.length > 0) {
      const completedSteps = task.steps.filter((step) => step.completed).length;
      const chip = document.createElement("span");
      chip.className = "meta-chip";
      chip.classList.add("meta-chip--steps");
      chip.textContent = `步骤 ${completedSteps}/${task.steps.length}`;
      metaRow.append(chip);
    }

    item.append(mainRow);
    if (metaRow.childElementCount > 0) {
      item.append(metaRow);
    }
    elements.taskList.append(item);
  }

  elements.emptyTip.classList.toggle("is-hidden", visibleTasks.length > 0);
}

function renderDetailPane(): void {
  const task = getSelectedTask();
  if (!task) {
    elements.detailEmpty.classList.remove("is-hidden");
    elements.detailContent.classList.add("is-hidden");
    elements.detailPane.classList.remove("is-open");
    return;
  }

  elements.detailEmpty.classList.add("is-hidden");
  elements.detailContent.classList.remove("is-hidden");
  elements.detailPane.classList.add("is-open");

  elements.detailCompleted.checked = task.completed;
  elements.detailTitle.value = task.text;
  elements.detailImportant.classList.toggle("is-on", task.important);
  elements.detailMyDay.classList.toggle("is-on", task.myDay);
  elements.detailDueDate.value = task.dueDate ?? "";
  elements.detailReminder.value = toDatetimeLocal(task.reminderAt);
  elements.detailRepeat.value = task.repeat;
  elements.detailNotes.value = task.notes;

  elements.stepsList.innerHTML = "";
  task.steps.forEach((step) => {
    const item = document.createElement("li");
    item.className = "step-item";
    item.dataset.stepId = step.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = step.completed;
    checkbox.dataset.action = "toggle-step";

    const text = document.createElement("span");
    text.className = "step-text";
    if (step.completed) {
      text.classList.add("completed");
    }
    text.textContent = step.text;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.dataset.action = "delete-step";
    remove.textContent = "×";

    item.append(checkbox, text, remove);
    elements.stepsList.append(item);
  });
}

function renderPrefs(): void {
  const appliedColor = applyThemeColor(state.prefs.themeColor);
  elements.themeColor.value = appliedColor;

  applyViewportMode(elements.appFrame, state.prefs.viewportMode);
  setViewportButtonsActive(elements.viewportButtons, state.prefs.viewportMode);
  elements.sortMode.value = state.prefs.sortMode;

  elements.notificationToggle.classList.toggle("is-enabled", state.prefs.notificationEnabled);
  elements.notificationToggle.textContent = state.prefs.notificationEnabled ? "通知已开启" : "开启通知";
}

function renderAll(): void {
  renderPrefs();
  renderLists();
  renderTaskList();
  renderDetailPane();
}

function getTargetListIdForNewTask(): string {
  if (!isSmartListId(state.selectedListId)) {
    return state.selectedListId;
  }
  return DEFAULT_USER_LIST_ID;
}

function enrichNewTaskByContext(taskId: string): void {
  if (state.selectedListId === "my-day") {
    updateTasks(patchTask(state.tasks, taskId, { myDay: true }));
  } else if (state.selectedListId === "important") {
    updateTasks(patchTask(state.tasks, taskId, { important: true }));
  } else if (state.selectedListId === "planned") {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, "0");
    const day = `${today.getDate()}`.padStart(2, "0");
    updateTasks(patchTask(state.tasks, taskId, { dueDate: `${year}-${month}-${day}` }));
  }
}

function runReminderTick(): void {
  const dueTaskIds = dueReminderTaskIds(state.tasks);
  if (dueTaskIds.length === 0) {
    return;
  }

  const dueTasks = state.tasks.filter((task) => dueTaskIds.includes(task.id));
  for (const task of dueTasks) {
    pushToast(`提醒：${task.text}`, "查看", () => {
      setSelectedList("tasks");
      setSelectedTask(task.id);
      renderAll();
    });

    if (state.prefs.notificationEnabled) {
      maybeSendSystemNotification(task);
    }
  }

  updateTasks(markTasksAsNotified(state.tasks, dueTaskIds));
  renderAll();
}

function bindEvents(): void {
  elements.viewportButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.viewport;
      if (!mode || !isViewportMode(mode)) {
        return;
      }
      updatePrefs("viewportMode", mode);
      renderPrefs();
    });
  });

  elements.themeColor.addEventListener("input", () => {
    updatePrefs("themeColor", elements.themeColor.value);
    renderPrefs();
  });

  elements.notificationToggle.addEventListener("click", async () => {
    if (state.prefs.notificationEnabled) {
      updatePrefs("notificationEnabled", false);
      renderPrefs();
      return;
    }

    if (!canUseSystemNotification()) {
      pushToast("浏览器不支持系统通知，已使用应用内提醒。");
      return;
    }

    if (Notification.permission === "granted") {
      updatePrefs("notificationEnabled", true);
      renderPrefs();
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      updatePrefs("notificationEnabled", true);
    } else {
      pushToast("通知权限未授予，仍将使用应用内提醒。");
      updatePrefs("notificationEnabled", false);
    }
    renderPrefs();
  });

  elements.listForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.listInput.value.trim();
    if (!name) {
      return;
    }

    const list: TaskList = {
      id: createListId(),
      name,
      isSmart: false,
      order: Math.max(...state.lists.map((item) => item.order), 99) + 1
    };

    updateLists([...state.lists, list]);
    setSelectedList(list.id);
    elements.listInput.value = "";
    renderAll();
  });

  const onListClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>(".nav-item-btn");
    if (!button?.dataset.listId) {
      return;
    }
    setSelectedList(button.dataset.listId);
    renderAll();
  };
  elements.smartLists.addEventListener("click", onListClick);
  elements.customLists.addEventListener("click", onListClick);

  elements.sortMode.addEventListener("change", () => {
    updatePrefs("sortMode", elements.sortMode.value as AppState["prefs"]["sortMode"]);
    renderTaskList();
  });

  elements.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.taskInput.value.trim();
    if (!text) {
      return;
    }

    const nextTasks = addTask(state.tasks, text, getTargetListIdForNewTask());
    updateTasks(nextTasks);
    const taskId = nextTasks[0].id;
    setSelectedTask(taskId);
    enrichNewTaskByContext(taskId);
    elements.taskInput.value = "";
    renderAll();
  });

  elements.taskList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const item = target.closest<HTMLLIElement>(".task-item");
    if (!item?.dataset.taskId) {
      return;
    }
    const taskId = item.dataset.taskId;

    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement) {
      setSelectedTask(taskId);
      renderAll();
      return;
    }

    const action = actionElement.dataset.action;
    if (action === "toggle") {
      const checkbox = actionElement as HTMLInputElement;
      updateTasks(toggleTaskCompletion(state.tasks, taskId, checkbox.checked));
      renderAll();
      return;
    }

    if (action === "star") {
      const task = state.tasks.find((entry) => entry.id === taskId);
      if (!task) {
        return;
      }
      updateTasks(patchTask(state.tasks, taskId, { important: !task.important }));
      renderAll();
      return;
    }

    if (action === "delete") {
      updateTasks(deleteTaskById(state.tasks, taskId));
      if (state.selectedTaskId === taskId) {
        setSelectedTask(null);
      }
      renderAll();
    }
  });

  elements.detailCompleted.addEventListener("change", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(toggleTaskCompletion(state.tasks, task.id, elements.detailCompleted.checked));
    renderAll();
  });

  elements.detailTitle.addEventListener("input", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(patchTask(state.tasks, task.id, { text: elements.detailTitle.value }));
    renderTaskList();
  });

  elements.detailImportant.addEventListener("click", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(patchTask(state.tasks, task.id, { important: !task.important }));
    renderAll();
  });

  elements.detailMyDay.addEventListener("click", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(patchTask(state.tasks, task.id, { myDay: !task.myDay }));
    renderAll();
  });

  elements.detailDueDate.addEventListener("change", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    const nextDueDate = elements.detailDueDate.value || null;
    updateTasks(patchTask(state.tasks, task.id, { dueDate: nextDueDate }));
    renderTaskList();
  });

  elements.detailReminder.addEventListener("change", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(
      patchTask(state.tasks, task.id, {
        reminderAt: fromDatetimeLocal(elements.detailReminder.value),
        lastNotifiedAt: null
      })
    );
    renderTaskList();
  });

  elements.detailRepeat.addEventListener("change", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(
      patchTask(state.tasks, task.id, {
        repeat: elements.detailRepeat.value as Task["repeat"]
      })
    );
  });

  elements.detailNotes.addEventListener("input", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(patchTask(state.tasks, task.id, { notes: elements.detailNotes.value }));
  });

  elements.stepForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const task = getSelectedTask();
    const stepText = elements.stepInput.value.trim();
    if (!task || !stepText) {
      return;
    }
    updateTasks(addStepToTask(state.tasks, task.id, stepText));
    elements.stepInput.value = "";
    renderDetailPane();
    renderTaskList();
  });

  elements.stepsList.addEventListener("click", (event) => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const stepItem = target.closest<HTMLLIElement>(".step-item");
    if (!stepItem?.dataset.stepId) {
      return;
    }
    const stepId = stepItem.dataset.stepId;

    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;
    if (action === "toggle-step") {
      updateTasks(toggleStep(state.tasks, task.id, stepId));
      renderDetailPane();
      renderTaskList();
      return;
    }

    if (action === "delete-step") {
      updateTasks(removeStep(state.tasks, task.id, stepId));
      renderDetailPane();
      renderTaskList();
    }
  });

  elements.detailDelete.addEventListener("click", () => {
    const task = getSelectedTask();
    if (!task) {
      return;
    }
    updateTasks(deleteTaskById(state.tasks, task.id));
    setSelectedTask(null);
    renderAll();
  });
}

if (!state.lists.some((list) => list.id === DEFAULT_USER_LIST_ID)) {
  const nextLists = [...state.lists, { id: DEFAULT_USER_LIST_ID, name: "个人", isSmart: false, order: 100 }];
  updateLists(nextLists);
}

if (!state.lists.some((list) => list.id === state.selectedListId)) {
  setSelectedList(DEFAULT_SELECTED_LIST_ID);
}

bindEvents();
renderAll();
runReminderTick();
reminderTimer = scheduleReminderLoop(runReminderTick);

window.addEventListener("beforeunload", () => {
  if (reminderTimer !== null) {
    window.clearInterval(reminderTimer);
    reminderTimer = null;
  }
});
