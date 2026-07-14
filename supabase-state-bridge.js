"use strict";

const fs = require("fs");
const path = require("path");

const TABLE = "xjw_app_state";
const INTERNAL_KEY = "internal";
const SOCIAL_KEY = "social";
const POLL_INTERVAL_MS = 1500;
const DEFAULT_SUPABASE_URL = "https://iphexhvjhsmelbgwzhhr.supabase.co";
const snapshots = new Map();

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

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const detail = data?.message || data?.hint || data?.details || String(data || "");
    throw new Error(`Supabase HTTP ${response.status}: ${detail}`);
  }
  return data;
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
    body: JSON.stringify([
      {
        key,
        data,
        updated_at: new Date().toISOString(),
      },
    ]),
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

async function saveState(key, data) {
  if (!config().enabled) return false;
  if (![INTERNAL_KEY, SOCIAL_KEY].includes(key)) throw new Error(`不支援的 Supabase 狀態鍵：${key}`);
  try {
    await writeRemote(key, data);
    return true;
  } catch (error) {
    status.connected = false;
    status.lastError = error.message;
    console.error(`Supabase immediate save failed for ${key}`, error.message);
    return false;
  }
}

async function saveFile(key, file) {
  const raw = readRaw(file);
  if (!raw) return false;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    status.lastError = `JSON parse failed for ${key}: ${error.message}`;
    return false;
  }
  const saved = await saveState(key, data);
  if (saved) snapshots.set(key, raw);
  return saved;
}

async function syncAll() {
  if (!config().enabled) return { enabled: false, saved: [] };
  const saved = [];
  for (const item of files()) {
    if (await saveFile(item.key, item.file)) saved.push(item.key);
  }
  return { enabled: true, saved };
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
    for (const item of files()) {
      results.push({ key: item.key, result: await restoreOne(item) });
    }
    status.connected = true;
    status.restoredAt = new Date().toISOString();
    status.lastVerifiedAt = status.restoredAt;
    status.lastError = "";
    return { enabled: true, results };
  } catch (error) {
    status.connected = false;
    status.lastError = error.message;
    console.error("Supabase restore failed", error.message);
    return { enabled: true, error: error.message, results: [] };
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
    } catch (error) {
      status.connected = false;
      status.lastError = error.message;
      console.error("Supabase save failed", error.message);
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
      status.lastError = error.message;
    }
  }, 5 * 60 * 1000);
  verifyTimer.unref?.();

  const shutdown = async () => {
    clearInterval(timer);
    clearInterval(verifyTimer);
    await syncAll();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  setTimeout(poll, 500).unref?.();

  return () => {
    clearInterval(timer);
    clearInterval(verifyTimer);
  };
}

function health() {
  const cfg = config();
  return {
    ...status,
    enabled: cfg.enabled,
    table: TABLE,
    storage: cfg.enabled ? "supabase" : "local-json",
    projectUrl: cfg.url,
    internalPath: process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json",
    socialPath: process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json",
  };
}

module.exports = {
  INTERNAL_KEY,
  SOCIAL_KEY,
  restoreAll,
  startWatching,
  saveState,
  saveFile,
  syncAll,
  health,
};
