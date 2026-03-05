import {
  fetchProviderSettings,
  fetchProxyHealth,
  parseWithApi,
  saveProviderSettings,
  transcribeWithApi
} from "../api/client.js";
import { computeDashboard } from "../analytics/index.js";
import {
  ALL_TYPES,
  buildClassificationFields,
  CATEGORY_GROUPS,
  EXPENSE_TYPES,
  getFallbackCategory,
  INCOME_TYPES,
  normalizeFlow
} from "../domain/categories.js";
import {
  exportDayAggregationToCSV,
  exportEntriesToCSV,
  exportEntriesToJSON,
  exportMonthAggregationToCSV,
  exportTypeAggregationToCSV,
  filterEntries,
  parseEntriesFromCSV,
  parseEntriesFromJSON
} from "../export/index.js";
import { parseEntry } from "../parser/index.js";
import {
  applyBatchCategoryResolution,
  getPendingReviewEntries
} from "../review/index.js";
import { IndexedDbRepository } from "../repository/indexeddb.js";
import { getDefaultRuleConfig, joinKeywordText, normalizeRuleConfig, splitKeywordText } from "../rules/index.js";
import { createVoiceController, hasWebSpeechSupport } from "../voice/index.js";

const SETTINGS_KEY = "money-one-liner-settings";
const DEVICE_KEY = "money-one-liner-device-id";

const DEFAULT_SETTINGS = {
  parseMode: "auto",
  voiceMode: "auto",
  alwaysConfirmBeforeSave: false,
  proxyBaseUrl: "http://127.0.0.1:8787"
};

const DEFAULT_PROVIDER_SETTINGS = {
  provider: "openai_compatible",
  preset: "deepseek",
  upstreamBaseUrl: "https://api.deepseek.com",
  parseModel: "deepseek-chat",
  transcribeModel: "whisper-1",
  keyConfigured: false,
  presets: {}
};

const state = {
  repo: null,
  entries: [],
  filteredEntries: [],
  selectedEntryIds: new Set(),
  reviewSelectedIds: new Set(),
  pendingContext: null,
  settings: loadSettings(),
  providerSettings: { ...DEFAULT_PROVIDER_SETTINGS },
  filters: {
    keyword: "",
    flow: "all",
    type: "",
    group: "all",
    reviewStatus: "all",
    dateFrom: "",
    dateTo: ""
  },
  deviceId: loadOrCreateDeviceId(),
  ruleConfig: getDefaultRuleConfig(),
  voiceController: null
};

