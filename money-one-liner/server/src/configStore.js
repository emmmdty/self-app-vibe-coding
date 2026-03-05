import fs from "node:fs";
import path from "node:path";

export const PROVIDER_PRESETS = {
  deepseek: {
    label: "DeepSeek",
    upstreamBaseUrl: "https://api.deepseek.com",
    parseModel: "deepseek-chat",
    transcribeModel: "whisper-1"
  },
  openai: {
    label: "OpenAI",
    upstreamBaseUrl: "https://api.openai.com/v1",
    parseModel: "gpt-4.1-mini",
    transcribeModel: "gpt-4o-mini-transcribe"
  },
  groq: {
    label: "Groq",
    upstreamBaseUrl: "https://api.groq.com/openai/v1",
    parseModel: "llama-3.3-70b-versatile",
    transcribeModel: "whisper-large-v3-turbo"
  },
  openrouter: {
    label: "OpenRouter",
    upstreamBaseUrl: "https://openrouter.ai/api/v1",
    parseModel: "openai/gpt-4.1-mini",
    transcribeModel: "openai/whisper-1"
  },
  dashscope_intl: {
    label: "DashScope Intl",
    upstreamBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    parseModel: "qwen-plus",
    transcribeModel: "whisper-1"
  },
  dashscope_cn: {
    label: "DashScope CN",
    upstreamBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    parseModel: "qwen-plus",
    transcribeModel: "whisper-1"
  },
  custom: {
    label: "Custom",
    upstreamBaseUrl: "https://api.openai.com/v1",
    parseModel: "gpt-4.1-mini",
    transcribeModel: "whisper-1"
  }
};

const DEFAULT_PRESET = "deepseek";

function trimString(value) {
  return String(value ?? "").trim();
}

function stripTrailingSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function sanitizePreset(preset, fallback = DEFAULT_PRESET) {
  const raw = trimString(preset);
  if (raw && Object.hasOwn(PROVIDER_PRESETS, raw)) {
    return raw;
  }
  return fallback;
}

function sanitizeBaseUrl(baseUrl, fallback) {
  const raw = trimString(baseUrl);
  const normalized = stripTrailingSlash(raw || fallback);
  if (!/^https?:\/\/\S+$/i.test(normalized)) {
    throw new Error("Invalid upstreamBaseUrl");
  }
  return normalized;
}

function sanitizeModelName(name, fallback) {
  const raw = trimString(name) || fallback;
  if (!raw) {
    throw new Error("Model is required");
  }
  if (raw.length > 120) {
    throw new Error("Model name is too long");
  }
  return raw;
}

function sanitizeApiKey(apiKey) {
  return trimString(apiKey);
}

function buildPublicPresetCatalog() {
  const result = {};
  for (const [key, item] of Object.entries(PROVIDER_PRESETS)) {
    result[key] = {
      label: item.label,
      upstreamBaseUrl: item.upstreamBaseUrl,
      parseModel: item.parseModel,
      transcribeModel: item.transcribeModel
    };
  }
  return result;
}

function normalizeFromPreset(preset, patch = {}, current = {}) {
  const selectedPreset = sanitizePreset(preset, sanitizePreset(current.preset, DEFAULT_PRESET));
  const presetDefaults = PROVIDER_PRESETS[selectedPreset] ?? PROVIDER_PRESETS[DEFAULT_PRESET];
  const switchedPreset = selectedPreset !== current.preset;

  const fallbackBaseUrl = switchedPreset
    ? presetDefaults.upstreamBaseUrl
    : current.upstreamBaseUrl || presetDefaults.upstreamBaseUrl;
  const fallbackParseModel = switchedPreset
    ? presetDefaults.parseModel
    : current.parseModel || presetDefaults.parseModel;
  const fallbackTranscribeModel = switchedPreset
    ? presetDefaults.transcribeModel
    : current.transcribeModel || presetDefaults.transcribeModel;

  const apiKeyCandidate = patch.apiKey;
  const hasNewApiKey = apiKeyCandidate !== undefined && trimString(apiKeyCandidate) !== "";
  const apiKey = hasNewApiKey ? sanitizeApiKey(apiKeyCandidate) : sanitizeApiKey(current.apiKey);

  return {
    provider: "openai_compatible",
    preset: selectedPreset,
    upstreamBaseUrl: sanitizeBaseUrl(patch.upstreamBaseUrl, fallbackBaseUrl),
    parseModel: sanitizeModelName(patch.parseModel, fallbackParseModel),
    transcribeModel: sanitizeModelName(patch.transcribeModel, fallbackTranscribeModel),
    apiKey
  };
}

function readJsonFile(configPath) {
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return parsed;
}

function writeJsonFile(configPath, data) {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${configPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempPath, configPath);
}

function fromEnvironment(env) {
  const preset = sanitizePreset(env.OPENAI_PRESET, DEFAULT_PRESET);
  const defaults = PROVIDER_PRESETS[preset] ?? PROVIDER_PRESETS[DEFAULT_PRESET];
  return normalizeFromPreset(preset, {
    upstreamBaseUrl: env.OPENAI_BASE_URL ?? defaults.upstreamBaseUrl,
    parseModel: env.OPENAI_PARSE_MODEL ?? defaults.parseModel,
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL ?? defaults.transcribeModel,
    apiKey: env.OPENAI_API_KEY ?? ""
  });
}

function toPublicSettings(settings) {
  return {
    provider: settings.provider,
    preset: settings.preset,
    upstreamBaseUrl: settings.upstreamBaseUrl,
    parseModel: settings.parseModel,
    transcribeModel: settings.transcribeModel,
    keyConfigured: Boolean(settings.apiKey),
    presets: buildPublicPresetCatalog()
  };
}

export function createProviderConfigStore({
  configPath,
  env = process.env
}) {
  const fromEnv = fromEnvironment(env ?? {});
  const disk = readJsonFile(configPath);
  let runtime = disk ? normalizeFromPreset(disk.preset, disk, fromEnv) : fromEnv;

  return {
    getRuntimeSettings() {
      return { ...runtime };
    },
    getPublicSettings() {
      return toPublicSettings(runtime);
    },
    updateSettings(patch = {}) {
      runtime = normalizeFromPreset(patch.preset ?? runtime.preset, patch, runtime);
      writeJsonFile(configPath, runtime);
      return toPublicSettings(runtime);
    }
  };
}
