"use strict";

const fs = require("fs");
const path = require("path");

const TABLE = "xjw_app_state";
const INTERNAL_KEY = "internal";
const SOCIAL_KEY = "social";
const SYNC_DELAY_MS = 300;
const POLL_INTERVAL_MS = 1000;

const status = {
  enabled: false,
  connected: false,
  restoredAt: "",
  lastSavedAt: "",
  lastError: "",
};

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();
  return { url, key, enabled: Boolean(url && key) };
}

function files() {
  const internal =
    process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json";
  const social =
    process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json";
  return [
    { key: INTERNAL_KEY, file: internal },
    { key: SOCIAL_KEY, file: social },
  ];
}

function headers() {
  const { key } = config();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
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
    const detail =
      data?.message || data?.hint || data?.details || String(data || "");
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
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
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

function writeLocal(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.restore.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

async function restoreOne(item) {
  const row = await readRemote(item.key);
  if (row?.data && typeof row.data === "object") {
    writeLocal(item.file, row.data);
    return "restored";
  }

  const local = readLocal(item.file);
  if (local) {
    await writeRemote(item.key, local);
    return "seeded";
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
  const timers = new Map();
  const listeners = [];

  for (const item of files()) {
    const listener = (curr, prev) => {
      if (curr.mtimeMs === prev.mtimeMs || curr.size === 0) return;
      clearTimeout(timers.get(item.key));
      timers.set(
        item.key,
        setTimeout(async () => {
          try {
            const data = readLocal(item.file);
            if (data) await writeRemote(item.key, data);
          } catch (error) {
            status.connected = false;
            status.lastError = error.message;
            console.error(`Supabase save failed for ${item.key}`, error.message);
          }
        }, SYNC_DELAY_MS)
      );
    };
    fs.watchFile(item.file, { interval: POLL_INTERVAL_MS }, listener);
    listeners.push({ file: item.file, listener });
  }

  const flush = async () => {
    for (const item of files()) {
      try {
        const data = readLocal(item.file);
        if (data) await writeRemote(item.key, data);
      } catch (error) {
        status.lastError = error.message;
      }
    }
  };

  const shutdown = async () => {
    await flush();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return () => {
    for (const item of listeners) {
      fs.unwatchFile(item.file, item.listener);
    }
  };
}

function health() {
  return {
    ...status,
    table: TABLE,
    storage: status.enabled ? "supabase" : "local-json",
    internalPath:
      process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json",
    socialPath:
      process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json",
  };
}

module.exports = {
  restoreAll,
  startWatching,
  health,
};
