import { beforeEach, describe, expect, it } from "vitest";

import {
  createDefaultState,
  DEFAULT_THEME_COLOR,
  DEFAULT_USER_LIST_ID,
  loadState,
  normalizeHexColor,
  PREFS_STORAGE_KEY,
  saveState,
  TASKS_STORAGE_KEY
} from "../../src/storage";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes hex colors", () => {
    expect(normalizeHexColor("2f80ed")).toBe("#2f80ed");
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor("bad-value")).toBeNull();
  });

  it("loads default state when storage is empty", () => {
    const state = loadState();
    expect(state.tasks).toEqual([]);
    expect(state.prefs.themeColor).toBe(DEFAULT_THEME_COLOR);
  });

  it("migrates v1 task/prefs data into v2", () => {
    window.localStorage.setItem(
      TASKS_STORAGE_KEY,
      JSON.stringify([{ id: "old-1", text: "旧任务", completed: false, createdAt: 100 }])
    );
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ themeColor: "#13a08e", viewportMode: "mobile" }));

    const state = loadState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe("old-1");
    expect(state.tasks[0].listId).toBe(DEFAULT_USER_LIST_ID);
    expect(state.prefs.themeColor).toBe("#13a08e");
    expect(state.prefs.viewportMode).toBe("mobile");
  });

  it("saves and restores v2 state", () => {
    const state = createDefaultState();
    state.tasks = [
      {
        id: "task-a",
        listId: DEFAULT_USER_LIST_ID,
        text: "测试",
        completed: false,
        createdAt: 1,
        completedAt: null,
        important: true,
        myDay: true,
        dueDate: "2026-03-10",
        reminderAt: null,
        repeat: "weekly",
        notes: "note",
        steps: [],
        lastNotifiedAt: null
      }
    ];

    saveState(state);
    expect(loadState().tasks[0].repeat).toBe("weekly");
  });
});
