import { ALL_TYPES, buildClassificationFields } from "../../../src/domain/categories.js";

const PARSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    flow: { type: "string", enum: ["expense", "income"] },
    flowType: { type: "string", enum: ["expense", "income", "transfer", "debt_principal", "adjustment"] },
    category: { type: "string", enum: ALL_TYPES },
    type: { type: "string" },
    group: { type: "string" },
    note: { type: "string" },
    amount: { type: "number" },
    date: { type: "string" },
    confidence: { type: "number" },
    categoryConfidence: { type: "number" },
    needsCategoryReview: { type: "boolean" },
    reviewStatus: { type: "string", enum: ["pending", "resolved"] }
  },
  required: ["flow", "type", "note", "amount", "date", "confidence"]
};

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl ?? "").trim();
  if (!raw) {
    return "https://api.openai.com/v1";
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function clamp01(value, fallback = 0.75) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, n));
}

function sanitizeParseResult(raw, fallbackDate) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid parse result");
  }

  const flow = raw.flow === "income" ? "income" : "expense";
  const classification = buildClassificationFields({
    flow,
    flowType: raw.flowType,
    category: raw.category ?? raw.type,
    source: "api",
    confidence: Number(raw.categoryConfidence ?? raw.confidence ?? 0.8),
    needsCategoryReview: raw.needsCategoryReview
  });
  const amount = Number(raw.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Parse result amount is invalid");
  }

  return {
    ...classification,
    note: String(raw.note ?? "").trim() || classification.category,
    amount: Number(amount.toFixed(2)),
    date: String(raw.date ?? fallbackDate).slice(0, 10),
    confidence: Number(clamp01(raw.confidence).toFixed(2)),
    categoryConfidence: Number(clamp01(raw.categoryConfidence, raw.confidence).toFixed(2))
  };
}

export async function parseLedgerWithOpenAi({
  apiKey,
  baseUrl,
  text,
  now,
  model
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  const fallbackDate = now.toISOString().slice(0, 10);
  const prompt = [
    "你是中文记账助手。请把输入文本转换为结构化账单字段。",
    "category 必须是给定枚举之一，无法判断时使用未分类支出或未分类收入。",
    "flowType: expense|income|transfer|debt_principal|adjustment。",
    "date 必须是 YYYY-MM-DD。",
    "amount 必须是大于0的数字。",
    "confidence 为 0 到 1。",
    `基准日期: ${fallbackDate}`,
    `文本: ${text}`
  ].join("\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ledger_entry",
          schema: PARSE_SCHEMA,
          strict: true
        }
      },
      messages: [
        { role: "system", content: "You extract bookkeeping fields from Chinese text." },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Upstream parse request failed (${response.status})`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty parse response");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Parse response is not valid JSON");
  }

  return sanitizeParseResult(parsed, fallbackDate);
}

export async function transcribeAudioWithOpenAi({
  apiKey,
  baseUrl,
  audioBuffer,
  mimeType,
  model
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/audio/transcriptions`;
  const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });
  const filename = mimeType?.includes("wav") ? "speech.wav" : "speech.webm";
  const file = new File([blob], filename, { type: blob.type });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", model);
  formData.append("language", "zh");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Upstream transcribe request failed (${response.status})`;
    throw new Error(message);
  }

  const text = String(data?.text ?? "").trim();
  if (!text) {
    throw new Error("Empty transcription result");
  }
  return {
    text,
    confidence: 0.9
  };
}
