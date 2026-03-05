import { parseWithApi } from "../api/client.js";
import { buildClassificationFields } from "../domain/categories.js";

function sanitizeAiResult(raw, fallbackDate) {
  if (!raw || typeof raw !== "object") {
    return null;
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
    return null;
  }

  return {
    ...classification,
    note: String(raw.note ?? "").trim() || classification.category,
    amount: Number(amount.toFixed(2)),
    date: String(raw.date ?? fallbackDate).slice(0, 10),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.8)))
  };
}

export async function enhanceEntryWithAI({
  text,
  now,
  apiBaseUrl = "http://127.0.0.1:8787",
  provider = "openai_compatible",
  model = "gpt-4.1-mini"
}) {
  const fallbackDate = now.toISOString().slice(0, 10);
  const raw = await parseWithApi({
    text,
    now,
    baseUrl: apiBaseUrl,
    provider,
    model
  });
  return sanitizeAiResult(raw, fallbackDate);
}
