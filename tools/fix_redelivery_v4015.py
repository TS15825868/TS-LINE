from pathlib import Path

root = Path(__file__).resolve().parents[1]
server_path = root / "server.js"
s = server_path.read_text(encoding="utf-8")

s = s.replace("仙加味 LINE OA Bot v401.4", "仙加味 LINE OA Bot v401.5")
s = s.replace('const VERSION = "v401.4";', 'const VERSION = "v401.5";')
s = s.replace('const MASCOT_VERSION = "401.4";', 'const MASCOT_VERSION = "401.5";')

old = '''const processedWebhookEvents = new Map();
const WEBHOOK_EVENT_TTL_MS = 10 * 60 * 1000;

function shouldSkipWebhookEvent(event) {
  const id = String(event?.webhookEventId || "");
  if (event?.deliveryContext?.isRedelivery) {
    console.warn("略過 LINE 重送事件：" + (id || "unknown"));
    return true;
  }
  if (!id) return false;
  const now = Date.now();
  for (const [key, createdAt] of processedWebhookEvents) {
    if (now - createdAt > WEBHOOK_EVENT_TTL_MS) processedWebhookEvents.delete(key);
  }
  if (processedWebhookEvents.has(id)) return true;
  processedWebhookEvents.set(id, now);
  return false;
}
'''

new = '''const processedWebhookEvents = new Map();
const processingWebhookEvents = new Set();
const WEBHOOK_EVENT_TTL_MS = 10 * 60 * 1000;

function cleanupWebhookEventCache(now = Date.now()) {
  for (const [key, createdAt] of processedWebhookEvents) {
    if (now - createdAt > WEBHOOK_EVENT_TTL_MS) processedWebhookEvents.delete(key);
  }
}

function beginWebhookEvent(event) {
  const id = String(event?.webhookEventId || "");
  cleanupWebhookEventCache();
  if (!id) return true;
  if (processedWebhookEvents.has(id) || processingWebhookEvents.has(id)) return false;
  processingWebhookEvents.add(id);
  return true;
}

function finishWebhookEvent(event, success) {
  const id = String(event?.webhookEventId || "");
  if (!id) return;
  processingWebhookEvents.delete(id);
  if (success) processedWebhookEvents.set(id, Date.now());
}
'''

if old not in s:
    raise RuntimeError("找不到舊版 webhook 去重區塊")
s = s.replace(old, new)

old_handle = '''async function handleEvent(event) {
  lastWebhookAt = new Date().toISOString();
  if (shouldSkipWebhookEvent(event)) return Promise.resolve();
  if (event.type === "follow") {
    return reply(
      event.replyToken,
      mascotWelcomeReply()
    );
  }
  if (event.type === "postback") return handleLegacyPostback(event);
  if (event.type === "message") return handleMessage(event);
  return Promise.resolve();
}
'''

new_handle = '''async function handleEvent(event) {
  lastWebhookAt = new Date().toISOString();
  if (!beginWebhookEvent(event)) return Promise.resolve();

  try {
    let result;
    if (event.type === "follow") {
      result = await reply(event.replyToken, mascotWelcomeReply());
    } else if (event.type === "postback") {
      result = await handleLegacyPostback(event);
    } else if (event.type === "message") {
      result = await handleMessage(event);
    } else {
      result = true;
    }

    const success = result !== false;
    finishWebhookEvent(event, success);
    return result;
  } catch (error) {
    finishWebhookEvent(event, false);
    throw error;
  }
}
'''

if old_handle not in s:
    raise RuntimeError("找不到舊版 handleEvent")
s = s.replace(old_handle, new_handle)

s = s.replace('    activeStates: states.size,\n    lastWebhookAt,', '    activeStates: states.size,\n    processedWebhookEvents: processedWebhookEvents.size,\n    processingWebhookEvents: processingWebhookEvents.size,\n    lastWebhookAt,')

s = s.replace('  detectWebsiteIntent,\n};', '  detectWebsiteIntent,\n  beginWebhookEvent,\n  finishWebhookEvent,\n};')
server_path.write_text(s, encoding="utf-8")

for name in ["data.json", "package.json", "package-lock.json", "test.js", "catalog.test.js", "security.test.js", "function.test.js", "image-policy.test.js", "tools/release_check.js"]:
    p = root / name
    t = p.read_text(encoding="utf-8")
    t = t.replace("v401.4", "v401.5").replace("401.4", "401.5").replace("4.1.4", "4.1.5")
    p.write_text(t, encoding="utf-8")

print("LINE OA v401.5 重送事件修正完成")
