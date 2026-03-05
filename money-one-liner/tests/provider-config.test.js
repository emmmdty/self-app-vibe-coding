import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProviderConfigStore } from "../server/src/configStore.js";

function createTempConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "money-one-liner-"));
  return path.join(dir, "provider.local.json");
}

test("uses deepseek preset defaults when no file/env config exists", () => {
  const store = createProviderConfigStore({
    configPath: createTempConfigPath(),
    env: {}
  });
  const runtime = store.getRuntimeSettings();
  assert.equal(runtime.preset, "deepseek");
  assert.equal(runtime.upstreamBaseUrl, "https://api.deepseek.com");
  assert.equal(runtime.parseModel, "deepseek-chat");
});

test("updates api key without returning plaintext key", () => {
  const store = createProviderConfigStore({
    configPath: createTempConfigPath(),
    env: {}
  });
  store.updateSettings({
    preset: "openai",
    upstreamBaseUrl: "https://api.openai.com/v1",
    parseModel: "gpt-4.1-mini",
    transcribeModel: "whisper-1",
    apiKey: "sk-secret-123"
  });
  const pub = store.getPublicSettings();
  assert.equal(pub.keyConfigured, true);
  assert.equal(pub.apiKey, undefined);
  assert.equal(pub.preset, "openai");
});

test("keeps existing key when update payload does not include apiKey", () => {
  const store = createProviderConfigStore({
    configPath: createTempConfigPath(),
    env: {}
  });
  store.updateSettings({ apiKey: "sk-first-key" });
  store.updateSettings({ preset: "groq", apiKey: "" });
  const runtime = store.getRuntimeSettings();
  assert.equal(runtime.apiKey, "sk-first-key");
  assert.equal(runtime.preset, "groq");
});