function $(id) {
  return document.getElementById(id);
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveLocalSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadOrCreateDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) {
    return existing;
  }
  const deviceId =
    globalThis.crypto?.randomUUID?.() ??
    `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
}

function flash(message, tone = "ok") {
  const target = $("flash");
  target.textContent = message;
  target.dataset.tone = tone;
}

function ensureFlow(flow) {
  return normalizeFlow(flow);
}

function flowLabel(flow) {
  return ensureFlow(flow) === "income" ? "收入" : "支出";
}

function flowTypeLabel(flowType) {
  const labels = {
    expense: "支出",
    income: "收入",
    transfer: "转账",
    debt_principal: "本金往来",
    adjustment: "调账"
  };
  return labels[flowType] ?? flowType;
}

function reviewStatusLabel(status) {
  return status === "pending" ? "待复核" : "已复核";
}

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl ?? "").trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function buildTypeOptions(flow) {
  const types = ensureFlow(flow) === "income" ? INCOME_TYPES : EXPENSE_TYPES;
  return types.map((type) => `<option value="${type}">${type}</option>`).join("");
}

function updatePreviewTypeOptions(flow, selectedType = "") {
  const select = $("previewType");
  select.innerHTML = buildTypeOptions(flow);
  if (selectedType && Array.from(select.options).some((item) => item.value === selectedType)) {
    select.value = selectedType;
  }
}

function updateManualTypeOptions(flow, selectedType = "") {
  const select = $("manualType");
  select.innerHTML = buildTypeOptions(flow);
  if (selectedType && Array.from(select.options).some((item) => item.value === selectedType)) {
    select.value = selectedType;
  }
}

function updateReviewTypeOptions(flow, selectedType = "") {
  const select = $("reviewType");
  select.innerHTML = buildTypeOptions(flow);
  if (selectedType && Array.from(select.options).some((item) => item.value === selectedType)) {
    select.value = selectedType;
  }
}

function withNormalizedClassification(entry, sourceFallback) {
  const source = sourceFallback ?? entry.categorizationSource ?? entry.parserSource ?? "rule";
  const classification = buildClassificationFields({
    flow: entry.flow,
    flowType: entry.flowType,
    category: entry.category ?? entry.type,
    source,
    confidence: Number(entry.categorizationConfidence ?? entry.parserConfidence ?? 0.8),
    needsCategoryReview: entry.needsCategoryReview
  });

  return {
    ...entry,
    ...classification
  };
}

function setVoiceStatus(status) {
  const labelMap = {
    idle: "idle",
    listening: "listening",
    recording: "recording",
    processing: "processing"
  };
  $("voiceStatus").textContent = `语音状态：${labelMap[status] ?? status}`;

  const btn = $("voiceInputBtn");
  if (status === "recording" || status === "listening") {
    btn.textContent = "停止语音";
    return;
  }
  if (status === "processing") {
    btn.textContent = "处理中...";
    return;
  }
  btn.textContent = "语音输入";
}

function updateKeyConfiguredStatus() {
  $("keyConfiguredStatus").textContent = state.providerSettings.keyConfigured ? "已配置" : "未配置";
}

function renderProviderSettingsForm() {
  $("providerPreset").value = state.providerSettings.preset;
  $("upstreamBaseUrl").value = state.providerSettings.upstreamBaseUrl;
  $("modelName").value = state.providerSettings.parseModel;
  $("transcribeModelName").value = state.providerSettings.transcribeModel;
  updateKeyConfiguredStatus();
}

function fillProviderFromPreset(preset) {
  const presets = state.providerSettings.presets ?? {};
  const selected = presets[preset];
  if (!selected) {
    return;
  }
  $("upstreamBaseUrl").value = selected.upstreamBaseUrl;
  $("modelName").value = selected.parseModel;
  $("transcribeModelName").value = selected.transcribeModel;
}

function openPreview({ mode, entry, confidence, warnings, source }) {
  state.pendingContext = { mode, entry, confidence, warnings, source };
  $("previewTitle").textContent = mode === "edit" ? "编辑已保存账单" : "确认账单";
  $("previewFlow").value = ensureFlow(entry.flow);
  updatePreviewTypeOptions(entry.flow, entry.category ?? entry.type);
  $("previewAmount").value = Number(entry.amount ?? 0);
  $("previewDate").value = entry.date;
  $("previewNote").value = entry.note;
  $("previewConfidence").textContent = `${Math.round((confidence ?? 0) * 100)}%`;
  $("previewWarnings").textContent = warnings?.length ? warnings.join("；") : "无";
  $("previewSource").textContent = source ?? "rule";
  $("previewPanel").hidden = false;
}

function hidePreview() {
  $("previewPanel").hidden = true;
  state.pendingContext = null;
}

function normalizeEditedDraft(baseEntry) {
  const nextFlow = ensureFlow($("previewFlow").value);
  const selectedCategory = $("previewType").value.trim() || getFallbackCategory(nextFlow);
  const draft = {
    ...baseEntry,
    flow: nextFlow,
    flowType: baseEntry.flow === nextFlow ? baseEntry.flowType : nextFlow,
    type: selectedCategory,
    category: selectedCategory,
    amount: Number($("previewAmount").value),
    date: $("previewDate").value,
    note: $("previewNote").value.trim() || "未备注"
  };
  return withNormalizedClassification(draft, baseEntry.categorizationSource ?? baseEntry.parserSource ?? "rule");
}

function createEntryFromApi(apiResult, rawText, now, parseMode = "api", parserSource = "api") {
  const timestamp = now.toISOString();
  const flow = ensureFlow(apiResult.flow);
  const category = String(apiResult.category ?? apiResult.type ?? getFallbackCategory(flow));
  const baseEntry = {
    id: globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: String(apiResult.date ?? timestamp.slice(0, 10)).slice(0, 10),
    flow,
    flowType: String(apiResult.flowType ?? flow),
    type: category,
    category,
    group: String(apiResult.group ?? ""),
    note: String(apiResult.note ?? "").trim() || category,
    amount: Number(apiResult.amount ?? 0),
    currency: "CNY",
    accountId: "default-cash",
    rawText: rawText,
    parserSource,
    parseMode,
    parserConfidence: Number(apiResult.confidence ?? 0.8),
    categorizationSource: String(apiResult.categorizationSource ?? parserSource),
    categorizationConfidence: Number(apiResult.categorizationConfidence ?? apiResult.confidence ?? 0.8),
    needsCategoryReview: Boolean(apiResult.needsCategoryReview),
    reviewStatus: String(apiResult.reviewStatus ?? ""),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    editVersion: 1,
    editedAt: null,
    locked: false,
    deletedAt: null,
    deviceId: state.deviceId
  };
  return withNormalizedClassification(baseEntry, parserSource);
}

function createManualEntry() {
  const now = new Date();
  const timestamp = now.toISOString();
  const flow = ensureFlow($("manualFlow").value);
  const category = $("manualType").value.trim() || getFallbackCategory(flow);
  const baseEntry = {
    id: globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: $("manualDate").value,
    flow,
    flowType: flow,
    type: category,
    category,
    note: $("manualNote").value.trim() || "未备注",
    amount: Number($("manualAmount").value),
    currency: "CNY",
    accountId: "default-cash",
    rawText: $("manualNote").value.trim() || "manual",
    parserSource: "manual",
    parseMode: "manual",
    parserConfidence: 1,
    categorizationSource: "manual",
    categorizationConfidence: 1,
    needsCategoryReview: false,
    reviewStatus: "resolved",
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    editVersion: 1,
    editedAt: null,
    locked: false,
    deletedAt: null,
    deviceId: state.deviceId
  };
  return withNormalizedClassification(baseEntry, "manual");
}

function isValidDraft(entry) {
  if (!entry.date) {
    return { ok: false, message: "日期不能为空" };
  }
  if (!entry.type) {
    return { ok: false, message: "类型不能为空" };
  }
  if (!Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0) {
    return { ok: false, message: "金额必须大于 0" };
  }
  return { ok: true };
}

async function parseByApi(text, now, parseMode = "api", parserSource = "api") {
  const apiResult = await parseWithApi({
    text,
    now,
    baseUrl: state.settings.proxyBaseUrl,
    provider: "openai_compatible",
    model: state.providerSettings.parseModel
  });
  const entry = createEntryFromApi(apiResult, text, now, parseMode, parserSource);
  const confidence = Number(apiResult.confidence ?? 0.8);
  const warnings = [];
  if (entry.needsCategoryReview) {
    warnings.push("分类待复核");
  }
  return {
    draftEntry: entry,
    confidence,
    warnings,
    needsReview: confidence < 0.75 || entry.needsCategoryReview
  };
}

async function resolveParseResult(text, now) {
  const mode = state.settings.parseMode;
  const ruleResult = parseEntry(text, now, {
    defaultAccountId: "default-cash",
    deviceId: state.deviceId,
    ruleConfig: state.ruleConfig
  });

  if (mode === "rule") {
    return ruleResult;
  }
  if (mode === "api") {
    return parseByApi(text, now, "api", "api");
  }
  if (!ruleResult.needsReview) {
    return ruleResult;
  }

  try {
    const apiResult = await parseByApi(text, now, "hybrid", "hybrid");
    if (apiResult.confidence > ruleResult.confidence) {
      return apiResult;
    }
  } catch {
    ruleResult.warnings.push("API 解析不可用，已回退规则解析");
  }
  return ruleResult;
}

function getCurrentFilters() {
  return {
    keyword: $("filterKeyword").value.trim(),
    flow: $("filterFlow").value,
    type: $("filterType").value,
    group: $("filterGroup").value,
    reviewStatus: $("filterReviewStatus").value,
    dateFrom: $("filterDateFrom").value,
    dateTo: $("filterDateTo").value
  };
}

function renderFilterSummary() {
  const total = state.entries.length;
  const filtered = state.filteredEntries.length;
  const pending = state.filteredEntries.filter((entry) => entry.reviewStatus === "pending").length;
  $("filterSummary").textContent = `筛选后 ${filtered} 条 / 全部 ${total} 条 / 待复核 ${pending} 条`;
}

function applyFiltersAndRender() {
  state.filters = getCurrentFilters();
  const types = state.filters.type ? [state.filters.type] : [];
  state.filteredEntries = filterEntries(state.entries, {
    keyword: state.filters.keyword,
    flow: state.filters.flow,
    group: state.filters.group,
    reviewStatus: state.filters.reviewStatus,
    dateFrom: state.filters.dateFrom,
    dateTo: state.filters.dateTo,
    types
  });

  const activeIds = new Set(state.filteredEntries.map((item) => item.id));
  state.selectedEntryIds = new Set(Array.from(state.selectedEntryIds).filter((id) => activeIds.has(id)));
  renderEntries();
  renderDashboard();
  renderFilterSummary();
  renderReviewQueue();
}

function setTodayToManualForm() {
  $("manualDate").value = new Date().toISOString().slice(0, 10);
}

function renderFilterTypeOptions() {
  const select = $("filterType");
  select.innerHTML =
    `<option value="">全部类型</option>` +
    ALL_TYPES.map((item) => `<option value="${item}">${item}</option>`).join("");
}

function renderFilterGroupOptions() {
  const select = $("filterGroup");
  select.innerHTML =
    `<option value="all">全部分组</option>` +
    CATEGORY_GROUPS.map((item) => `<option value="${item}">${item}</option>`).join("");
}

function getPendingQueueEntries() {
  return getPendingReviewEntries(state.entries).sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) {
      return byDate;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function renderReviewQueue() {
  const pending = getPendingQueueEntries();
  const activeIds = new Set(pending.map((item) => item.id));
  state.reviewSelectedIds = new Set(Array.from(state.reviewSelectedIds).filter((id) => activeIds.has(id)));

  $("reviewSummary").textContent = `待复核 ${pending.length} 条，已勾选 ${state.reviewSelectedIds.size} 条`;

  const tbody = $("reviewQueueBody");
  tbody.innerHTML = "";
  for (const entry of pending) {
    const tr = document.createElement("tr");
    tr.dataset.id = entry.id;

    const checkTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.role = "review-select";
    checkbox.dataset.id = entry.id;
    checkbox.disabled = Boolean(entry.locked);
    checkbox.checked = state.reviewSelectedIds.has(entry.id);
    checkTd.appendChild(checkbox);
    tr.appendChild(checkTd);

    const dateTd = document.createElement("td");
    dateTd.textContent = entry.date;
    tr.appendChild(dateTd);

    const flowTd = document.createElement("td");
    flowTd.textContent = `${flowLabel(entry.flow)} / ${flowTypeLabel(entry.flowType)}`;
    tr.appendChild(flowTd);

    const typeTd = document.createElement("td");
    typeTd.textContent = `${entry.group}-${entry.type}`;
    tr.appendChild(typeTd);

    const noteTd = document.createElement("td");
    noteTd.textContent = entry.note;
    tr.appendChild(noteTd);

    const amountTd = document.createElement("td");
    amountTd.textContent = `${Number(entry.amount).toFixed(2)} 元`;
    tr.appendChild(amountTd);

    const stateTd = document.createElement("td");
    stateTd.textContent = entry.locked ? "已锁定" : "待复核";
    stateTd.className = entry.locked ? "review-locked" : "review-pending";
    tr.appendChild(stateTd);

    tbody.appendChild(tr);
  }
}

function getEntryById(id) {
  return state.entries.find((item) => item.id === id);
}

function createTableCell() {
  return document.createElement("td");
}
function createInputCell({ type, value, field, disabled = false, step, min }) {
  const td = createTableCell();
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.dataset.field = field;
  input.disabled = disabled;
  if (step !== undefined) {
    input.step = step;
  }
  if (min !== undefined) {
    input.min = min;
  }
  td.appendChild(input);
  return td;
}

function createFlowCell(flow, disabled = false) {
  const td = createTableCell();
  const select = document.createElement("select");
  select.dataset.field = "flow";
  select.disabled = disabled;
  select.innerHTML = `
    <option value="expense">支出</option>
    <option value="income">收入</option>
  `;
  select.value = ensureFlow(flow);
  td.appendChild(select);
  return td;
}

function createFlowTypeCell(flowType, flow, disabled = false) {
  const td = createTableCell();
  const select = document.createElement("select");
  select.dataset.field = "flowType";
  select.disabled = disabled;
  const normalizedFlow = ensureFlow(flow);
  const defaultValue = flowType || normalizedFlow;
  select.innerHTML = `
    <option value="expense">支出</option>
    <option value="income">收入</option>
    <option value="transfer">转账</option>
    <option value="debt_principal">本金往来</option>
    <option value="adjustment">调账</option>
  `;
  select.value = defaultValue;
  td.appendChild(select);
  return td;
}

function createGroupCell(group) {
  const td = createTableCell();
  td.textContent = group || "未分类";
  return td;
}

function createCheckboxCell(entry) {
  const td = createTableCell();
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.role = "row-select";
  checkbox.dataset.id = entry.id;
  checkbox.checked = state.selectedEntryIds.has(entry.id);
  td.appendChild(checkbox);
  return td;
}

function createSourceCell(entry) {
  const td = createTableCell();
  td.textContent = entry.parseMode ?? entry.parserSource ?? "rule";
  return td;
}

function createConfidenceCell(entry) {
  const td = createTableCell();
  td.textContent = `${Math.round((entry.parserConfidence ?? 0) * 100)}%`;
  return td;
}

function createReviewCell(entry) {
  const td = createTableCell();
  td.textContent = reviewStatusLabel(entry.reviewStatus);
  td.className = entry.reviewStatus === "pending" ? "review-pending" : "review-resolved";
  return td;
}

function createLockStateCell(entry) {
  const td = createTableCell();
  td.className = "lock-state";
  td.textContent = entry.locked ? "已锁定" : "可编辑";
  return td;
}

function createActionsCell(entry) {
  const td = createTableCell();
  const wrap = document.createElement("div");
  wrap.className = "row-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "link-btn";
  saveBtn.dataset.action = "save";
  saveBtn.dataset.id = entry.id;
  saveBtn.disabled = Boolean(entry.locked);
  saveBtn.textContent = "保存";

  const lockBtn = document.createElement("button");
  lockBtn.type = "button";
  lockBtn.className = "link-btn";
  lockBtn.dataset.action = "toggle-lock";
  lockBtn.dataset.id = entry.id;
  lockBtn.textContent = entry.locked ? "解锁" : "锁定";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "link-btn";
  deleteBtn.dataset.action = "delete";
  deleteBtn.dataset.id = entry.id;
  deleteBtn.disabled = Boolean(entry.locked);
  deleteBtn.textContent = "删除";

  wrap.appendChild(saveBtn);
  wrap.appendChild(lockBtn);
  wrap.appendChild(deleteBtn);
  td.appendChild(wrap);
  return td;
}

function renderEntries() {
  const tbody = $("entriesBody");
  tbody.innerHTML = "";
  for (const entry of state.filteredEntries) {
    const tr = document.createElement("tr");
    tr.dataset.id = entry.id;
    if (entry.locked) {
      tr.classList.add("locked-row");
    }
    if (entry.reviewStatus === "pending") {
      tr.classList.add("pending-review-row");
    }

    tr.appendChild(createCheckboxCell(entry));
    tr.appendChild(createInputCell({ type: "date", value: entry.date, field: "date", disabled: Boolean(entry.locked) }));
    tr.appendChild(createFlowCell(entry.flow, Boolean(entry.locked)));
    tr.appendChild(createFlowTypeCell(entry.flowType, entry.flow, Boolean(entry.locked)));
    tr.appendChild(createGroupCell(entry.group));
    tr.appendChild(createInputCell({ type: "text", value: entry.type, field: "type", disabled: Boolean(entry.locked) }));
    tr.appendChild(createInputCell({ type: "text", value: entry.note, field: "note", disabled: Boolean(entry.locked) }));
    const amountCell = createInputCell({
      type: "number",
      value: Number(entry.amount).toFixed(2),
      field: "amount",
      disabled: Boolean(entry.locked),
      step: "0.01",
      min: "0.01"
    });
    amountCell.dataset.cell = "amount";
    tr.appendChild(amountCell);
    tr.appendChild(createSourceCell(entry));
    tr.appendChild(createConfidenceCell(entry));
    tr.appendChild(createReviewCell(entry));
    tr.appendChild(createLockStateCell(entry));
    tr.appendChild(createActionsCell(entry));
    tbody.appendChild(tr);
  }
}

function renderDashboard() {
  const stats = computeDashboard(state.filteredEntries);
  $("incomeTotal").textContent = stats.incomeTotal.toFixed(2);
  $("expenseTotal").textContent = stats.expenseTotal.toFixed(2);
  $("netTotal").textContent = stats.net.toFixed(2);

  const typeList = $("typeBreakdown");
  typeList.innerHTML = "";
  Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, amount]) => {
      const li = document.createElement("li");
      li.textContent = `${type}: ${amount.toFixed(2)} 元`;
      typeList.appendChild(li);
    });

  const trendList = $("trendList");
  trendList.innerHTML = "";
  stats.dailyTrend.slice(-7).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.date} 收 ${item.income.toFixed(2)} / 支 ${item.expense.toFixed(2)} / 净 ${item.net.toFixed(2)}`;
    trendList.appendChild(li);
  });
}

