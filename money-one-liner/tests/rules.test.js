import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultRuleConfig, normalizeRuleConfig, splitKeywordText } from "../src/rules/index.js";

test("default rule config contains flow keywords and priorities", () => {
  const config = getDefaultRuleConfig();
  assert.ok(config.flowKeywords.income.length > 0);
  assert.ok(config.flowKeywords.expense.length > 0);
  assert.ok(config.typePriority.length > 0);
  assert.equal(config.defaults.fallbackExpenseType, "未分类支出");
  assert.equal(config.defaults.fallbackIncomeType, "未分类收入");
});

test("normalizeRuleConfig keeps all types in priority", () => {
  const config = normalizeRuleConfig({
    typePriority: ["餐饮", "交通"]
  });
  assert.ok(config.typePriority.includes("餐饮"));
  assert.ok(config.typePriority.includes("未分类支出"));
  assert.ok(config.typePriority.includes("未分类收入"));
});

test("splitKeywordText trims and deduplicates", () => {
  const items = splitKeywordText("奶茶, 奶茶, 咖啡，外卖");
  assert.deepEqual(items, ["奶茶", "咖啡", "外卖"]);
});
