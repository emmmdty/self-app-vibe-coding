import {
  ALL_TYPES,
  DEFAULT_RULE_DEFAULTS,
  DEFAULT_TYPE_PRIORITY,
  FLOW_KEYWORDS,
  TYPE_KEYWORDS
} from "../domain/categories.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDefaultRuleConfig() {
  return {
    version: 1,
    flowKeywords: deepClone(FLOW_KEYWORDS),
    typeKeywords: deepClone(TYPE_KEYWORDS),
    typePriority: [...DEFAULT_TYPE_PRIORITY],
    defaults: { ...DEFAULT_RULE_DEFAULTS },
    updatedAt: new Date().toISOString()
  };
}

function normalizeKeywordsArray(values) {
  return [...new Set((values ?? []).map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeTypeKeywords(input) {
  const output = {};
  for (const type of ALL_TYPES) {
    output[type] = normalizeKeywordsArray(input?.[type]);
  }
  return output;
}

function normalizeTypePriority(priority) {
  const normalized = normalizeKeywordsArray(priority).filter((type) => ALL_TYPES.includes(type));
  for (const type of ALL_TYPES) {
    if (!normalized.includes(type)) {
      normalized.push(type);
    }
  }
  return normalized;
}

export function normalizeRuleConfig(config) {
  const defaults = getDefaultRuleConfig();
  if (!config || typeof config !== "object") {
    return defaults;
  }

  const next = {
    version: Number(config.version ?? defaults.version),
    flowKeywords: {
      income: normalizeKeywordsArray(config.flowKeywords?.income ?? defaults.flowKeywords.income),
      expense: normalizeKeywordsArray(config.flowKeywords?.expense ?? defaults.flowKeywords.expense)
    },
    typeKeywords: normalizeTypeKeywords(config.typeKeywords ?? defaults.typeKeywords),
    typePriority: normalizeTypePriority(config.typePriority ?? defaults.typePriority),
    defaults: {
      fallbackExpenseType: ALL_TYPES.includes(config.defaults?.fallbackExpenseType)
        ? config.defaults.fallbackExpenseType
        : defaults.defaults.fallbackExpenseType,
      fallbackIncomeType: ALL_TYPES.includes(config.defaults?.fallbackIncomeType)
        ? config.defaults.fallbackIncomeType
        : defaults.defaults.fallbackIncomeType
    },
    updatedAt: String(config.updatedAt ?? new Date().toISOString())
  };

  return next;
}

export function splitKeywordText(text) {
  return normalizeKeywordsArray(String(text ?? "").split(/[,\n，]/g));
}

export function joinKeywordText(values) {
  return normalizeKeywordsArray(values).join(", ");
}
