import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateEntriesByDay,
  aggregateEntriesByMonth,
  aggregateEntriesByType,
  exportDayAggregationToCSV,
  exportMonthAggregationToCSV,
  exportTypeAggregationToCSV,
  filterEntries
} from "../src/export/index.js";

const entries = [
  {
    id: "1",
    date: "2026-02-18",
    flow: "expense",
    flowType: "expense",
    type: "餐饮",
    group: "生活消费",
    category: "餐饮",
    needsCategoryReview: false,
    reviewStatus: "resolved",
    note: "早餐",
    amount: 12.5,
    rawText: "早饭12块5",
    deletedAt: null
  },
  {
    id: "2",
    date: "2026-02-19",
    flow: "expense",
    flowType: "expense",
    type: "交通",
    group: "生活消费",
    category: "交通",
    needsCategoryReview: false,
    reviewStatus: "resolved",
    note: "地铁",
    amount: 3,
    rawText: "地铁3元",
    deletedAt: null
  },
  {
    id: "3",
    date: "2026-02-19",
    flow: "income",
    flowType: "income",
    type: "工资兼职",
    group: "职业收入",
    category: "工资兼职",
    needsCategoryReview: false,
    reviewStatus: "resolved",
    note: "兼职到账",
    amount: 120,
    rawText: "兼职120",
    deletedAt: null
  },
  {
    id: "4",
    date: "2026-02-20",
    flow: "expense",
    flowType: "expense",
    type: "餐饮",
    group: "生活消费",
    category: "餐饮",
    needsCategoryReview: false,
    reviewStatus: "resolved",
    note: "奶茶",
    amount: 18,
    rawText: "奶茶18",
    deletedAt: "2026-02-20T12:00:00.000Z"
  },
  {
    id: "5",
    date: "2026-02-20",
    flow: "expense",
    flowType: "transfer",
    type: "未分类支出",
    group: "未分类",
    category: "未分类支出",
    needsCategoryReview: true,
    reviewStatus: "pending",
    note: "转给室友",
    amount: 66,
    rawText: "转账66",
    deletedAt: null
  }
];

test("filters entries by keyword/date/type/flow and skips deleted", () => {
  const filtered = filterEntries(entries, {
    keyword: "地铁",
    flow: "expense",
    dateFrom: "2026-02-19",
    dateTo: "2026-02-19",
    types: ["交通"]
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "2");
});

test("aggregates by type with income expense and net", () => {
  const rows = aggregateEntriesByType(entries);
  const byType = Object.fromEntries(rows.map((row) => [row.key, row]));
  assert.deepEqual(byType["交通"], { key: "交通", income: 0, expense: 3, net: -3, count: 1 });
  assert.deepEqual(byType["工资兼职"], { key: "工资兼职", income: 120, expense: 0, net: 120, count: 1 });
  assert.deepEqual(byType["餐饮"], { key: "餐饮", income: 0, expense: 12.5, net: -12.5, count: 1 });
  assert.deepEqual(byType["未分类支出"], { key: "未分类支出", income: 0, expense: 0, net: 0, count: 1 });
});

test("aggregates by day and month", () => {
  const byDay = aggregateEntriesByDay(entries);
  assert.deepEqual(byDay, [
    { key: "2026-02-18", income: 0, expense: 12.5, net: -12.5, count: 1 },
    { key: "2026-02-19", income: 120, expense: 3, net: 117, count: 2 },
    { key: "2026-02-20", income: 0, expense: 0, net: 0, count: 1 }
  ]);

  const byMonth = aggregateEntriesByMonth(entries);
  assert.deepEqual(byMonth, [{ key: "2026-02", income: 120, expense: 15.5, net: 104.5, count: 4 }]);
});

test("exports aggregation csv with stable headers", () => {
  const typeCsv = exportTypeAggregationToCSV(entries);
  const dayCsv = exportDayAggregationToCSV(entries);
  const monthCsv = exportMonthAggregationToCSV(entries);

  assert.match(typeCsv, /^type,income,expense,net,count/m);
  assert.match(dayCsv, /^date,income,expense,net,count/m);
  assert.match(monthCsv, /^month,income,expense,net,count/m);
});

test("filters entries by group and review status", () => {
  const filtered = filterEntries(entries, {
    group: "未分类",
    reviewStatus: "pending"
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "5");
});