async function refreshEntries() {
  state.entries = await state.repo.listEntries({ limit: 2000 });
  applyFiltersAndRender();
}

async function saveNewEntry(entry) {
  await state.repo.saveEntry(entry);
  $("entryInput").value = "";
  hidePreview();
  await refreshEntries();
  flash(
    `已记账：${flowLabel(entry.flow)} / ${entry.group}-${entry.type} / ${Number(entry.amount).toFixed(2)} 元`
  );
}

async function updateExistingEntry(baseEntry, editedEntry) {
  const now = new Date().toISOString();
  const merged = {
    ...baseEntry,
    ...editedEntry,
    updatedAt: now,
    editedAt: now,
    version: Number(baseEntry.version ?? 1) + 1,
    editVersion: Number(baseEntry.editVersion ?? 1) + 1
  };
  await state.repo.updateEntry(merged);
  hidePreview();
  await refreshEntries();
  flash("账单已更新");
}

async function handleQuickEntrySubmit(event) {
  event.preventDefault();
  const text = $("entryInput").value.trim();
  if (!text) {
    flash("请输入一句话账单", "warn");
    return;
  }

  const now = new Date();
  let result;
  try {
    result = await resolveParseResult(text, now);
  } catch (error) {
    flash(`解析失败：${error.message}`, "warn");
    return;
  }

  const forceConfirm = state.settings.alwaysConfirmBeforeSave;
  if (forceConfirm || result.needsReview) {
    openPreview({
      mode: "create",
      entry: result.draftEntry,
      confidence: result.confidence,
      warnings: result.warnings,
      source: result.draftEntry.parserSource
    });
    flash(result.needsReview ? "解析置信度较低，请确认后保存" : "请确认后保存");
    return;
  }

  await saveNewEntry(result.draftEntry);
}

