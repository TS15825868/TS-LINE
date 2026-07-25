"use strict";

const fs = require("fs");
const path = require("path");

const VERSION = "1.2.0";
const TABLE = "xjw_app_state";
const INTERNAL_KEY = "internal";
const SOCIAL_KEY = "social";
const POLL_INTERVAL_MS = Number(process.env.SUPABASE_POLL_INTERVAL_MS || 2500);
const REQUEST_TIMEOUT_MS = Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS || 15000);
const REQUEST_RETRIES = Math.max(0, Number(process.env.SUPABASE_REQUEST_RETRIES || 2));
const RETRY_BASE_MS = Number(process.env.SUPABASE_RETRY_BASE_MS || 15000);
const RETRY_MAX_MS = Number(process.env.SUPABASE_RETRY_MAX_MS || 5 * 60 * 1000);
const ERROR_LOG_COOLDOWN_MS = Number(process.env.SUPABASE_ERROR_LOG_COOLDOWN_MS || 5 * 60 * 1000);
const DEFAULT_SUPABASE_URL = "https://iphexhvjhsmelbgwzhhr.supabase.co";

const snapshots = new Map();
const saveChains = new Map();
const failureCounts = new Map();
const retryAfterAt = new Map();
const lastErrorLogAt = new Map();

const status = {
  enabled: false,
  connected: false,
  restoredAt: "",
  lastSavedAt: "",
  lastVerifiedAt: "",
  lastError: "",
};

function config() {
  const url = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();
  return { url, key, enabled: Boolean(url && key) };
}

function files() {
  const internal = process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json";
  const social = process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json";
  return [
    { key: INTERNAL_KEY, file: internal },
    { key: SOCIAL_KEY, file: social },
  ];
}

function headers() {
  const { key } = config();
  const result = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (key.startsWith("eyJ")) result.Authorization = `Bearer ${key}`;
  return result;
}

