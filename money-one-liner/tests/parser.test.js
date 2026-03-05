import test from "node:test";
import assert from "node:assert/strict";
import { parseEntry } from "../src/parser/index.js";
import { normalizeRuleConfig } from "../src/rules/index.js";
import { UNCATEGORIZED_EXPENSE_TYPE } from "../src/domain/categories.js";

const REF_NOW = new Date("2026-02-19T08:00:00+08:00");

test("parses breakfast with colloquial amount", () => {
  const result = parseEntry("我今天早饭吃了包子，花了4块5", REF_NOW, {
    defaultAccountId: "default-cash"
  });
  assert.equal(result.draftEntry.flow, "expense");
  assert.equal(result.draftEntry.flowType, "expense");
  assert.equal(result.draftEntry.type, "餐饮");
  assert.equal(result.draftEntry.category, "餐饮");
  assert.equal(result.draftEntry.group, "生活消费");
  assert.equal(result.draftEntry.needsCategoryReview, false);
  assert.equal(result.draftEntry.reviewStatus, "resolved");
  assert.equal(result.draftEntry.note, "早饭");
  assert.equal(result.draftEntry.amount, 4.5);
  assert.equal(result.draftEntry.date, "2026-02-19");
  assert.equal(result.needsReview, false);
});

test("parses subway record", () => {
  const result = parseEntry("昨天地铁3元", REF_NOW, { defaultAccountId: "default-cash" });
  assert.equal(result.draftEntry.flow, "expense");
  assert.equal(result.draftEntry.flowType, "expense");
  assert.equal(result.draftEntry.type, "交通");
  assert.equal(result.draftEntry.group, "生活消费");
  assert.equal(result.draftEntry.amount, 3);
  assert.equal(result.draftEntry.date, "2026-02-18");
});

test("parses salary income", () => {
  const result = parseEntry("发工资4500", REF_NOW, { defaultAccountId: "default-cash" });
  assert.equal(result.draftEntry.flow, "income");
  assert.equal(result.draftEntry.flowType, "income");
  assert.equal(result.draftEntry.type, "工资兼职");
  assert.equal(result.draftEntry.group, "职业收入");
  assert.equal(result.draftEntry.amount, 4500);
});

test("parses refund as income", () => {
  const result = parseEntry("退款20元", REF_NOW, { defaultAccountId: "default-cash" });
  assert.equal(result.draftEntry.flow, "income");
  assert.equal(result.draftEntry.flowType, "income");
  assert.equal(result.draftEntry.type, "转账退款");
  assert.equal(result.draftEntry.group, "往来入账");
  assert.equal(result.draftEntry.amount, 20);
});

test("flags low-confidence ambiguous text", () => {
  const result = parseEntry("买了点东西", REF_NOW, { defaultAccountId: "default-cash" });
  assert.equal(result.needsReview, true);
  assert.equal(result.draftEntry.flow, "expense");
  assert.equal(result.draftEntry.type, UNCATEGORIZED_EXPENSE_TYPE);
  assert.equal(result.draftEntry.category, UNCATEGORIZED_EXPENSE_TYPE);
  assert.equal(result.draftEntry.group, "未分类");
  assert.equal(result.draftEntry.needsCategoryReview, true);
  assert.equal(result.draftEntry.reviewStatus, "pending");
});

test("marks transfer as non-countable flow type", () => {
  const result = parseEntry("转账给室友100元", REF_NOW, { defaultAccountId: "default-cash" });
  assert.equal(result.draftEntry.flow, "expense");
  assert.equal(result.draftEntry.flowType, "transfer");
});

test("applies custom rule keywords from config", () => {
  const config = normalizeRuleConfig({
    flowKeywords: {
      income: ["收款"],
      expense: ["买了"]
    },
    typeKeywords: {
      "日用购物": ["猫粮"]
    },
    typePriority: ["日用购物", "其他支出", "其他收入"]
  });
  const result = parseEntry("买了猫粮花了35", REF_NOW, {
    defaultAccountId: "default-cash",
    ruleConfig: config
  });
  assert.equal(result.draftEntry.type, "日用购物");
  assert.equal(result.draftEntry.group, "生活消费");
});

test("produces parse mode and edit metadata fields", () => {
  const result = parseEntry("早饭5块", REF_NOW, { defaultAccountId: "default-cash" });
  assert.equal(result.draftEntry.parseMode, "rule");
  assert.equal(result.draftEntry.categoryVersion, 1);
  assert.equal(result.draftEntry.categorizationSource, "rule");
  assert.ok(Number.isFinite(result.draftEntry.categorizationConfidence));
  assert.equal(result.draftEntry.editVersion, 1);
  assert.equal(result.draftEntry.editedAt, null);
  assert.equal(result.draftEntry.locked, false);
});
