import { buildClassificationFields } from "../domain/categories.js";

export const CURRENT_SCHEMA_VERSION = 4;

function migrateEntriesToV2(tx) {
  const store = tx.objectStore("entries");
  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const value = cursor.value;
    let changed = false;

    if (!value.parseMode) {
      value.parseMode = value.parserSource === "api" ? "api" : "rule";
      changed = true;
    }
    if (!Number.isFinite(Number(value.editVersion))) {
      value.editVersion = 1;
      changed = true;
    }
    if (value.editedAt === undefined) {
      value.editedAt = null;
      changed = true;
    }

    if (changed) {
      cursor.update(value);
    }
    cursor.continue();
  };
}

function migrateEntriesToV3(tx) {
  const store = tx.objectStore("entries");
  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const value = cursor.value;
    let changed = false;

    if (value.locked === undefined) {
      value.locked = false;
      changed = true;
    }

    if (changed) {
      cursor.update(value);
    }
    cursor.continue();
  };
}

function migrateEntriesToV4(tx) {
  const store = tx.objectStore("entries");
  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const value = cursor.value;
    let changed = false;

    const parserConfidence = Number(value.parserConfidence ?? 0);
    const classification = buildClassificationFields({
      flow: value.flow,
      flowType: value.flowType,
      category: value.category ?? value.type,
      source: value.categorizationSource ?? value.parserSource ?? "legacy_migration",
      confidence: Number(value.categorizationConfidence ?? parserConfidence ?? 0.7),
      needsCategoryReview: value.needsCategoryReview
    });

    const next = {
      flow: classification.flow,
      flowType: classification.flowType,
      type: classification.category,
      category: classification.category,
      group: classification.group,
      categoryVersion: Number(value.categoryVersion ?? classification.categoryVersion ?? 1),
      categorizationSource: String(value.categorizationSource ?? classification.categorizationSource ?? "legacy_migration"),
      categorizationConfidence: Number(
        value.categorizationConfidence ?? classification.categorizationConfidence ?? parserConfidence ?? 0
      ),
      needsCategoryReview: Boolean(value.needsCategoryReview ?? classification.needsCategoryReview),
      reviewStatus: String(value.reviewStatus ?? classification.reviewStatus ?? "resolved")
    };

    for (const [key, fieldValue] of Object.entries(next)) {
      if (value[key] !== fieldValue) {
        value[key] = fieldValue;
        changed = true;
      }
    }

    if (changed) {
      cursor.update(value);
    }
    cursor.continue();
  };
}

export function runUpgrade(db, oldVersion, tx) {
  if (oldVersion < 1) {
    const entries = db.createObjectStore("entries", { keyPath: "id" });
    entries.createIndex("by_date", "date", { unique: false });
    entries.createIndex("by_flow", "flow", { unique: false });
    entries.createIndex("by_type", "type", { unique: false });
    entries.createIndex("by_flow_type", "flowType", { unique: false });
    entries.createIndex("by_group", "group", { unique: false });
    entries.createIndex("by_updated_at", "updatedAt", { unique: false });
    entries.createIndex("by_parse_mode", "parseMode", { unique: false });
    entries.createIndex("by_review_status", "reviewStatus", { unique: false });
    entries.createIndex("by_locked", "locked", { unique: false });

    const accounts = db.createObjectStore("accounts", { keyPath: "id" });
    accounts.createIndex("by_archived", "archived", { unique: false });

    db.createObjectStore("meta", { keyPath: "key" });
    db.createObjectStore("rule_config", { keyPath: "key" });
  }

  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains("rule_config")) {
      db.createObjectStore("rule_config", { keyPath: "key" });
    }
    if (tx && tx.objectStoreNames.contains("entries")) {
      const store = tx.objectStore("entries");
      if (!store.indexNames.contains("by_parse_mode")) {
        store.createIndex("by_parse_mode", "parseMode", { unique: false });
      }
      migrateEntriesToV2(tx);
    }
  }

  if (oldVersion < 3 && tx && tx.objectStoreNames.contains("entries")) {
    const store = tx.objectStore("entries");
    if (!store.indexNames.contains("by_locked")) {
      store.createIndex("by_locked", "locked", { unique: false });
    }
    migrateEntriesToV3(tx);
  }

  if (oldVersion < 4 && tx && tx.objectStoreNames.contains("entries")) {
    const store = tx.objectStore("entries");
    if (!store.indexNames.contains("by_flow_type")) {
      store.createIndex("by_flow_type", "flowType", { unique: false });
    }
    if (!store.indexNames.contains("by_group")) {
      store.createIndex("by_group", "group", { unique: false });
    }
    if (!store.indexNames.contains("by_review_status")) {
      store.createIndex("by_review_status", "reviewStatus", { unique: false });
    }
    migrateEntriesToV4(tx);
  }
}
