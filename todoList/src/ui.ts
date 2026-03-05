import type { Task, TaskCounts, ViewportMode } from "./types";

export interface UiRefs {
  form: HTMLFormElement;
  taskInput: HTMLInputElement;
  taskList: HTMLUListElement;
  activeCount: HTMLElement;
  completedCount: HTMLElement;
  emptyTip: HTMLElement;
  themeColor: HTMLInputElement;
  appFrame: HTMLElement;
  viewportButtons: NodeListOf<HTMLButtonElement>;
  undoSnackbar: HTMLElement;
  undoText: HTMLElement;
  undoButton: HTMLButtonElement;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

export function getUiRefs(): UiRefs {
  return {
    form: required<HTMLFormElement>("#task-form"),
    taskInput: required<HTMLInputElement>("#task-input"),
    taskList: required<HTMLUListElement>("#task-list"),
    activeCount: required<HTMLElement>("#active-count"),
    completedCount: required<HTMLElement>("#completed-count"),
    emptyTip: required<HTMLElement>("#empty-tip"),
    themeColor: required<HTMLInputElement>("#theme-color"),
    appFrame: required<HTMLElement>("#app-frame"),
    viewportButtons: document.querySelectorAll<HTMLButtonElement>(".viewport-btn"),
    undoSnackbar: required<HTMLElement>("#undo-snackbar"),
    undoText: required<HTMLElement>("#undo-text"),
    undoButton: required<HTMLButtonElement>("#undo-btn")
  };
}

function createTaskListItem(task: Task): HTMLLIElement {
  const listItem = document.createElement("li");
  listItem.className = "task-item";
  listItem.dataset.taskId = task.id;

  const checkbox = document.createElement("input");
  checkbox.className = "task-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `标记任务“${task.text}”完成`);

  const text = document.createElement("span");
  text.className = "task-text";
  if (task.completed) {
    text.classList.add("completed");
  }
  text.textContent = task.text;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-btn";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", `删除任务“${task.text}”`);

  listItem.append(checkbox, text, deleteButton);
  return listItem;
}

export function renderTaskList(taskList: HTMLUListElement, tasks: Task[]): void {
  taskList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  tasks.forEach((task) => {
    fragment.append(createTaskListItem(task));
  });
  taskList.append(fragment);
}

export function renderCounts(activeCountElement: HTMLElement, completedCountElement: HTMLElement, counts: TaskCounts): void {
  activeCountElement.textContent = String(counts.activeCount);
  completedCountElement.textContent = String(counts.completedCount);
}

export function setEmptyTipVisible(emptyTipElement: HTMLElement, hasTasks: boolean): void {
  emptyTipElement.classList.toggle("is-hidden", hasTasks);
}

export function setViewportModeButtons(
  buttons: NodeListOf<HTMLButtonElement>,
  mode: ViewportMode
): void {
  buttons.forEach((button) => {
    const isActive = button.dataset.viewport === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

export function showUndoSnackbar(snackbar: HTMLElement, textElement: HTMLElement, message: string): void {
  textElement.textContent = message;
  snackbar.classList.add("is-visible");
  snackbar.setAttribute("aria-hidden", "false");
}

export function hideUndoSnackbar(snackbar: HTMLElement): void {
  snackbar.classList.remove("is-visible");
  snackbar.setAttribute("aria-hidden", "true");
}
