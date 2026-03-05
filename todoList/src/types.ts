export type ViewportMode = "desktop" | "tablet" | "mobile";

export type SmartListId = "my-day" | "important" | "planned" | "tasks";
export type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type SortMode = "created-desc" | "created-asc" | "due-asc";

export interface Step {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  listId: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
  important: boolean;
  myDay: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  repeat: RepeatRule;
  notes: string;
  steps: Step[];
  lastNotifiedAt: string | null;
}

export interface TaskList {
  id: string;
  name: string;
  isSmart: boolean;
  order: number;
}

export interface AppPrefs {
  themeColor: string;
  viewportMode: ViewportMode;
  notificationEnabled: boolean;
  sortMode: SortMode;
  layoutMode: "comfortable" | "compact";
}

export interface AppState {
  tasks: Task[];
  lists: TaskList[];
  selectedListId: string;
  selectedTaskId: string | null;
  prefs: AppPrefs;
}

export interface TaskCounts {
  activeCount: number;
  completedCount: number;
}