async function handleManualEntrySubmit(event) {
  event.preventDefault();
  const entry = createManualEntry();
  const valid = isValidDraft(entry);
  if (!valid.ok) {
    flash(valid.message, "warn");
    return;
  }
  await saveNewEntry(entry);
  $("manualAmount").value = "";
  $("manualNote").value = "";
  flash("手动账单已保存");
}

async function handlePreviewSave() {
  if (!state.pendingContext) {
    return;
  }

  const base = state.pendingContext.entry;
  const edited = normalizeEditedDraft(base);
  const valid = isValidDraft(edited);
  if (!valid.ok) {
    flash(valid.message, "warn");
    return;
  }

  if (state.pendingContext.mode === "edit") {
    await updateExistingEntry(base, edited);
  } else {
    await saveNewEntry(edited);
  }
}

function readRowDraft(row, baseEntry) {
  const flow = ensureFlow(row.querySelector('[data-field="flow"]')?.value);
  const category = row.querySelector('[data-field="type"]')?.value.trim() || baseEntry.type;
  const draft = {
    ...baseEntry,
    date: row.querySelector('[data-field="date"]')?.value ?? baseEntry.date,
    flow,
    flowType: row.querySelector('[data-field="flowType"]')?.value ?? baseEntry.flowType ?? flow,
    type: category,
    category,
    note: row.querySelector('[data-field="note"]')?.value.trim() || "未备注",
    amount: Number(row.querySelector('[data-field="amount"]')?.value ?? baseEntry.amount)
  };
  return withNormalizedClassification(draft, baseEntry.categorizationSource ?? baseEntry.parserSource ?? "manual");
}

