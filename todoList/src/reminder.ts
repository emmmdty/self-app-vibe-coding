import type { Task } from "./types";

const REMINDER_SCAN_INTERVAL_MS = 30_000;

export function dueReminderTaskIds(tasks: Task[], nowMs = Date.now()): string[] {
  return tasks
    .filter((task) => {
      if (task.completed || !task.reminderAt) {
        return false;
      }

      const reminderMs = new Date(task.reminderAt).valueOf();
      if (Number.isNaN(reminderMs) || reminderMs > nowMs) {
        return false;
      }

      if (!task.lastNotifiedAt) {
        return true;
      }

      const lastMs = new Date(task.lastNotifiedAt).valueOf();
      return Number.isNaN(lastMs) || lastMs < reminderMs;
    })
    .map((task) => task.id);
}

export function markTasksAsNotified(tasks: Task[], taskIds: string[], nowIso = new Date().toISOString()): Task[] {
  if (taskIds.length === 0) {
    return tasks;
  }
  const idSet = new Set(taskIds);
  return tasks.map((task) => (idSet.has(task.id) ? { ...task, lastNotifiedAt: nowIso } : task));
}

export function canUseSystemNotification(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function maybeSendSystemNotification(task: Task): void {
  if (!canUseSystemNotification()) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification("任务提醒", {
      body: task.text
    });
  } catch {
    // ignore notification runtime errors
  }
}

export function scheduleReminderLoop(handler: () => void): number {
  return window.setInterval(handler, REMINDER_SCAN_INTERVAL_MS);
}
