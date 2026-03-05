import { describe, expect, it } from "vitest";

import { dueReminderTaskIds, markTasksAsNotified } from "../../src/reminder";
import type { Task } from "../../src/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    listId: "list-default",
    text: "任务",
    completed: false,
    createdAt: 1,
    completedAt: null,
    important: false,
    myDay: false,
    dueDate: null,
    reminderAt: null,
    repeat: "none",
    notes: "",
    steps: [],
    lastNotifiedAt: null,
    ...overrides
  };
}

describe("reminder", () => {
  it("finds due reminders that were not notified yet", () => {
    const tasks = [
      makeTask({ id: "a", reminderAt: "2026-03-05T01:00:00.000Z" }),
      makeTask({ id: "b", reminderAt: "2026-03-05T05:00:00.000Z" }),
      makeTask({ id: "c", reminderAt: "2026-03-05T01:00:00.000Z", completed: true })
    ];

    const due = dueReminderTaskIds(tasks, new Date("2026-03-05T03:00:00.000Z").valueOf());
    expect(due).toEqual(["a"]);
  });

  it("marks notified tasks", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    const marked = markTasksAsNotified(tasks, ["a"], "2026-03-05T03:00:00.000Z");
    expect(marked[0].lastNotifiedAt).toBe("2026-03-05T03:00:00.000Z");
    expect(marked[1].lastNotifiedAt).toBeNull();
  });
});
