"use strict";

const fs = require("fs");
const path = require("path");

const TABLE = "xjw_app_state";
const INTERNAL_KEY = "internal";
const SOCIAL_KEY = "social";
const POLL_INTERVAL_MS = 1500;
const DEFAULT_SUPABASE_URL = "https://iphexhvjhsmelbgwzhhr.supabase.co";

const status = {
  enabled: false,
  connected: false,
  restoredAt: "",
  lastSavedAt: "",
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

async function restoreOne(item) {
  const local = readLocal(item.file);
  const row = await readRemote(item.key);
  const remote = row?.data;

  if (hasMeaningfulData(remote)) {
    writeLocal(item.file, remote);
    return "restored";
  }

  if (hasMeaningfulData(local)) {
    await writeRemote(item.key, local);
    return "seeded-from-local";
  }

  if (remote && typeof remote === "object") {
    writeLocal(item.file, remote);
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

  const snapshots = new Map();
  for (const item of files()) snapshots.set(item.key, readRaw(item.file));

  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      for (const item of files()) {
        const raw = readRaw(item.file);
        if (!raw || raw === snapshots.get(item.key)) continue;
        const data = JSON.parse(raw);
        await writeRemote(item.key, data);
        snapshots.set(item.key, raw);
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

  const flush = async () => {
    for (const item of files()) {
      try {
        const raw = readRaw(item.file);
        if (!raw) continue;
        const data = JSON.parse(raw);
        await writeRemote(item.key, data);
        snapshots.set(item.key, raw);
      } catch (error) {
        status.lastError = error.message;
      }
    }
  };

  const shutdown = async () => {
    clearInterval(timer);
    await flush();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  setTimeout(poll, 500).unref?.();

  return () => clearInterval(timer);
}

function health() {
  const cfg = config();
  return {
    ...status,
    table: TABLE,
    storage: status.enabled ? "supabase" : "local-json",
    projectUrl: cfg.url,
    internalPath: process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json",
    socialPath: process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json",
  };
}

module.exports = {
  restoreAll,
  startWatching,
  health,
};
