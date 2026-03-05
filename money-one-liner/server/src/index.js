import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProviderConfigStore } from "./configStore.js";
import {
  createSimpleRateLimiter,
  ensureAudioBase64,
  ensureIsoDate,
  ensureMimeType,
  ensureProvider,
  ensureText,
  handleCors,
  normalizeModel,
  readJsonBody,
  sendJson
} from "./security/validate.js";
import {
  parseLedgerWithOpenAi,
  transcribeAudioWithOpenAi
} from "./providers/openaiCompatible.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const serverConfig = {
  port: Number(process.env.PROXY_PORT ?? 8787)
};

const providerStore = createProviderConfigStore({
  configPath: path.join(projectRoot, "config", "provider.local.json"),
  env: process.env
});

const limiter = createSimpleRateLimiter({ windowMs: 60_000, max: 80 });

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

async function handleParse(req, res) {
  const body = await readJsonBody(req, 512 * 1024);
  ensureProvider(body.provider);
  const text = ensureText(body.text);
  const now = ensureIsoDate(body.now);
  const runtime = providerStore.getRuntimeSettings();
  const model = normalizeModel(body.model, runtime.parseModel);

  if (!runtime.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on proxy server");
  }

  const result = await parseLedgerWithOpenAi({
    apiKey: runtime.apiKey,
    baseUrl: runtime.upstreamBaseUrl,
    text,
    now,
    model
  });

  sendJson(res, 200, { ok: true, result });
}

async function handleTranscribe(req, res) {
  const body = await readJsonBody(req, 12 * 1024 * 1024);
  ensureProvider(body.provider);
  const audioBuffer = ensureAudioBase64(body.audioBase64);
  const mimeType = ensureMimeType(body.mimeType);
  const runtime = providerStore.getRuntimeSettings();
  const model = normalizeModel(body.model, runtime.transcribeModel);

  if (!runtime.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on proxy server");
  }

  const result = await transcribeAudioWithOpenAi({
    apiKey: runtime.apiKey,
    baseUrl: runtime.upstreamBaseUrl,
    audioBuffer,
    mimeType,
    model
  });

  sendJson(res, 200, { ok: true, result });
}

async function handleProviderSettingsUpdate(req, res) {
  const body = await readJsonBody(req, 128 * 1024);
  const result = providerStore.updateSettings({
    preset: body.preset,
    upstreamBaseUrl: body.upstreamBaseUrl,
    parseModel: body.parseModel,
    transcribeModel: body.transcribeModel,
    apiKey: body.apiKey
  });
  sendJson(res, 200, { ok: true, result });
}

const server = http.createServer(async (req, res) => {
  try {
    if (handleCors(req, res)) {
      return;
    }

    const clientKey = getClientKey(req);
    if (!limiter.check(clientKey)) {
      sendJson(res, 429, { ok: false, error: "Too many requests" });
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        status: "up",
        ...providerStore.getPublicSettings()
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/settings/provider") {
      sendJson(res, 200, { ok: true, result: providerStore.getPublicSettings() });
      return;
    }

    if (req.method === "POST" && req.url === "/api/settings/provider") {
      await handleProviderSettingsUpdate(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/parse") {
      await handleParse(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/transcribe") {
      await handleTranscribe(req, res);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    sendJson(res, 400, { ok: false, error: message });
  }
});

server.listen(serverConfig.port, "127.0.0.1", () => {
  console.log(
    `[money-one-liner-proxy] listening on http://127.0.0.1:${serverConfig.port} (key configured: ${providerStore.getPublicSettings().keyConfigured})`
  );
});
