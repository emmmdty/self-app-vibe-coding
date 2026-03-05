const DEFAULT_BODY_LIMIT = 10 * 1024 * 1024;

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

export function handleCors(req, res) {
  if (req.method !== "OPTIONS") {
    return false;
  }
  sendJson(res, 204, {});
  return true;
}

export async function readJsonBody(req, maxBytes = DEFAULT_BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", (error) => reject(error));
  });
}

export function normalizeModel(model, fallback) {
  const raw = String(model ?? "").trim();
  if (!raw) {
    return fallback;
  }
  if (raw.length > 120) {
    throw new Error("Model name is too long");
  }
  return raw;
}

export function ensureProvider(provider) {
  const raw = String(provider ?? "openai_compatible").trim();
  if (raw !== "openai_compatible") {
    throw new Error("Unsupported provider");
  }
  return raw;
}

export function ensureText(text) {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    throw new Error("Text is required");
  }
  if (normalized.length > 1000) {
    throw new Error("Text too long");
  }
  return normalized;
}

export function ensureIsoDate(isoDate) {
  const value = String(isoDate ?? "").trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

export function ensureAudioBase64(audioBase64) {
  const normalized = String(audioBase64 ?? "").trim();
  if (!normalized) {
    throw new Error("audioBase64 is required");
  }
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length) {
    throw new Error("Invalid audio content");
  }
  const maxAudioBytes = 8 * 1024 * 1024;
  if (buffer.length > maxAudioBytes) {
    throw new Error("Audio too large");
  }
  return buffer;
}

export function ensureMimeType(mimeType) {
  const value = String(mimeType ?? "").trim();
  if (!value) {
    return "audio/webm";
  }
  return value;
}

export function createSimpleRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  const map = new Map();
  return {
    check(key) {
      const now = Date.now();
      const arr = map.get(key) ?? [];
      const recent = arr.filter((timestamp) => now - timestamp <= windowMs);
      recent.push(now);
      map.set(key, recent);
      return recent.length <= max;
    }
  };
}
