import type { RepeatRule, SmartListId, SortMode, Step, Task, TaskCounts } from "./types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function combineDateWithTime(dateKey: string, sourceDateTime: string | null): string | null {
  if (!sourceDateTime) {
    return null;
  }

  const source = new Date(sourceDateTime);
  if (Number.isNaN(source.valueOf())) {
    return null;
  }

  const date = parseDateKey(dateKey);
  if (!date) {
    return null;
  }

  const combined = new Date(date);
  combined.setHours(source.getHours(), source.getMinutes(), 0, 0);
  return combined.toISOString();
}

function addMonths(date: Date, count: number): Date {
  const sourceDay = date.getDate();
  const temp = new Date(date);
  temp.setDate(1);
  temp.setMonth(temp.getMonth() + count);
  const lastDayOfMonth = new Date(temp.getFullYear(), temp.getMonth() + 1, 0).getDate();
  temp.setDate(Math.min(sourceDay, lastDayOfMonth));
  return temp;
}

export function isSmartListId(value: string): value is SmartListId {
  return value === "my-day" || value === "important" || value === "planned" || value === "tasks";
}

export function createTask(text: string, listId: string, createdAt = Date.now()): Task {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("Task text cannot be empty");
  }

  return {
    id: createId("task"),
    listId,
    text: normalizedText,
    completed: false,
    createdAt,
    completedAt: null,
    important: false,
    myDay: false,
    dueDate: null,
    reminderAt: null,
    repeat: "none",
    notes: "",
    steps: [],
    lastNotifiedAt: null
  };
}

export function createStep(text: string): Step {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("Step text cannot be empty");
  }

  return {
    id: createId("step"),
    text: normalizedText,
    completed: false
  };
}

export function addTask(tasks: Task[], text: string, listId: string): Task[] {
  return [createTask(text, listId), ...tasks];
}

export function patchTask(tasks: Task[], taskId: string, patch: Partial<Task>): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return { ...task, ...patch };
  });
}

export function computeNextDueDate(dueDate: string, repeat: RepeatRule): string | null {
  const base = parseDateKey(dueDate);
  if (!base || repeat === "none") {
    return null;
  }

  const nextDate = new Date(base);
  if (repeat === "daily") {
    nextDate.setDate(nextDate.getDate() + 1);
    return toDateKey(nextDate);
  }

  if (repeat === "weekdays") {
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
    return toDateKey(nextDate);
  }

  if (repeat === "weekly") {
    nextDate.setDate(nextDate.getDate() + 7);
    return toDateKey(nextDate);
  }

  return toDateKey(addMonths(nextDate, 1));
}

export function toggleTaskCompletion(tasks: Task[], taskId: string, completed = true, nowMs = Date.now()): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    if (!completed) {
      return { ...task, completed: false, completedAt: null };
    }

    if (task.repeat !== "none" && task.dueDate) {
      const nextDueDate = computeNextDueDate(task.dueDate, task.repeat);
      return {
        ...task,
        completed: false,
        completedAt: null,
        dueDate: nextDueDate,
        reminderAt: nextDueDate ? combineDateWithTime(nextDueDate, task.reminderAt) : null,
        lastNotifiedAt: null
      };
    }

    return { ...task, completed: true, completedAt: nowMs };
  });
}

export function deleteTaskById(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((task) => task.id !== taskId);
}

export function addStepToTask(tasks: Task[], taskId: string, stepText: string): Task[] {
  const step = createStep(stepText);
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return { ...task, steps: [...task.steps, step] };
  });
}

export function toggleStep(tasks: Task[], taskId: string, stepId: string): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      steps: task.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              completed: !step.completed
            }
          : step
      )
    };
  });
}

export function removeStep(tasks: Task[], taskId: string, stepId: string): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      steps: task.steps.filter((step) => step.id !== stepId)
    };
  });
}

export function filterTasksByList(tasks: Task[], listId: string): Task[] {
  if (listId === "my-day") {
    return tasks.filter((task) => task.myDay);
  }

  if (listId === "important") {
    return tasks.filter((task) => task.important);
  }

  if (listId === "planned") {
    return tasks.filter((task) => task.dueDate !== null);
  }

  if (listId === "tasks") {
    return [...tasks];
  }

  return tasks.filter((task) => task.listId === listId);
}

function dateForSort(task: Task): number {
  if (!task.dueDate) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = parseDateKey(task.dueDate);
  return parsed ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
}

export function sortTasks(tasks: Task[], sortMode: SortMode): Task[] {
  const next = [...tasks];
  next.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    if (sortMode === "created-asc") {
      return a.createdAt - b.createdAt;
    }

    if (sortMode === "due-asc") {
      const dueDelta = dateForSort(a) - dateForSort(b);
      if (dueDelta !== 0) {
        return dueDelta;
      }
      return b.createdAt - a.createdAt;
    }

    return b.createdAt - a.createdAt;
  });
  return next;
}

export function listActiveCount(tasks: Task[], listId: string): number {
  return filterTasksByList(tasks, listId).filter((task) => !task.completed).length;
}

export function countTasks(tasks: Task[]): TaskCounts {
  let completedCount = 0;
  for (const task of tasks) {
    if (task.completed) {
      completedCount += 1;
    }
  }

  return {
    activeCount: tasks.length - completedCount,
    completedCount
  };
}