async function handleRowSave(id, row) {
  const baseEntry = getEntryById(id);
  if (!baseEntry) {
    flash("账单不存在", "warn");
    return;
  }
  if (baseEntry.locked) {
    flash("该账单已锁定，请先解锁", "warn");
    return;
  }

  const draft = readRowDraft(row, baseEntry);
  const valid = isValidDraft(draft);
  if (!valid.ok) {
    flash(valid.message, "warn");
    return;
  }

  try {
    await updateExistingEntry(baseEntry, draft);
  } catch (error) {
    flash(error instanceof Error ? error.message : "保存失败", "warn");
  }
}

async function handleToggleLock(id) {
  const baseEntry = getEntryById(id);
  if (!baseEntry) {
    flash("账单不存在", "warn");
    return;
  }
  const now = new Date().toISOString();
  const next = {
    ...baseEntry,
    locked: !baseEntry.locked,
    updatedAt: now,
    editedAt: now,
    version: Number(baseEntry.version ?? 1) + 1,
    editVersion: Number(baseEntry.editVersion ?? 1) + 1
  };
  try {
    await state.repo.updateEntry(next);
    await refreshEntries();
    flash(next.locked ? "账单已锁定" : "账单已解锁");
  } catch (error) {
    flash(error instanceof Error ? error.message : "锁定操作失败", "warn");
  }
}

async function handleRowDelete(id) {
  const baseEntry = getEntryById(id);
  if (!baseEntry) {
    flash("账单不存在", "warn");
    return;
  }
  if (baseEntry.locked) {
    flash("该账单已锁定，无法删除", "warn");
    return;
  }
  try {
    await state.repo.softDeleteEntry(id);
    await refreshEntries();
    flash("已删除该条记录");
  } catch (error) {
    flash(error instanceof Error ? error.message : "删除失败", "warn");
  }
}

