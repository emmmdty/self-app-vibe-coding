import { describe, expect, it } from "vitest";

import {
  addTask,
  computeNextDueDate,
  countTasks,
  filterTasksByList,
  listActiveCount,
  toggleTaskCompletion
} from "../../src/state";
import type { Task } from "../../src/types";

function mockTask(overrides: Partial<Task> = {}): Task {
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

describe("state", () => {
  it("adds new task to top with target list id", () => {
    const existing = mockTask({ id: "task-old", text: "旧任务" });
    const next = addTask([existing], "新任务", "list-custom");

    expect(next[0].text).toBe("新任务");
    expect(next[0].listId).toBe("list-custom");
    expect(next[1].id).toBe("task-old");
  });

  it("filters smart lists", () => {
    const tasks = [
      mockTask({ id: "1", myDay: true }),
      mockTask({ id: "2", important: true }),
      mockTask({ id: "3", dueDate: "2026-03-10" })
    ];

    expect(filterTasksByList(tasks, "my-day").map((task) => task.id)).toEqual(["1"]);
    expect(filterTasksByList(tasks, "important").map((task) => task.id)).toEqual(["2"]);
    expect(filterTasksByList(tasks, "planned").map((task) => task.id)).toEqual(["3"]);
  });

  it("re-schedules repeating tasks when marked completed", () => {
    const tasks = [
      mockTask({
        id: "task-r",
        dueDate: "2026-03-05",
        repeat: "daily",
        reminderAt: "2026-03-05T09:00:00.000Z"
      })
    ];

    const next = toggleTaskCompletion(tasks, "task-r", true);
    expect(next[0].completed).toBe(false);
    expect(next[0].dueDate).toBe("2026-03-06");
    expect(next[0].reminderAt).toContain("T09:00:00.000Z");
  });

  it("advances weekday repeat correctly from friday", () => {
    expect(computeNextDueDate("2026-03-06", "weekdays")).toBe("2026-03-09");
  });

  it("counts active/completed by list", () => {
    const tasks = [
      mockTask({ id: "1", myDay: true }),
      mockTask({ id: "2", myDay: true, completed: true }),
      mockTask({ id: "3", important: true })
    ];

    expect(countTasks(tasks)).toEqual({ activeCount: 2, completedCount: 1 });
    expect(listActiveCount(tasks, "my-day")).toBe(1);
  });
});
