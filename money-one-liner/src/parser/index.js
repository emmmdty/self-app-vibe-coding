import {
  buildClassificationFields,
  EXPENSE_TYPES,
  INCOME_TYPES,
  inferFlowType
} from "../domain/categories.js";
import { normalizeRuleConfig } from "../rules/index.js";

const DEFAULT_ACCOUNT_ID = "default-cash";
const DEFAULT_DEVICE_ID = "local-device";

const NOTE_HINTS = [
  { keyword: "早饭", note: "早饭" },
  { keyword: "早餐", note: "早饭" },
  { keyword: "午饭", note: "午饭" },
  { keyword: "晚饭", note: "晚饭" },
  { keyword: "夜宵", note: "夜宵" }
];

export function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, "")
    .replace(/[，,]/g, "，")
    .replace(/[。!！?？;；]/g, "")
    .trim();
}

export function inferFlow(text, config) {
  const ruleConfig = normalizeRuleConfig(config);
  const incomeHits = ruleConfig.flowKeywords.income.filter((k) => text.includes(k)).length;
  const expenseHits = ruleConfig.flowKeywords.expense.filter((k) => text.includes(k)).length;

  if (incomeHits > expenseHits) {
    return "income";
  }
  if (expenseHits > incomeHits) {
    return "expense";
  }
  if (incomeHits > 0) {
    return "income";
  }
  return "expense";
}

export function classifyType(text, flow, config) {
  const ruleConfig = normalizeRuleConfig(config);
  const fallback = flow === "income" ? ruleConfig.defaults.fallbackIncomeType : ruleConfig.defaults.fallbackExpenseType;
  const allowedTypes = flow === "income" ? INCOME_TYPES : EXPENSE_TYPES;
  let bestType = fallback;
  let bestScore = 0;

  for (const type of ruleConfig.typePriority) {
    if (!allowedTypes.includes(type)) {
      continue;
    }
    const keywords = ruleConfig.typeKeywords[type] ?? [];
    const score = keywords.reduce((acc, keyword) => {
      if (text.includes(keyword)) {
        return acc + keyword.length;
      }
      return acc;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

export function extractAmount(text) {
  const candidates = [];

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*块\s*(\d{1,2})(?!\d)/g)) {
    const left = Number(match[1]);
    const rightRaw = match[2];
    const right = Number(rightRaw) / (rightRaw.length === 1 ? 10 : 100);
    candidates.push({ score: 10, index: match.index ?? 0, amount: left + right });
  }

  for (const match of text.matchAll(/(?:花了?|付了?|支出|消费|收入|赚了?|发工资|退款|报销|到账)\D{0,2}(\d+(?:\.\d+)?)/g)) {
    candidates.push({ score: 9, index: match.index ?? 0, amount: Number(match[1]) });
  }

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:元|块钱|块)/g)) {
    candidates.push({ score: 8, index: match.index ?? 0, amount: Number(match[1]) });
  }

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)/g)) {
    candidates.push({ score: 2, index: match.index ?? 0, amount: Number(match[1]) });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.index - a.index;
  });

  const value = candidates[0].amount;
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Number(value.toFixed(2));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function extractDate(text, now = new Date()) {
  if (text.includes("今天") || text.includes("今日")) {
    return { date: formatDate(now), explicit: true };
  }
  if (text.includes("昨天")) {
    return { date: formatDate(addDays(now, -1)), explicit: true };
  }
  if (text.includes("前天")) {
    return { date: formatDate(addDays(now, -2)), explicit: true };
  }

  const full = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?/);
  if (full) {
    const date = new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3]));
    return { date: formatDate(date), explicit: true };
  }

  const md = text.match(/(\d{1,2})月(\d{1,2})日?/);
  if (md) {
    const date = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    return { date: formatDate(date), explicit: true };
  }

  return { date: formatDate(now), explicit: false };
}

export function extractNote(text, type) {
  for (const item of NOTE_HINTS) {
    if (text.includes(item.keyword)) {
      return item.note;
    }
  }

  let cleaned = text
    .replace(/(\d+(?:\.\d+)?)\s*(元|块钱|块)?/g, "")
    .replace(/今天|昨天|前天|今日/g, "")
    .replace(/花了?|买了?|消费|支出|收入|到账|发工资|退款|报销|吃了?/g, "")
    .replace(/[，,.。]/g, "")
    .trim();

  if (!cleaned) {
    return type.startsWith("其他") || type.startsWith("未分类") ? "未备注" : type;
  }

  if (cleaned.length > 12) {
    cleaned = cleaned.slice(0, 12);
  }
  return cleaned;
}

function buildId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function calcConfidence({ amount, flow, type, note, explicitDate, defaults }) {
  let score = 0.35;
  if (amount !== null) {
    score += 0.3;
  }
  if (flow === "income" || flow === "expense") {
    score += 0.15;
  }
  if (type !== defaults.fallbackExpenseType && type !== defaults.fallbackIncomeType) {
    score += 0.1;
  }
  if (note && note !== "未备注") {
    score += 0.05;
  }
  score += explicitDate ? 0.05 : 0.02;
  return Math.min(0.99, Number(score.toFixed(2)));
}

export function parseEntry(text, now = new Date(), options = {}) {
  const ruleConfig = normalizeRuleConfig(options.ruleConfig);
  const normalized = normalizeText(text);
  const warnings = [];

  const flow = inferFlow(normalized, ruleConfig);
  const flowType = inferFlowType(normalized, { flow });
  const amount = extractAmount(normalized);
  const category = classifyType(normalized, flow, ruleConfig);
  const classification = buildClassificationFields({
    flow,
    flowType,
    category,
    source: "rule",
    confidence: 0.8
  });
  const dateInfo = extractDate(normalized, now);
  const note = extractNote(normalized, classification.category);

  if (amount === null) {
    warnings.push("未识别金额");
  }
  if (classification.needsCategoryReview) {
    warnings.push("分类待复核");
  }

  const confidence = calcConfidence({
    amount,
    flow: classification.flow,
    type: classification.category,
    note,
    explicitDate: dateInfo.explicit,
    defaults: ruleConfig.defaults
  });

  const finalClassification = buildClassificationFields({
    flow: classification.flow,
    flowType: classification.flowType,
    category: classification.category,
    source: "rule",
    confidence,
    needsCategoryReview: classification.needsCategoryReview
  });

  const needsReview = amount === null || confidence < 0.75 || finalClassification.needsCategoryReview;
  const timestamp = now.toISOString();

  const draftEntry = {
    id: buildId(),
    date: dateInfo.date,
    ...finalClassification,
    note,
    amount: amount ?? 0,
    currency: "CNY",
    accountId: options.defaultAccountId ?? DEFAULT_ACCOUNT_ID,
    rawText: String(text ?? ""),
    parserSource: "rule",
    parseMode: "rule",
    parserConfidence: confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    editVersion: 1,
    editedAt: null,
    locked: false,
    deletedAt: null,
    deviceId: options.deviceId ?? DEFAULT_DEVICE_ID
  };

  return {
    draftEntry,
    confidence,
    warnings,
    needsReview
  };
}
