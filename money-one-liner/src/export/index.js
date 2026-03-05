import { isCountableFlowType, normalizeFlowType } from "../domain/categories.js";

const CSV_COLUMNS = [
  "id",
  "date",
  "flow",
  "flowType",
  "group",
  "category",
  "type",
  "note",
  "amount",
  "currency",
  "accountId",
  "rawText",
  "parserSource",
  "parseMode",
  "parserConfidence",
  "createdAt",
  "updatedAt",
  "version",
  "editVersion",
  "editedAt",
  "categoryVersion",
  "categorizationSource",
  "categorizationConfidence",
  "needsCategoryReview",
  "reviewStatus",
  "locked",
  "deletedAt",
  "deviceId"
];

function round2(value) {
  return Number(Number(value).toFixed(2));
}

function isActiveEntry(entry) {
  return entry && !entry.deletedAt;
}

function escapeCell(value) {
  const raw = String(value ?? "");
  const escaped = raw.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuote && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }

    if (ch === "," && !inQuote) {
      cells.push(current);
      current = "";
      continue;
    }

    current += ch;
  }
  cells.push(current);
  return cells;
}

function normalizeImportedEntry(row) {
  const lockedRaw = row.locked;
  const locked =
    lockedRaw === true ||
    String(lockedRaw).toLowerCase() === "true" ||
    String(lockedRaw) === "1";
  const needsCategoryReview =
    row.needsCategoryReview === true ||
    String(row.needsCategoryReview).toLowerCase() === "true" ||
    String(row.needsCategoryReview) === "1";
  const reviewStatus = String(row.reviewStatus ?? "").trim() || (needsCategoryReview ? "pending" : "resolved");
  return {
    ...row,
    amount: Number(row.amount ?? 0),
    parserConfidence: Number(row.parserConfidence ?? 0),
    categorizationConfidence: Number(row.categorizationConfidence ?? row.parserConfidence ?? 0),
    version: Number(row.version ?? 1),
    editVersion: Number(row.editVersion ?? 1),
    categoryVersion: Number(row.categoryVersion ?? 1),
    flowType: String(row.flowType ?? row.flow ?? "expense"),
    category: String(row.category ?? row.type ?? ""),
    group: String(row.group ?? "").trim(),
    categorizationSource: String(row.categorizationSource ?? row.parserSource ?? "rule"),
    needsCategoryReview,
    reviewStatus,
    parseMode: String(row.parseMode ?? row.parserSource ?? "rule"),
    editedAt: row.editedAt || null,
    locked,
    deletedAt: row.deletedAt || null
  };
}

export function exportEntriesToCSV(entries) {
  const header = CSV_COLUMNS.join(",");
  const lines = entries.map((entry) => CSV_COLUMNS.map((col) => escapeCell(entry[col])).join(","));
  return [header, ...lines].join("\n");
}

export function parseEntriesFromCSV(csvText) {
  const lines = String(csvText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return normalizeImportedEntry(row);
  });
}

export function exportEntriesToJSON(entries) {
  return JSON.stringify(entries, null, 2);
}

export function parseEntriesFromJSON(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(normalizeImportedEntry);
}

export function filterEntries(entries, filter = {}) {
  const keyword = String(filter.keyword ?? "")
    .trim()
    .toLowerCase();
  const flow = String(filter.flow ?? "").trim();
  const group = String(filter.group ?? "").trim();
  const reviewStatus = String(filter.reviewStatus ?? "").trim();
  const dateFrom = String(filter.dateFrom ?? "").trim();
  const dateTo = String(filter.dateTo ?? "").trim();
  const types = Array.isArray(filter.types) ? new Set(filter.types) : null;

  return (entries ?? []).filter((entry) => {
    if (!isActiveEntry(entry)) {
      return false;
    }

    if (flow && flow !== "all" && entry.flow !== flow) {
      return false;
    }
    if (group && group !== "all" && (entry.group ?? "") !== group) {
      return false;
    }
    const currentReviewStatus = entry.reviewStatus ?? (entry.needsCategoryReview ? "pending" : "resolved");
    if (reviewStatus && reviewStatus !== "all" && currentReviewStatus !== reviewStatus) {
      return false;
    }
    if (dateFrom && entry.date < dateFrom) {
      return false;
    }
    if (dateTo && entry.date > dateTo) {
      return false;
    }
    if (types && types.size > 0 && !types.has(entry.type)) {
      return false;
    }

    if (!keyword) {
      return true;
    }
    const searchable =
      `${entry.note ?? ""} ${entry.rawText ?? ""} ${entry.type ?? ""} ${entry.category ?? ""} ${entry.group ?? ""}`
        .toLowerCase();
    return searchable.includes(keyword);
  });
}

function aggregateByKey(entries, keySelector) {
  const map = new Map();

  for (const entry of entries ?? []) {
    if (!isActiveEntry(entry)) {
      continue;
    }
    const amount = Number(entry.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      continue;
    }
    const flowType = normalizeFlowType(entry.flowType, entry.flow);
    const key = keySelector(entry);
    const row = map.get(key) ?? { key, income: 0, expense: 0, net: 0, count: 0 };
    if (isCountableFlowType(flowType)) {
      if (entry.flow === "income") {
        row.income = round2(row.income + amount);
      } else {
        row.expense = round2(row.expense + amount);
      }
    }
    row.net = round2(row.income - row.expense);
    row.count += 1;
    map.set(key, row);
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key, "zh-CN"));
}

export function aggregateEntriesByType(entries) {
  return aggregateByKey(entries, (entry) => String(entry.type ?? "未分类"));
}

export function aggregateEntriesByDay(entries) {
  return aggregateByKey(entries, (entry) => String(entry.date ?? "").slice(0, 10));
}

export function aggregateEntriesByMonth(entries) {
  return aggregateByKey(entries, (entry) => String(entry.date ?? "").slice(0, 7));
}

function exportAggregateRowsToCSV(rows, keyName) {
  const header = [keyName, "income", "expense", "net", "count"].join(",");
  const lines = rows.map((row) =>
    [
      escapeCell(row.key),
      escapeCell(round2(row.income ?? 0)),
      escapeCell(round2(row.expense ?? 0)),
      escapeCell(round2(row.net ?? 0)),
      escapeCell(Number(row.count ?? 0))
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

export function exportTypeAggregationToCSV(entries) {
  return exportAggregateRowsToCSV(aggregateEntriesByType(entries), "type");
}

export function exportDayAggregationToCSV(entries) {
  return exportAggregateRowsToCSV(aggregateEntriesByDay(entries), "date");
}

export function exportMonthAggregationToCSV(entries) {
  return exportAggregateRowsToCSV(aggregateEntriesByMonth(entries), "month");
}
