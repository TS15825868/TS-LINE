from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
server_path = root / "server.js"
s = server_path.read_text(encoding="utf-8")

s = s.replace("仙加味 LINE OA Bot v401.3", "仙加味 LINE OA Bot v401.4")
s = s.replace('const VERSION = "v401.3";', 'const VERSION = "v401.4";')
s = s.replace('const MASCOT_VERSION = "401.3";', 'const MASCOT_VERSION = "401.4";')

old_client = 'const client = config.channelAccessToken && config.channelSecret ? new line.Client(config) : null;'
new_client = '''const client = config.channelAccessToken
  ? new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken })
  : null;
let lastWebhookAt = "";
let lastReplySuccessAt = "";
let lastReplyError = "";'''
if old_client not in s:
    raise RuntimeError("找不到舊版 LINE client 初始化")
s = s.replace(old_client, new_client)

old_reply = '''async function reply(token, messages) {
  if (!client) {
    console.warn("LINE credentials are not configured; reply skipped.");
    return;
  }
  try {
    await client.replyMessage(token, Array.isArray(messages) ? messages : [messages]);
  } catch (error) {
    const detail = error?.originalError?.response?.data || error?.response?.data || error.message || error;
    console.error("LINE 回覆失敗：", typeof detail === "object" ? JSON.stringify(detail) : detail);
    return false;
  }
}
'''
new_reply = '''function fallbackReplyText(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  for (const message of list) {
    if (message?.type === "text" && message.text) return String(message.text).slice(0, 5000);
    if (message?.type === "flex" && message.altText) return String(message.altText).slice(0, 5000);
  }
  return "仙加味已收到您的訊息，請稍候再試一次，或輸入「人工客服」。";
}

async function reply(token, messages) {
  if (!client) {
    lastReplyError = "LINE credentials are not configured";
    console.warn("LINE credentials are not configured; reply skipped.");
    return false;
  }

  const normalized = Array.isArray(messages) ? messages : [messages];
  try {
    await client.replyMessage({ replyToken: token, messages: normalized });
    lastReplySuccessAt = new Date().toISOString();
    lastReplyError = "";
    return true;
  } catch (error) {
    const detail = error?.body || error?.originalError?.response?.data || error?.response?.data || error.message || error;
    lastReplyError = typeof detail === "object" ? JSON.stringify(detail).slice(0, 1000) : String(detail).slice(0, 1000);
    console.error("LINE 回覆失敗：", lastReplyError);

    if (normalized.some((message) => message?.type !== "text")) {
      try {
        await client.replyMessage({
          replyToken: token,
          messages: [{
            type: "text",
            text: fallbackReplyText(normalized),
            quickReply: {
              items: mainQuick().slice(0, 13).map((item) => ({
                type: "action",
                action: { type: "message", label: item.label, text: item.text },
              })),
            },
          }],
        });
        lastReplySuccessAt = new Date().toISOString();
        return true;
      } catch (fallbackError) {
        const fallbackDetail = fallbackError?.body || fallbackError?.message || fallbackError;
        lastReplyError += ` | fallback: ${typeof fallbackDetail === "object" ? JSON.stringify(fallbackDetail) : String(fallbackDetail)}`;
        console.error("LINE 純文字備援回覆失敗：", lastReplyError);
      }
    }
    return false;
  }
}
'''
if old_reply not in s:
    raise RuntimeError("找不到舊版 reply 函式")
s = s.replace(old_reply, new_reply)

old_event = '''async function handleEvent(event) {
  if (shouldSkipWebhookEvent(event)) return Promise.resolve();'''
new_event = '''async function handleEvent(event) {
  lastWebhookAt = new Date().toISOString();
  if (shouldSkipWebhookEvent(event)) return Promise.resolve();'''
if old_event not in s:
    raise RuntimeError("找不到 handleEvent")
s = s.replace(old_event, new_event)

old_webhook = '''if (config.channelAccessToken && config.channelSecret) {
  app.post("/webhook", line.middleware(config), async (req, res) => {
    const results = await Promise.allSettled(req.body.events.map(handleEvent));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.error("LINE 事件處理失敗數：" + failed.length);
    }
    res.json({ ok: true });
  });
} else {'''
new_webhook = '''if (config.channelAccessToken && config.channelSecret) {
  app.post("/webhook", line.middleware(config), (req, res) => {
    // 先快速回覆 LINE 200，避免 Render 冷啟動或訊息處理時間造成 webhook 逾時。
    res.json({ ok: true });
    Promise.allSettled((req.body.events || []).map(handleEvent)).then((results) => {
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) console.error("LINE 事件處理失敗數：" + failed.length);
    });
  });
} else {'''
if old_webhook not in s:
    raise RuntimeError("找不到 webhook 區塊")
s = s.replace(old_webhook, new_webhook)

old_health = '''    activeStates: states.size,
  });'''
new_health = '''    activeStates: states.size,
    lastWebhookAt,
    lastReplySuccessAt,
    lastReplyError,
    replyClient: "MessagingApiClient",
  });'''
if old_health not in s:
    raise RuntimeError("找不到 healthz 區塊")
s = s.replace(old_health, new_health)
server_path.write_text(s, encoding="utf-8")

version_files = [
    "data.json", "package.json", "package-lock.json", "test.js", "catalog.test.js",
    "security.test.js", "function.test.js", "image-policy.test.js", "tools/release_check.js",
]
for name in version_files:
    p = root / name
    t = p.read_text(encoding="utf-8")
    t = t.replace("v401.3", "v401.4").replace("401.3", "401.4").replace("4.1.3", "4.1.4")
    p.write_text(t, encoding="utf-8")

keepalive = root / ".github/workflows/keep-render-awake.yml"
keepalive.write_text('''name: Keep LINE OA awake

on:
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    steps:
      - name: Wake and verify Render
        run: |
          set -euo pipefail
          curl --fail --silent --show-error --retry 4 --retry-delay 5 --max-time 45 https://ts-line.onrender.com/healthz
''', encoding="utf-8")

print("LINE OA v401.4 修正完成")