function endpoint(query = "") {
  const { url } = config();
  return `${url}/rest/v1/${TABLE}${query}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function retryAfterMs(response, attempt) {
  const raw = response?.headers?.get?.("retry-after") || "";
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(RETRY_MAX_MS, seconds * 1000);
  const parsedDate = Date.parse(raw);
  if (Number.isFinite(parsedDate)) return Math.min(RETRY_MAX_MS, Math.max(0, parsedDate - Date.now()));
  return Math.min(RETRY_MAX_MS, 800 * (2 ** attempt));
}

function isRetriableStatus(statusCode) {
  return [408, 425, 429].includes(Number(statusCode)) || Number(statusCode) >= 500;
}

function errorText(error) {
  if (error?.name === "AbortError") return `request timeout after ${REQUEST_TIMEOUT_MS}ms`;
  return String(error?.message || error || "unknown error");
}

function logErrorThrottled(scope, message) {
  const now = Date.now();
  const previous = Number(lastErrorLogAt.get(scope) || 0);
  if (now - previous < ERROR_LOG_COOLDOWN_MS) return;
  lastErrorLogAt.set(scope, now);
  console.error(message);
}

async function request(url, options = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref?.();
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { ...headers(), ...(options.headers || {}) },
      });
      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); }
        catch { data = text; }
      }
      if (response.ok) return data;
      const detail = data?.message || data?.hint || data?.details || String(data || "");
      const error = new Error(`Supabase HTTP ${response.status}: ${detail}`);
      error.statusCode = response.status;
      lastError = error;
      if (attempt < REQUEST_RETRIES && isRetriableStatus(response.status)) {
        await sleep(retryAfterMs(response, attempt));
        continue;
      }
      throw error;
    } catch (error) {
      lastError = error;
      const networkFailure = error?.name === "AbortError" || /fetch failed|network|socket|timeout|ECONN|ENOTFOUND/i.test(errorText(error));
      if (attempt < REQUEST_RETRIES && networkFailure) {
        await sleep(Math.min(RETRY_MAX_MS, 800 * (2 ** attempt)));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Supabase request failed");
}

async function readRemote(key) {
  const query = `?key=eq.${encodeURIComponent(key)}&select=data,updated_at&limit=1`;
  const rows = await request(endpoint(query), { method: "GET" });
  status.lastVerifiedAt = new Date().toISOString();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function writeRemote(key, data) {
  await request(endpoint("?on_conflict=key"), {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      key,
      data,
      updated_at: new Date().toISOString(),
    }]),
  });
  status.connected = true;
  status.lastSavedAt = new Date().toISOString();
  status.lastVerifiedAt = status.lastSavedAt;
  status.lastError = "";
}

function readLocal(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readRaw(file) {
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function writeLocal(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.restore.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

function hasMeaningfulData(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data)) return data.length > 0;
  return Object.keys(data).length > 0;
}

function backoffFor(key) {
  const count = Math.max(1, Number(failureCounts.get(key) || 1));
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.min(5, count - 1)));
}

function markFailure(key, error) {
  const count = Number(failureCounts.get(key) || 0) + 1;
  failureCounts.set(key, count);
  retryAfterAt.set(key, Date.now() + backoffFor(key));
  status.connected = false;
  status.lastError = errorText(error);
  logErrorThrottled(key, `Supabase save temporarily unavailable for ${key}: ${status.lastError}; centralized retry backoff active`);
}

function markSuccess(key) {
  failureCounts.delete(key);
  retryAfterAt.delete(key);
  lastErrorLogAt.delete(key);
}

async function saveState(key, data) {
  if (!config().enabled) return false;
  if (![INTERNAL_KEY, SOCIAL_KEY].includes(key)) throw new Error(`不支援的 Supabase 狀態鍵：${key}`);
  try {
    await writeRemote(key, data);
    markSuccess(key);
    return true;
  } catch (error) {
    markFailure(key, error);
    return false;
  }
}

function enqueueKeySave(key, task) {
  const previous = saveChains.get(key) || Promise.resolve(true);
  const current = previous
    .catch(() => false)
    .then(task)
    .finally(() => {
      if (saveChains.get(key) === current) saveChains.delete(key);
    });
  saveChains.set(key, current);
  return current;
}

async function saveFileNow(key, file, { force = false } = {}) {
  const raw = readRaw(file);
  if (!raw) return false;
  if (!force && raw === snapshots.get(key)) return true;
  if (!force && Date.now() < Number(retryAfterAt.get(key) || 0)) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    status.lastError = `JSON parse failed for ${key}: ${error.message}`;
    logErrorThrottled(`${key}:json`, status.lastError);
    return false;
  }

  const saved = await saveState(key, data);
  if (saved) snapshots.set(key, raw);
  return saved;
}

function saveFile(key, file, options = {}) {
  return enqueueKeySave(key, () => saveFileNow(key, file, options));
}

async function syncAll({ force = false } = {}) {
  if (!config().enabled) return { enabled: false, saved: [], skipped: [] };
  const saved = [];
  const skipped = [];
  for (const item of files()) {
    const before = snapshots.get(item.key);
    const raw = readRaw(item.file);
    const ok = await saveFile(item.key, item.file, { force });
    if (ok && (force || raw !== before)) saved.push(item.key);
    else if (ok) skipped.push(item.key);
  }
  return { enabled: true, saved, skipped };
}

async function restoreOne(item) {
  const local = readLocal(item.file);
  const row = await readRemote(item.key);
  const remote = row?.data;

  if (hasMeaningfulData(remote)) {
    writeLocal(item.file, remote);
    snapshots.set(item.key, readRaw(item.file));
    return "restored";
  }
  if (hasMeaningfulData(local)) {
    await writeRemote(item.key, local);
    snapshots.set(item.key, readRaw(item.file));
    return "seeded-from-local";
  }
  if (remote && typeof remote === "object") {
    writeLocal(item.file, remote);
    snapshots.set(item.key, readRaw(item.file));
    return "initialized-empty";
  }
  return "empty";
}

async function restoreAll() {
  const cfg = config();
  status.enabled = cfg.enabled;
  if (!cfg.enabled) return { enabled: false, results: [] };
  try {
    const results = [];
    for (const item of files()) results.push({ key: item.key, result: await restoreOne(item) });
    status.connected = true;
    status.restoredAt = new Date().toISOString();
    status.lastVerifiedAt = status.restoredAt;
    status.lastError = "";
    return { enabled: true, results };
  } catch (error) {
    status.connected = false;
    status.lastError = errorText(error);
    logErrorThrottled("restore", `Supabase restore temporarily unavailable: ${status.lastError}`);
    return { enabled: true, error: status.lastError, results: [] };
  }
}

function startWatching() {
  if (!config().enabled) return () => {};
  for (const item of files()) {
    if (!snapshots.has(item.key)) snapshots.set(item.key, readRaw(item.file));
  }

  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      for (const item of files()) {
        const raw = readRaw(item.file);
        if (!raw || raw === snapshots.get(item.key)) continue;
        await saveFile(item.key, item.file);
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(poll, POLL_INTERVAL_MS);
  timer.unref?.();
  const verifyTimer = setInterval(async () => {
    if (!config().enabled) return;
    try {
      await readRemote(INTERNAL_KEY);
      status.connected = true;
      status.lastError = "";
    } catch (error) {
      status.connected = false;
      status.lastError = errorText(error);
      logErrorThrottled("verify", `Supabase verification temporarily unavailable: ${status.lastError}`);
    }
  }, 5 * 60 * 1000);
  verifyTimer.unref?.();

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(timer);
    clearInterval(verifyTimer);
    await syncAll({ force: false });
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  setTimeout(poll, 750).unref?.();

  return () => {
    clearInterval(timer);
    clearInterval(verifyTimer);
  };
}

function health() {
  const cfg = config();
  return {
    ...status,
    version: VERSION,
    enabled: cfg.enabled,
    table: TABLE,
    storage: cfg.enabled ? "supabase" : "local-json",
    projectUrl: cfg.url,
    internalPath: process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json",
    socialPath: process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json",
    activeSaveKeys: [...saveChains.keys()],
    retryBackoff: Object.fromEntries([...retryAfterAt.entries()].map(([key, value]) => [key, new Date(value).toISOString()])),
  };
}

module.exports = {
  VERSION,
  INTERNAL_KEY,
  SOCIAL_KEY,
  POLL_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  REQUEST_RETRIES,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  restoreAll,
  startWatching,
  saveState,
  saveFile,
  syncAll,
  health,
};