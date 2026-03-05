import test from "node:test";
import assert from "node:assert/strict";
import {
  getGroupByCategory,
  inferFlowType,
  isCountableFlowType,
  normalizeCategory,
  normalizeFlowType,
  UNCATEGORIZED_EXPENSE_TYPE
} from "../src/domain/categories.js";

test("normalizes unknown expense category to uncategorized", () => {
  assert.equal(normalizeCategory("神秘消费", "expense"), UNCATEGORIZED_EXPENSE_TYPE);
  assert.equal(getGroupByCategory("神秘消费", "expense"), "未分类");
});

test("normalizes flow type and keeps countable semantics", () => {
  assert.equal(normalizeFlowType("expense"), "expense");
  assert.equal(normalizeFlowType("transfer"), "transfer");
  assert.equal(normalizeFlowType("unknown", "income"), "income");
  assert.equal(isCountableFlowType("expense"), true);
  assert.equal(isCountableFlowType("income"), true);
  assert.equal(isCountableFlowType("transfer"), false);
});

test("infers transfer flow type by keywords", () => {
  const flowType = inferFlowType("今天给室友转账50", { flow: "expense" });
  assert.equal(flowType, "transfer");
});
