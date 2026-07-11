"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "server.js");
let server = fs.readFileSync(serverPath, "utf8");

// LINE Flex Image aspectMode only accepts "fit" or "cover".
server = server.replace(/aspectMode: "contain"/g, 'aspectMode: "fit"');

// Never throw the full Axios error because it contains Authorization headers.
server = server.replace(
`    const detail = error?.originalError?.response?.data || error?.response?.data || error.message || error;
    console.error("LINE 回覆失敗：", typeof detail === "object" ? JSON.stringify(detail) : detail);
    throw error;`,
`    const detail = error?.originalError?.response?.data || error?.response?.data || error.message || error;
    console.error("LINE 回覆失敗：", typeof detail === "object" ? JSON.stringify(detail) : detail);
    return false;`
);

// Add webhook event de-duplication state near the user state map.
if (!server.includes("const processedWebhookEvents = new Map();")) {
  server = server.replace(
    "const states = new Map();",
`const states = new Map();
const processedWebhookEvents = new Map();
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
}`
  );
}

// Ensure every event is only handled once.
server = server.replace(
`async function handleEvent(event) {
  if (event.type === "follow") {`,
`async function handleEvent(event) {
  if (shouldSkipWebhookEvent(event)) return Promise.resolve();
  if (event.type === "follow") {`
);

// Always acknowledge valid webhook requests with HTTP 200 to stop LINE redelivery loops.
server = server.replace(
`  app.post("/webhook", line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
      .then(() => res.json({ ok: true }))
      .catch((error) => {
        console.error(error);
        res.status(500).json({ ok: false });
      });
  });`,
`  app.post("/webhook", line.middleware(config), async (req, res) => {
    const results = await Promise.allSettled(req.body.events.map(handleEvent));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.error("LINE 事件處理失敗數：" + failed.length);
    }
    res.json({ ok: true });
  });`
);

fs.writeFileSync(serverPath, server, "utf8");

const testPath = path.join(root, "function.test.js");
let tests = fs.readFileSync(testPath, "utf8");
tests = tests.replace(/assert\.strictEqual\(bubble\.hero\.aspectMode, "contain"\);/g, 'assert.strictEqual(bubble.hero.aspectMode, "fit");');
fs.writeFileSync(testPath, tests, "utf8");

console.log("Applied LINE Flex aspectMode, webhook de-duplication, and safe logging fixes");
