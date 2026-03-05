import test from "node:test";
import assert from "node:assert/strict";
import { computeDashboard } from "../src/analytics/index.js";

const entries = [
  {
    id: "e1",
    flow: "expense",
    flowType: "expense",
    type: "餐饮",
    amount: 20,
    date: "2026-02-18",
    createdAt: "2026-02-18T09:00:00.000Z",
    updatedAt: "2026-02-18T09:00:00.000Z",
    version: 1,
    currency: "CNY",
    note: "早餐",
    rawText: "早餐20",
    parserSource: "rule",
    parserConfidence: 0.95,
    deviceId: "device-1"
  },
  {
    id: "e2",
    flow: "expense",
    flowType: "expense",
    type: "交通",
    amount: 10,
    date: "2026-02-18",
    createdAt: "2026-02-18T10:00:00.000Z",
    updatedAt: "2026-02-18T10:00:00.000Z",
    version: 1,
    currency: "CNY",
    note: "地铁",
    rawText: "地铁10",
    parserSource: "rule",
    parserConfidence: 0.95,
    deviceId: "device-1"
  },
  {
    id: "e3",
    flow: "income",
    flowType: "income",
    type: "工资兼职",
    amount: 100,
    date: "2026-02-18",
    createdAt: "2026-02-18T11:00:00.000Z",
    updatedAt: "2026-02-18T11:00:00.000Z",
    version: 1,
    currency: "CNY",
    note: "兼职",
    rawText: "兼职100",
    parserSource: "rule",
    parserConfidence: 0.95,
    deviceId: "device-1"
  },
  {
    id: "e4",
    flow: "expense",
    flowType: "transfer",
    type: "其他支出",
    amount: 50,
    date: "2026-02-18",
    createdAt: "2026-02-18T12:00:00.000Z",
    updatedAt: "2026-02-18T12:00:00.000Z",
    version: 1,
    currency: "CNY",
    note: "给朋友转账",
    rawText: "转账50",
    parserSource: "rule",
    parserConfidence: 0.95,
    deviceId: "device-1"
  }
];

test("computes totals and net", () => {
  const stats = computeDashboard(entries);
  assert.equal(stats.expenseTotal, 30);
  assert.equal(stats.incomeTotal, 100);
  assert.equal(stats.net, 70);
});

test("aggregates by type", () => {
  const stats = computeDashboard(entries);
  assert.equal(stats.byType["餐饮"], 20);
  assert.equal(stats.byType["交通"], 10);
  assert.equal(stats.byType["工资兼职"], 100);
  assert.equal(stats.byType["其他支出"], undefined);
});

test("returns top expense types", () => {
  const stats = computeDashboard(entries);
  assert.equal(stats.topExpenseTypes[0].type, "餐饮");
  assert.equal(stats.topExpenseTypes[0].amount, 20);
});
