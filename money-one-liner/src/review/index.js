import { buildClassificationFields, normalizeFlow } from "../domain/categories.js";

function isPending(entry) {
  if (!entry || entry.deletedAt) {
    return false;
  }
  return entry.reviewStatus === "pending" || entry.needsCategoryReview === true;
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[0-9]+(?:\.[0-9]+)?/g, " ")
    .replace(/[，,。.!！？?;；:：()\[\]{}"'`~@#$%^&*_+=|\\/<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createChineseNgrams(segment, min = 2, max = 3) {
  const grams = [];
  for (let n = min; n <= max; n += 1) {
    if (segment.length < n) {
      continue;
    }
    for (let i = 0; i <= segment.length - n; i += 1) {
      grams.push(segment.slice(i, i + n));
    }
  }
  return grams;
}

function tokenizeForSimilarity(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const tokens = new Set();
  for (const latin of normalized.match(/[a-z]{2,}/g) ?? []) {
    tokens.add(latin);
  }
  for (const segment of normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    tokens.add(segment);
    for (const gram of createChineseNgrams(segment)) {
      tokens.add(gram);
    }
  }

  return Array.from(tokens).filter((token) => token.length >= 2);
}

function buildSearchText(entry) {
  return normalizeText(`${entry?.note ?? ""} ${entry?.rawText ?? ""}`);
}

export function getPendingReviewEntries(entries) {
  return (entries ?? []).filter(isPending);
}

export function collectSimilarPendingIds(entries, seedIds, options = {}) {
  const normalizedFlow = options.flow ? normalizeFlow(options.flow) : "";
  const pending = getPendingReviewEntries(entries);
  const byId = new Map(pending.map((entry) => [entry.id, entry]));
  const seeds = (seedIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  if (!seeds.length) {
    return [];
  }

  const seedTokens = new Set();
  for (const seed of seeds) {
    for (const token of tokenizeForSimilarity(buildSearchText(seed))) {
      seedTokens.add(token);
    }
  }

  if (seedTokens.size === 0) {
    return seeds.map((item) => item.id);
  }

  const result = new Set(seeds.map((item) => item.id));
  for (const entry of pending) {
    if (normalizedFlow && normalizeFlow(entry.flow) !== normalizedFlow) {
      continue;
    }
    const text = buildSearchText(entry);
    for (const token of seedTokens) {
      if (text.includes(token)) {
        result.add(entry.id);
        break;
      }
    }
  }

  return Array.from(result);
}

export function applyBatchCategoryResolution(entries, options = {}) {
  const targetIds = Array.isArray(options.targetIds) ? options.targetIds.filter(Boolean) : [];
  if (targetIds.length === 0) {
    return {
      entries: entries ?? [],
      affectedIds: [],
      similarMatchedIds: [],
      skippedLockedIds: []
    };
  }

  const targetFlow = normalizeFlow(options.targetFlow ?? "expense");
  const category = String(options.category ?? "").trim();
  const applyToSimilar = options.applyToSimilar === true;
  const now = String(options.now ?? new Date().toISOString());

  const selectedIdSet = new Set(targetIds);
  const workingIds = new Set(targetIds);

  if (applyToSimilar) {
    for (const id of collectSimilarPendingIds(entries, targetIds, { flow: targetFlow })) {
      workingIds.add(id);
    }
  }

  const affectedIds = [];
  const skippedLockedIds = [];

  const nextEntries = (entries ?? []).map((entry) => {
    if (!entry || !workingIds.has(entry.id) || entry.deletedAt) {
      return entry;
    }
    if (entry.locked) {
      skippedLockedIds.push(entry.id);
      return entry;
    }

    const classification = buildClassificationFields({
      flow: targetFlow,
      flowType: targetFlow,
      category,
      source: "review_batch",
      confidence: Math.max(Number(entry.categorizationConfidence ?? entry.parserConfidence ?? 0), 0.95),
      needsCategoryReview: false
    });

    affectedIds.push(entry.id);
    return {
      ...entry,
      ...classification,
      updatedAt: now,
      editedAt: now,
      version: Number(entry.version ?? 1) + 1,
      editVersion: Number(entry.editVersion ?? 1) + 1
    };
  });

  const similarMatchedIds = affectedIds.filter((id) => !selectedIdSet.has(id));

  return {
    entries: nextEntries,
    affectedIds,
    similarMatchedIds,
    skippedLockedIds
  };
}
