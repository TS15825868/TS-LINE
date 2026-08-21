"use strict";

/**
 * LINE OA 人工客服個人 LINE 提醒
 * - 正式通知對象由 OWNER_LINE_USER_ID 環境變數指定，不硬編碼任何個人 ID。
 * - 客人輸入「我要人工客服／人工客服／客服協助／聯絡客服」時，可推播提醒管理員私人 LINE。
 * - 第一次可由管理員本人傳「綁定人工客服通知」；服務會在當次執行期暫存該 userId 並寫入安全日誌，
 *   後續再由維運把該 ID 固定到 Render OWNER_LINE_USER_ID，避免重啟後遺失。
 * - 不讀取、不轉送其他聊天內容；提醒只包含人工客服觸發文字與時間。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260821-owner-support-alert-v1";
const BIND_COMMAND = "綁定人工客服通知";
const SUPPORT_PATTERN = /^(?:我要)?(?:人工客服|客服協助|聯絡客服|找客服)$/;

function ownerUserId() {
  return String(process.env.OWNER_LINE_USER_ID || "").trim();
}

function buildClient() {
  const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
  return token ? new line.messagingApi.MessagingApiClient({ channelAccessToken: token }) : null;
}

async function pushOwnerAlert(event, text) {
  const owner = ownerUserId();
  const client = buildClient();
  if (!owner || !client) return false;
  const sourceUserId = String(event?.source?.userId || "").trim();
  const stamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  const message = [
    "【仙加味｜人工客服提醒】",
    "有顧客要求人工協助。",
    `時間：${stamp}`,
    `訊息：${String(text || "人工客服").slice(0, 80)}`,
    sourceUserId ? `顧客識別：${sourceUserId.slice(0, 10)}…` : "",
    "請開啟 LINE Official Account Manager 查看最新聊天室。",
  ].filter(Boolean).join("\n");
  await client.pushMessage({ to: owner, messages: [{ type: "text", text: message }] });
  return true;
}

function inspectEvents(req) {
  const events = Array.isArray(req?.body?.events) ? req.body.events : [];
  for (const event of events) {
    if (event?.type !== "message" || event?.message?.type !== "text") continue;
    const text = String(event.message.text || "").trim();
    const sourceUserId = String(event?.source?.userId || "").trim();

    if (text === BIND_COMMAND && sourceUserId) {
      if (!ownerUserId()) process.env.OWNER_LINE_USER_ID = sourceUserId;
      console.log(`[XJW_OWNER_BIND] ${sourceUserId}`);
      continue;
    }

    if (SUPPORT_PATTERN.test(text)) {
      pushOwnerAlert(event, text).then((ok) => {
        if (ok) console.log("[XJW_OWNER_ALERT] sent");
        else console.log("[XJW_OWNER_ALERT] skipped: OWNER_LINE_USER_ID not configured");
      }).catch((error) => console.error("[XJW_OWNER_ALERT] failed", error?.message || error));
    }
  }
}

function install(app) {
  if (!app || typeof app.post !== "function" || app.__xjwOwnerAlertInstalled) return app;
  const nativePost = app.post.bind(app);
  app.post = function xjwOwnerAlertPost(path, ...handlers) {
    if (String(path) !== "/webhook" || handlers.length < 2) return nativePost(path, ...handlers);
    const finalHandler = handlers.pop();
    if (typeof finalHandler !== "function") return nativePost(path, ...handlers, finalHandler);
    const inspectMiddleware = function xjwOwnerAlertMiddleware(req, _res, next) {
      try { inspectEvents(req); } catch (error) { console.error("[XJW_OWNER_ALERT] inspect failed", error?.message || error); }
      next();
    };
    return nativePost(path, ...handlers, inspectMiddleware, finalHandler);
  };
  Object.defineProperty(app, "__xjwOwnerAlertInstalled", { value: true, enumerable: false });
  return app;
}

module.exports = { VERSION, BIND_COMMAND, SUPPORT_PATTERN, ownerUserId, pushOwnerAlert, inspectEvents, install };
