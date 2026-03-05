const DEFAULT_TIMEOUT_MS = 15000;

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl ?? "").trim();
  if (!raw) {
    return "http://127.0.0.1:8787";
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function requestJson({
  url,
  method = "POST",
  body = undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseWithApi({
  text,
  now,
  baseUrl,
  provider = "openai_compatible",
  model = "gpt-4.1-mini"
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/api/parse`;
  const payload = {
    text,
    now: now.toISOString(),
    provider,
    model
  };
  const data = await requestJson({
    url: endpoint,
    method: "POST",
    body: payload
  });
  return data.result;
}

export async function transcribeWithApi({
  audioBase64,
  mimeType,
  baseUrl,
  provider = "openai_compatible",
  model = "gpt-4o-mini-transcribe"
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/api/transcribe`;
  const payload = {
    audioBase64,
    mimeType,
    provider,
    model
  };
  const data = await requestJson({
    url: endpoint,
    method: "POST",
    body: payload,
    timeoutMs: 25000
  });
  return data.result;
}

export async function fetchProviderSettings({
  baseUrl
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/api/settings/provider`;
  const data = await requestJson({
    url: endpoint,
    method: "GET"
  });
  return data.result;
}

export async function saveProviderSettings({
  baseUrl,
  preset,
  upstreamBaseUrl,
  parseModel,
  transcribeModel,
  apiKey
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/api/settings/provider`;
  const payload = {
    preset,
    upstreamBaseUrl,
    parseModel,
    transcribeModel,
    apiKey
  };
  const data = await requestJson({
    url: endpoint,
    method: "POST",
    body: payload
  });
  return data.result;
}

export async function fetchProxyHealth({
  baseUrl
}) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/api/health`;
  const data = await requestJson({
    url: endpoint,
    method: "GET"
  });
  return data;
}
