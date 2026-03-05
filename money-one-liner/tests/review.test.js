import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBatchCategoryResolution,
  collectSimilarPendingIds,
  getPendingReviewEntries
} from "../src/review/index.js";

const FIXED_NOW = "2026-02-20T10:00:00.000Z";

const sampleEntries = [
  {
    id: "a1",
    flow: "expense",
    flowType: "expense",
    type: "未分类支出",
    category: "未分类支出",
    group: "未分类",
    note: "奶茶",
    rawText: "下午奶茶15",
    amount: 15,
    reviewStatus: "pending",
    needsCategoryReview: true,
    locked: false,
    deletedAt: null,
    version: 1,
    editVersion: 1,
    parserConfidence: 0.6,
    categorizationConfidence: 0.6
  },
  {
    id: "a2",
    flow: "expense",
    flowType: "expense",
    type: "未分类支出",
    category: "未分类支出",
    group: "未分类",
    note: "奶茶外卖",
    rawText: "晚上奶茶18",
    amount: 18,
    reviewStatus: "pending",
    needsCategoryReview: true,
    locked: false,
    deletedAt: null,
    version: 2,
    editVersion: 2,
    parserConfidence: 0.65,
    categorizationConfidence: 0.65
  },
  {
    id: "a3",
    flow: "expense",
    flowType: "expense",
    type: "交通",
    category: "交通",
    group: "生活消费",
    note: "地铁",
    rawText: "地铁3元",
    amount: 3,
    reviewStatus: "resolved",
    needsCategoryReview: false,
    locked: false,
    deletedAt: null,
    version: 1,
    editVersion: 1
  },
  {
    id: "a4",
    flow: "income",
    flowType: "income",
    type: "未分类收入",
    category: "未分类收入",
    group: "未分类",
    note: "退款",
    rawText: "退款20",
    amount: 20,
    reviewStatus: "pending",
    needsCategoryReview: true,
    locked: false,
    deletedAt: null,
    version: 1,
    editVersion: 1
  },
  {
    id: "a5",
    flow: "expense",
    flowType: "expense",
    type: "未分类支出",
    category: "未分类支出",
    group: "未分类",
    note: "奶茶",
    rawText: "奶茶12",
    amount: 12,
    reviewStatus: "pending",
    needsCategoryReview: true,
    locked: true,
    deletedAt: null,
    version: 1,
    editVersion: 1
  }
];

test("lists only active pending review entries", () => {
  const rows = getPendingReviewEntries([
    ...sampleEntries,
    {
      id: "deleted",
      deletedAt: "2026-02-20T12:00:00.000Z",
      reviewStatus: "pending",
      needsCategoryReview: true
    }
  ]);
  assert.deepEqual(
    rows.map((item) => item.id).sort(),
    ["a1", "a2", "a4", "a5"]
  );
});

test("finds similar pending entries with same flow", () => {
  const ids = collectSimilarPendingIds(sampleEntries, ["a1"], { flow: "expense" });
  assert.equal(ids.includes("a2"), true);
  assert.equal(ids.includes("a4"), false);
});

test("applies category resolution to selected entries", () => {
  const result = applyBatchCategoryResolution(sampleEntries, {
    targetIds: ["a1"],
    targetFlow: "expense",
    category: "餐饮",
    applyToSimilar: false,
    now: FIXED_NOW
  });

  assert.deepEqual(result.affectedIds, ["a1"]);
  const updated = result.entries.find((item) => item.id === "a1");
  assert.equal(updated?.type, "餐饮");
  assert.equal(updated?.category, "餐饮");
  assert.equal(updated?.group, "生活消费");
  assert.equal(updated?.needsCategoryReview, false);
  assert.equal(updated?.reviewStatus, "resolved");
  assert.equal(updated?.updatedAt, FIXED_NOW);
  assert.equal(updated?.editVersion, 2);
});

test("applies to similar pending entries and skips locked rows", () => {
  const result = applyBatchCategoryResolution(sampleEntries, {
    targetIds: ["a1"],
    targetFlow: "expense",
    category: "餐饮",
    applyToSimilar: true,
    now: FIXED_NOW
  });

  assert.equal(result.affectedIds.includes("a1"), true);
  assert.equal(result.affectedIds.includes("a2"), true);
  assert.equal(result.affectedIds.includes("a5"), false);
  assert.deepEqual(result.skippedLockedIds, ["a5"]);
});
