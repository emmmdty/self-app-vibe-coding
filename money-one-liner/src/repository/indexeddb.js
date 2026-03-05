import { CURRENT_SCHEMA_VERSION, runUpgrade } from "../migrations/index.js";
import { buildClassificationFields, normalizeFlowType } from "../domain/categories.js";
import { getDefaultRuleConfig, normalizeRuleConfig } from "../rules/index.js";
import { LedgerRepository } from "./interface.js";

const DB_NAME = "money-one-liner-db";

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value).toLowerCase();
  return text === "true" || text === "1";
}

function normalizeEntry(entry) {
  const parserConfidence = Number(entry.parserConfidence ?? 0);
  const classification = buildClassificationFields({
    flow: entry.flow,
    flowType: normalizeFlowType(entry.flowType, entry.flow),
    category: entry.category ?? entry.type,
    source: entry.categorizationSource ?? entry.parserSource ?? "rule",
    confidence: Number(entry.categorizationConfidence ?? parserConfidence ?? 0.8),
    needsCategoryReview:
      entry.needsCategoryReview === undefined ? undefined : parseBoolean(entry.needsCategoryReview, false)
  });

  return {
    ...entry,
    ...classification,
    parserSource: String(entry.parserSource ?? "rule"),
    amount: Number(entry.amount ?? 0),
    parserConfidence,
    version: Number(entry.version ?? 1),
    editVersion: Number(entry.editVersion ?? 1),
    categoryVersion: Number(entry.categoryVersion ?? classification.categoryVersion ?? 1),
    categorizationSource: String(entry.categorizationSource ?? classification.categorizationSource ?? "rule"),
    categorizationConfidence: Number(
      entry.categorizationConfidence ?? classification.categorizationConfidence ?? parserConfidence ?? 0
    ),
    needsCategoryReview: parseBoolean(entry.needsCategoryReview, classification.needsCategoryReview),
    reviewStatus: String(entry.reviewStatus ?? classification.reviewStatus ?? "resolved"),
    parseMode: String(entry.parseMode ?? "rule"),
    editedAt: entry.editedAt ?? null,
    locked: parseBoolean(entry.locked, false),
    deletedAt: entry.deletedAt ?? null
  };
}

async function ensureDefaultRuleConfig(db) {
  const tx = db.transaction(["rule_config"], "readwrite");
  const store = tx.objectStore("rule_config");
  const existing = await requestToPromise(store.get("active"));
  if (!existing) {
    store.put({
      key: "active",
      value: normalizeRuleConfig(getDefaultRuleConfig())
    });
  }
  await transactionDone(tx);
}

export class IndexedDbRepository extends LedgerRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  static async create() {
    const openRequest = indexedDB.open(DB_NAME, CURRENT_SCHEMA_VERSION);

    openRequest.onupgradeneeded = (event) => {
      const db = openRequest.result;
      const tx = openRequest.transaction;
      runUpgrade(db, event.oldVersion, tx);

      if (event.oldVersion < 1 && tx) {
        const accounts = tx.objectStore("accounts");
        const now = new Date().toISOString();
        accounts.put({
          id: "default-cash",
          name: "默认账户",
          type: "cash",
          currency: "CNY",
          archived: false,
          createdAt: now,
          updatedAt: now
        });
      }
    };

    const db = await requestToPromise(openRequest);
    await ensureDefaultRuleConfig(db);
    return new IndexedDbRepository(db);
  }

  async saveEntry(entry) {
    const tx = this.db.transaction(["entries"], "readwrite");
    tx.objectStore("entries").put(normalizeEntry(entry));
    await transactionDone(tx);
  }

  async updateEntry(entry) {
    const tx = this.db.transaction(["entries"], "readwrite");
    const store = tx.objectStore("entries");
    const existing = await requestToPromise(store.get(entry.id));
    if (existing?.locked && entry.locked !== false) {
      throw new Error("该账单已锁定，请先解锁");
    }
    store.put(normalizeEntry(entry));
    await transactionDone(tx);
  }

  async getEntryById(id) {
    const tx = this.db.transaction(["entries"], "readonly");
    const record = await requestToPromise(tx.objectStore("entries").get(id));
    return record ? normalizeEntry(record) : null;
  }

  async saveEntries(entries) {
    const tx = this.db.transaction(["entries"], "readwrite");
    const store = tx.objectStore("entries");
    for (const entry of entries) {
      store.put(normalizeEntry(entry));
    }
    await transactionDone(tx);
  }

  async listEntries(filter = {}) {
    const tx = this.db.transaction(["entries"], "readonly");
    const all = (await requestToPromise(tx.objectStore("entries").getAll())).map(normalizeEntry);

    const result = all
      .filter((entry) => {
        if (filter.includeDeleted !== true && entry.deletedAt) {
          return false;
        }
        if (filter.flow && entry.flow !== filter.flow) {
          return false;
        }
        if (filter.flowType && entry.flowType !== filter.flowType) {
          return false;
        }
        if (filter.group && entry.group !== filter.group) {
          return false;
        }
        if (filter.reviewStatus && entry.reviewStatus !== filter.reviewStatus) {
          return false;
        }
        if (filter.dateFrom && entry.date < filter.dateFrom) {
          return false;
        }
        if (filter.dateTo && entry.date > filter.dateTo) {
          return false;
        }
        if (filter.accountId && entry.accountId !== filter.accountId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) {
          return byDate;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });

    if (filter.limit) {
      return result.slice(0, filter.limit);
    }
    return result;
  }

  async softDeleteEntry(id) {
    const tx = this.db.transaction(["entries"], "readwrite");
    const store = tx.objectStore("entries");
    const existing = await requestToPromise(store.get(id));
    if (existing) {
      if (existing.locked) {
        throw new Error("该账单已锁定，无法删除");
      }
      const now = new Date().toISOString();
      store.put({
        ...existing,
        deletedAt: now,
        updatedAt: now,
        version: Number(existing.version ?? 1) + 1,
        editVersion: Number(existing.editVersion ?? 1) + 1,
        editedAt: now
      });
    }
    await transactionDone(tx);
  }

  async clearEntries() {
    const tx = this.db.transaction(["entries"], "readwrite");
    tx.objectStore("entries").clear();
    await transactionDone(tx);
  }

  async upsertAccount(account) {
    const tx = this.db.transaction(["accounts"], "readwrite");
    tx.objectStore("accounts").put({
      archived: false,
      currency: "CNY",
      ...account
    });
    await transactionDone(tx);
  }

  async listAccounts() {
    const tx = this.db.transaction(["accounts"], "readonly");
    const accounts = await requestToPromise(tx.objectStore("accounts").getAll());
    return accounts.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  async saveRuleConfig(config) {
    const tx = this.db.transaction(["rule_config"], "readwrite");
    tx.objectStore("rule_config").put({
      key: "active",
      value: normalizeRuleConfig(config)
    });
    await transactionDone(tx);
  }

  async loadRuleConfig() {
    const tx = this.db.transaction(["rule_config"], "readonly");
    const record = await requestToPromise(tx.objectStore("rule_config").get("active"));
    if (!record?.value) {
      return normalizeRuleConfig(getDefaultRuleConfig());
    }
    return normalizeRuleConfig(record.value);
  }
}
