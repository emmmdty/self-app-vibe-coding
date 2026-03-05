import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("renders three-pane workflow with detail editing", async ({ page }) => {
  await page.getByTestId("task-input").fill("准备周会");
  await page.getByTestId("add-task").click();
  await expect(page.locator(".task-item", { hasText: "准备周会" })).toHaveCount(1);

  await page.locator(".task-item", { hasText: "准备周会" }).click();
  await page.getByTestId("detail-title").fill("准备周会材料");
  await page.getByTestId("detail-due-date").fill("2026-03-12");
  await page.getByTestId("detail-repeat").selectOption("weekly");
  await page.locator("#detail-important").click();

  await page.locator("#step-input").fill("整理数据");
  await page.locator("#step-form button").click();
  await expect(page.locator("#steps-list .step-item", { hasText: "整理数据" })).toHaveCount(1);
  await expect(page.locator(".task-item", { hasText: "准备周会材料" }).locator(".star-btn")).toHaveClass(/is-on/);
});

test("persists theme, viewport, list, and tasks after refresh", async ({ page }) => {
  await page.getByTestId("theme-color").fill("#13a08e");
  await page.getByTestId("viewport-mobile").click();

  await page.locator("#list-input").fill("工作");
  await page.locator("#list-form button").click();
  await page.locator(".nav-item-btn", { hasText: "工作" }).click();

  await page.getByTestId("task-input").fill("写周报");
  await page.getByTestId("add-task").click();
  await page.locator(".task-item", { hasText: "写周报" }).click();
  await page.getByTestId("detail-reminder").fill("2026-03-10T09:30");

  await page.reload();

  await expect(page.getByTestId("theme-color")).toHaveValue("#13a08e");
  await expect(page.getByTestId("viewport-mobile")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".nav-item-btn", { hasText: "工作" })).toHaveCount(1);
  await expect(page.locator(".task-item", { hasText: "写周报" })).toHaveCount(1);
});
