import type { AppPrefs, AppState, RepeatRule, SortMode, Step, Task, TaskList, ViewportMode } from "./types";

const STATE_STORAGE_KEY = "todo.state.v2";
export const TASKS_STORAGE_KEY = "todo.tasks.v1";
export const PREFS_STORAGE_KEY = "todo.prefs.v1";

export const DEFAULT_THEME_COLOR = "#2f80ed";
export const DEFAULT_VIEWPORT_MODE: ViewportMode = "desktop";
export const DEFAULT_USER_LIST_ID = "list-default";
export const DEFAULT_SELECTED_LIST_ID = "my-day";

const VIEWPORT_MODE_SET: Set<ViewportMode> = new Set(["desktop", "tablet", "mobile"]);
const SORT_MODE_SET: Set<SortMode> = new Set(["created-desc", "created-asc", "due-asc"]);
const REPEAT_SET: Set<RepeatRule> = new Set(["none", "daily", "weekdays", "weekly", "monthly"]);

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  const hex3 = /^#([0-9a-fA-F]{3})$/;
  const hex6 = /^#([0-9a-fA-F]{6})$/;

  if (hex3.test(withHash)) {
    const [, shortValue] = withHash.match(hex3)!;
    const expanded = shortValue
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded}`.toLowerCase();
  }

  if (hex6.test(withHash)) {
    return withHash.toLowerCase();
  }

  return null;
}

export function createDefaultLists(): TaskList[] {
  return [
    { id: "my-day", name: "My Day", isSmart: true, order: 0 },
    { id: "important", name: "Important", isSmart: true, order: 1 },
    { id: "planned", name: "Planned", isSmart: true, order: 2 },
    { id: "tasks", name: "Tasks", isSmart: true, order: 3 },
    { id: DEFAULT_USER_LIST_ID, name: "个人", isSmart: false, order: 100 }
  ];
}

export function createDefaultPrefs(): AppPrefs {
  return {
    themeColor: DEFAULT_THEME_COLOR,
    viewportMode: DEFAULT_VIEWPORT_MODE,
    notificationEnabled: false,
    sortMode: "created-desc",
    layoutMode: "comfortable"
  };
}

export function createDefaultState(): AppState {
  return {
    tasks: [],
    lists: createDefaultLists(),
    selectedListId: DEFAULT_SELECTED_LIST_ID,
    selectedTaskId: null,
    prefs: createDefaultPrefs()
  };
}

function isTaskRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return true;
}

function sanitizeStep(value: unknown): Step | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<Step>;
  if (typeof record.id !== "string" || typeof record.text !== "string" || typeof record.completed !== "boolean") {
    return null;
  }

  const text = record.text.trim();
  if (!text) {
    return null;
  }

  return { id: record.id, text, completed: record.completed };
}

function sanitizeTask(value: unknown): Task | null {
  if (!isTaskRecord(value)) {
    return null;
  }

  const record = value as Partial<Task> & Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.text !== "string" ||
    typeof record.completed !== "boolean" ||
    typeof record.createdAt !== "number"
  ) {
    return null;
  }

  const text = record.text.trim();
  if (!text) {
    return null;
  }

  const repeat =
    typeof record.repeat === "string" && REPEAT_SET.has(record.repeat as RepeatRule)
      ? (record.repeat as RepeatRule)
      : "none";

  const steps = Array.isArray(record.steps) ? record.steps.map(sanitizeStep).filter((step): step is Step => step !== null) : [];

  const dueDate =
    typeof record.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.dueDate) ? record.dueDate : null;
  const reminderAt =
    typeof record.reminderAt === "string" && !Number.isNaN(new Date(record.reminderAt).valueOf()) ? record.reminderAt : null;
  const lastNotifiedAt =
    typeof record.lastNotifiedAt === "string" && !Number.isNaN(new Date(record.lastNotifiedAt).valueOf())
      ? record.lastNotifiedAt
      : null;

  return {
    id: record.id,
    listId: typeof record.listId === "string" ? record.listId : DEFAULT_USER_LIST_ID,
    text,
    completed: record.completed,
    createdAt: record.createdAt,
    completedAt: typeof record.completedAt === "number" && Number.isFinite(record.completedAt) ? record.completedAt : null,
    important: Boolean(record.important),
    myDay: Boolean(record.myDay),
    dueDate,
    reminderAt,
    repeat,
    notes: typeof record.notes === "string" ? record.notes : "",
    steps,
    lastNotifiedAt
  };
}

function parseTaskArray(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(sanitizeTask).filter((task): task is Task => task !== null);
}

function sanitizeList(value: unknown): TaskList | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<TaskList>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.isSmart !== "boolean" ||
    typeof record.order !== "number"
  ) {
    return null;
  }

  const name = record.name.trim();
  if (!name) {
    return null;
  }

  return {
    id: record.id,
    name,
    isSmart: record.isSmart,
    order: record.order
  };
}

function parseListArray(value: unknown): TaskList[] {
  if (!Array.isArray(value)) {
    return createDefaultLists();
  }

  const lists = value.map(sanitizeList).filter((item): item is TaskList => item !== null);
  if (lists.length === 0) {
    return createDefaultLists();
  }

  return lists;
}

function parsePrefs(value: unknown): AppPrefs {
  const fallback: AppPrefs = createDefaultPrefs();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Partial<AppPrefs>;
  const normalizedColor = typeof record.themeColor === "string" ? normalizeHexColor(record.themeColor) : null;
  const mode =
    typeof record.viewportMode === "string" && VIEWPORT_MODE_SET.has(record.viewportMode as ViewportMode)
      ? (record.viewportMode as ViewportMode)
      : DEFAULT_VIEWPORT_MODE;
  const sortMode =
    typeof record.sortMode === "string" && SORT_MODE_SET.has(record.sortMode as SortMode)
      ? (record.sortMode as SortMode)
      : fallback.sortMode;

  return {
    themeColor: normalizedColor ?? DEFAULT_THEME_COLOR,
    viewportMode: mode,
    notificationEnabled: Boolean(record.notificationEnabled),
    sortMode,
    layoutMode: record.layoutMode === "compact" ? "compact" : "comfortable"
  };
}

function loadLegacyTasks(): Task[] {
  try {
    const serialized = window.localStorage.getItem(TASKS_STORAGE_KEY);
    if (!serialized) {
      return [];
    }

    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): Task | null => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as { id?: unknown; text?: unknown; completed?: unknown; createdAt?: unknown };
        if (
          typeof record.id !== "string" ||
          typeof record.text !== "string" ||
          typeof record.completed !== "boolean" ||
          typeof record.createdAt !== "number"
        ) {
          return null;
        }

        return {
          id: record.id,
          listId: DEFAULT_USER_LIST_ID,
          text: record.text.trim(),
          completed: record.completed,
          createdAt: record.createdAt,
          completedAt: record.completed ? record.createdAt : null,
          important: false,
          myDay: false,
          dueDate: null as string | null,
          reminderAt: null as string | null,
          repeat: "none" as const,
          notes: "",
          steps: [] as Step[],
          lastNotifiedAt: null as string | null
        };
      })
      .filter((task): task is Task => task !== null && task.text.length > 0);
  } catch {
    return [];
  }
}

function loadLegacyPrefs(): AppPrefs {
  try {
    const serialized = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!serialized) {
      return createDefaultPrefs();
    }
    return parsePrefs(JSON.parse(serialized));
  } catch {
    return createDefaultPrefs();
  }
}

function migrateLegacyState(): AppState {
  const defaultState = createDefaultState();
  const migratedTasks = loadLegacyTasks();
  const migratedPrefs = loadLegacyPrefs();
  return {
    ...defaultState,
    tasks: migratedTasks,
    prefs: migratedPrefs,
    selectedListId: migratedTasks.length > 0 ? "tasks" : defaultState.selectedListId
  };
}

function sanitizeState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const defaultState = createDefaultState();
  const record = value as Partial<AppState>;
  const lists = parseListArray(record.lists);
  const tasks = parseTaskArray(record.tasks);
  const prefs = parsePrefs(record.prefs);
  const selectedListId =
    typeof record.selectedListId === "string" && lists.some((list) => list.id === record.selectedListId)
      ? record.selectedListId
      : defaultState.selectedListId;
  const selectedTaskId =
    typeof record.selectedTaskId === "string" && tasks.some((task) => task.id === record.selectedTaskId)
      ? record.selectedTaskId
      : null;

  return { tasks, lists, prefs, selectedListId, selectedTaskId };
}

export function loadState(): AppState {
  try {
    const serialized = window.localStorage.getItem(STATE_STORAGE_KEY);
    if (serialized) {
      const parsed = sanitizeState(JSON.parse(serialized));
      if (parsed) {
        return parsed;
      }
    }

    const migrated = migrateLegacyState();
    saveState(migrated);
    return migrated;
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in private/restricted contexts.
  }
}