async function handleTableClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) {
    return;
  }

  if (action === "save") {
    const row = target.closest("tr");
    if (!row) {
      return;
    }
    await handleRowSave(id, row);
    return;
  }
  if (action === "toggle-lock") {
    await handleToggleLock(id);
    return;
  }
  if (action === "delete") {
    await handleRowDelete(id);
  }
}

function handleTableChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.dataset.role === "row-select") {
    const id = target.dataset.id;
    if (!id) {
      return;
    }
    if (target.checked) {
      state.selectedEntryIds.add(id);
    } else {
      state.selectedEntryIds.delete(id);
    }
  }
}

function handleReviewQueueChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.role !== "review-select") {
    return;
  }
  const id = target.dataset.id;
  if (!id) {
    return;
  }
  if (target.checked) {
    state.reviewSelectedIds.add(id);
  } else {
    state.reviewSelectedIds.delete(id);
  }
  renderReviewQueue();
}

function handleReviewSelectAll() {
  const pending = getPendingQueueEntries().filter((entry) => !entry.locked);
  state.reviewSelectedIds = new Set(pending.map((entry) => entry.id));
  renderReviewQueue();
}

function handleReviewClearSelection() {
  state.reviewSelectedIds.clear();
  renderReviewQueue();
}

async function handleReviewApplyBatch() {
  const selectedIds = Array.from(state.reviewSelectedIds);
  if (!selectedIds.length) {
    flash("请先勾选待复核账单", "warn");
    return;
  }

  const targetFlow = ensureFlow($("reviewFlow").value);
  const category = $("reviewType").value.trim();
  const applyToSimilar = $("reviewSimilarMode").value === "pending_only";
  const result = applyBatchCategoryResolution(state.entries, {
    targetIds: selectedIds,
    targetFlow,
    category,
    applyToSimilar,
    now: new Date().toISOString()
  });

  if (!result.affectedIds.length && !result.skippedLockedIds.length) {
    flash("没有可更新的账单", "warn");
    return;
  }

  const affectedSet = new Set(result.affectedIds);
  const updates = result.entries.filter((entry) => affectedSet.has(entry.id));
  if (updates.length > 0) {
    await state.repo.saveEntries(updates);
  }

  state.reviewSelectedIds.clear();
  await refreshEntries();

  const detail = [
    `已复核 ${result.affectedIds.length} 条`,
    `相似联动 ${result.similarMatchedIds.length} 条`,
    `跳过锁定 ${result.skippedLockedIds.length} 条`
  ].join("，");
  flash(detail);
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getExportBaseDate() {
  return new Date().toISOString().slice(0, 10);
}

function getSelectedEntries() {
  if (!state.selectedEntryIds.size) {
    return [];
  }
  return state.filteredEntries.filter((entry) => state.selectedEntryIds.has(entry.id));
}

function handleExportCsv() {
  const csv = exportEntriesToCSV(state.filteredEntries);
  downloadFile(`money-one-liner-filtered-${getExportBaseDate()}.csv`, csv, "text/csv;charset=utf-8");
}

function handleExportSelectedCsv() {
  const selected = getSelectedEntries();
  if (!selected.length) {
    flash("请先勾选要导出的账单", "warn");
    return;
  }
  const csv = exportEntriesToCSV(selected);
  downloadFile(`money-one-liner-selected-${getExportBaseDate()}.csv`, csv, "text/csv;charset=utf-8");
}

function handleExportJson() {
  const json = exportEntriesToJSON(state.filteredEntries);
  downloadFile(`money-one-liner-filtered-${getExportBaseDate()}.json`, json, "application/json");
}

function handleExportByType() {
  const csv = exportTypeAggregationToCSV(state.filteredEntries);
  downloadFile(`money-one-liner-by-type-${getExportBaseDate()}.csv`, csv, "text/csv;charset=utf-8");
}

function handleExportByDay() {
  const csv = exportDayAggregationToCSV(state.filteredEntries);
  downloadFile(`money-one-liner-by-day-${getExportBaseDate()}.csv`, csv, "text/csv;charset=utf-8");
}

function handleExportByMonth() {
  const csv = exportMonthAggregationToCSV(state.filteredEntries);
  downloadFile(`money-one-liner-by-month-${getExportBaseDate()}.csv`, csv, "text/csv;charset=utf-8");
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  let entries = [];
  if (file.name.toLowerCase().endsWith(".json")) {
    entries = parseEntriesFromJSON(text);
  } else {
    entries = parseEntriesFromCSV(text);
  }

  if (!entries.length) {
    flash("导入文件为空或格式不正确", "warn");
    return;
  }
  await state.repo.saveEntries(entries);
  await refreshEntries();
  flash(`已导入 ${entries.length} 条记录`);
  event.target.value = "";
}

async function handleClearAll() {
  const ok = confirm("确认清空所有账单吗？此操作不可恢复。");
  if (!ok) {
    return;
  }
  await state.repo.clearEntries();
  await refreshEntries();
  hidePreview();
  flash("已清空所有记录", "warn");
}

function renderRuleEditor() {
  $("flowIncomeKeywords").value = joinKeywordText(state.ruleConfig.flowKeywords.income);
  $("flowExpenseKeywords").value = joinKeywordText(state.ruleConfig.flowKeywords.expense);
  $("typePriorityKeywords").value = joinKeywordText(state.ruleConfig.typePriority);

  const typeSelect = $("ruleTypeSelect");
  typeSelect.innerHTML = ALL_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("");
  if (!typeSelect.value) {
    typeSelect.value = ALL_TYPES[0];
  }
  $("ruleTypeKeywords").value = joinKeywordText(state.ruleConfig.typeKeywords[typeSelect.value]);
}

function syncCurrentTypeKeywordsToConfig() {
  const selected = $("ruleTypeSelect").value;
  state.ruleConfig.typeKeywords[selected] = splitKeywordText($("ruleTypeKeywords").value);
}

function collectRuleConfigFromEditor() {
  syncCurrentTypeKeywordsToConfig();
  return normalizeRuleConfig({
    ...state.ruleConfig,
    flowKeywords: {
      income: splitKeywordText($("flowIncomeKeywords").value),
      expense: splitKeywordText($("flowExpenseKeywords").value)
    },
    typePriority: splitKeywordText($("typePriorityKeywords").value),
    updatedAt: new Date().toISOString()
  });
}

function handleRuleTypeChange() {
  syncCurrentTypeKeywordsToConfig();
  const selected = $("ruleTypeSelect").value;
  $("ruleTypeKeywords").value = joinKeywordText(state.ruleConfig.typeKeywords[selected]);
}

async function handleRuleSave() {
  state.ruleConfig = collectRuleConfigFromEditor();
  await state.repo.saveRuleConfig(state.ruleConfig);
  flash("规则配置已保存");
}

async function handleRuleReset() {
  state.ruleConfig = normalizeRuleConfig(getDefaultRuleConfig());
  renderRuleEditor();
  await state.repo.saveRuleConfig(state.ruleConfig);
  flash("已恢复默认规则");
}

function handleRuleTest() {
  const sample = $("ruleSampleInput").value.trim();
  if (!sample) {
    $("ruleSampleResult").textContent = "测试结果：请输入测试句子";
    return;
  }
  const config = collectRuleConfigFromEditor();
  const result = parseEntry(sample, new Date(), {
    defaultAccountId: "default-cash",
    deviceId: state.deviceId,
    ruleConfig: config
  });
  $("ruleSampleResult").textContent =
    `测试结果：${flowLabel(result.draftEntry.flow)}(${flowTypeLabel(result.draftEntry.flowType)}) / ` +
    `${result.draftEntry.group}-${result.draftEntry.type} / ${result.draftEntry.amount.toFixed(2)} / ${result.draftEntry.note}`;
}

function bindFilterControls() {
  const reapply = () => applyFiltersAndRender();
  $("filterKeyword").addEventListener("input", reapply);
  $("filterFlow").addEventListener("change", reapply);
  $("filterType").addEventListener("change", reapply);
  $("filterGroup").addEventListener("change", reapply);
  $("filterReviewStatus").addEventListener("change", reapply);
  $("filterDateFrom").addEventListener("change", reapply);
  $("filterDateTo").addEventListener("change", reapply);
  $("clearFilters").addEventListener("click", () => {
    $("filterKeyword").value = "";
    $("filterFlow").value = "all";
    $("filterType").value = "";
    $("filterGroup").value = "all";
    $("filterReviewStatus").value = "all";
    $("filterDateFrom").value = "";
    $("filterDateTo").value = "";
    applyFiltersAndRender();
  });
}

function bindReviewControls() {
  $("reviewFlow").addEventListener("change", (event) => {
    updateReviewTypeOptions(event.target.value, getFallbackCategory(event.target.value));
  });
  $("reviewSelectAll").addEventListener("click", handleReviewSelectAll);
  $("reviewClearSelection").addEventListener("click", handleReviewClearSelection);
  $("reviewApplyBatch").addEventListener("click", () => {
    void handleReviewApplyBatch();
  });
  $("reviewQueueBody").addEventListener("change", handleReviewQueueChange);
}

function bindSettingsControls() {
  $("parseMode").value = state.settings.parseMode;
  $("voiceMode").value = state.settings.voiceMode;
  $("alwaysConfirmBeforeSave").checked = state.settings.alwaysConfirmBeforeSave;
  $("proxyBaseUrl").value = state.settings.proxyBaseUrl;

  $("parseMode").addEventListener("change", (event) => {
    state.settings.parseMode = event.target.value;
    saveLocalSettings();
  });

  $("voiceMode").addEventListener("change", (event) => {
    state.settings.voiceMode = event.target.value;
    saveLocalSettings();
  });

  $("alwaysConfirmBeforeSave").addEventListener("change", (event) => {
    state.settings.alwaysConfirmBeforeSave = event.target.checked;
    saveLocalSettings();
  });

  $("providerPreset").addEventListener("change", (event) => {
    fillProviderFromPreset(event.target.value);
  });

  $("saveSettings").addEventListener("click", () => {
    void handleSettingsSave();
  });

  $("checkProxy").addEventListener("click", () => {
    void checkProxyHealth();
  });
}

async function loadProviderSettingsFromProxy() {
  try {
    const result = await fetchProviderSettings({
      baseUrl: state.settings.proxyBaseUrl
    });
    state.providerSettings = {
      ...DEFAULT_PROVIDER_SETTINGS,
      ...result
    };
    renderProviderSettingsForm();
  } catch (error) {
    state.providerSettings = { ...DEFAULT_PROVIDER_SETTINGS };
    renderProviderSettingsForm();
    flash(`读取代理设置失败：${error.message}`, "warn");
  }
}

async function handleSettingsSave() {
  const nextProxyBaseUrl = normalizeBaseUrl($("proxyBaseUrl").value.trim() || DEFAULT_SETTINGS.proxyBaseUrl);
  state.settings.parseMode = $("parseMode").value;
  state.settings.voiceMode = $("voiceMode").value;
  state.settings.alwaysConfirmBeforeSave = $("alwaysConfirmBeforeSave").checked;
  state.settings.proxyBaseUrl = nextProxyBaseUrl;
  saveLocalSettings();

  const apiKeyInput = $("apiKeySecure");
  const apiKey = apiKeyInput.value.trim();

  try {
    const result = await saveProviderSettings({
      baseUrl: state.settings.proxyBaseUrl,
      preset: $("providerPreset").value,
      upstreamBaseUrl: $("upstreamBaseUrl").value.trim(),
      parseModel: $("modelName").value.trim(),
      transcribeModel: $("transcribeModelName").value.trim(),
      apiKey: apiKey || undefined
    });
    state.providerSettings = {
      ...DEFAULT_PROVIDER_SETTINGS,
      ...result
    };
    renderProviderSettingsForm();
    apiKeyInput.value = "";
    flash("设置已保存（API Key 不会回显）");
  } catch (error) {
    flash(`保存设置失败：${error.message}`, "warn");
  }
}

async function checkProxyHealth() {
  try {
    const data = await fetchProxyHealth({
      baseUrl: state.settings.proxyBaseUrl
    });
    if (!data.ok) {
      throw new Error(data.error ?? "代理不可用");
    }
    flash(
      `代理可用：preset=${data.preset}，model=${data.parseModel}，keyConfigured=${data.keyConfigured ? "true" : "false"}`
    );
  } catch (error) {
    flash(`代理检查失败：${error.message}`, "warn");
  }
}

function bindVoice() {
  state.voiceController = createVoiceController({
    getVoiceMode: () => state.settings.voiceMode,
    transcribeWithFallbackApi: ({ audioBase64, mimeType }) =>
      transcribeWithApi({
        audioBase64,
        mimeType,
        baseUrl: state.settings.proxyBaseUrl,
        provider: "openai_compatible",
        model: state.providerSettings.transcribeModel
      }),
    onText: (text) => {
      $("entryInput").value = text;
      flash(`语音识别完成：${text}`);
    },
    onStatus: (status) => {
      setVoiceStatus(status);
    },
    onError: (error) => {
      flash(error instanceof Error ? error.message : "语音输入失败", "warn");
    }
  });

  $("voiceInputBtn").addEventListener("click", () => {
    state.voiceController.toggle();
  });
}

async function init() {
  state.repo = await IndexedDbRepository.create();
  state.ruleConfig = await state.repo.loadRuleConfig();

  bindSettingsControls();
  renderFilterTypeOptions();
  renderFilterGroupOptions();
  bindFilterControls();
  bindReviewControls();

  updatePreviewTypeOptions("expense", getFallbackCategory("expense"));
  updateManualTypeOptions("expense", getFallbackCategory("expense"));
  updateReviewTypeOptions("expense", getFallbackCategory("expense"));
  setTodayToManualForm();

  await loadProviderSettingsFromProxy();
  bindVoice();
  renderRuleEditor();

  $("entryForm").addEventListener("submit", (event) => {
    void handleQuickEntrySubmit(event);
  });
  $("manualEntryForm").addEventListener("submit", (event) => {
    void handleManualEntrySubmit(event);
  });
  $("manualFlow").addEventListener("change", (event) => {
    updateManualTypeOptions(event.target.value, getFallbackCategory(event.target.value));
  });
  $("previewSave").addEventListener("click", () => {
    void handlePreviewSave();
  });
  $("previewCancel").addEventListener("click", hidePreview);
  $("previewFlow").addEventListener("change", (event) => {
    updatePreviewTypeOptions(event.target.value, getFallbackCategory(event.target.value));
  });

  $("entriesBody").addEventListener("click", (event) => {
    void handleTableClick(event);
  });
  $("entriesBody").addEventListener("change", handleTableChange);

  $("exportCsv").addEventListener("click", handleExportCsv);
  $("exportJson").addEventListener("click", handleExportJson);
  $("exportByType").addEventListener("click", handleExportByType);
  $("exportByDay").addEventListener("click", handleExportByDay);
  $("exportByMonth").addEventListener("click", handleExportByMonth);
  $("exportSelectedCsv").addEventListener("click", handleExportSelectedCsv);
  $("importFile").addEventListener("change", (event) => {
    void handleImportFile(event);
  });
  $("clearAll").addEventListener("click", () => {
    void handleClearAll();
  });

  $("ruleTypeSelect").addEventListener("change", handleRuleTypeChange);
  $("ruleTypeKeywords").addEventListener("blur", syncCurrentTypeKeywordsToConfig);
  $("ruleTestBtn").addEventListener("click", handleRuleTest);
  $("ruleSaveBtn").addEventListener("click", () => {
    void handleRuleSave();
  });
  $("ruleResetBtn").addEventListener("click", () => {
    void handleRuleReset();
  });

  await refreshEntries();
  setVoiceStatus("idle");
  const support = hasWebSpeechSupport() ? "支持" : "不支持";
  flash(`就绪：一句话记账、手动新增、行内编辑已启用。当前 Web Speech ${support}`);
}

init().catch((error) => {
  console.error(error);
  flash("初始化失败，请刷新页面重试", "warn");
});
