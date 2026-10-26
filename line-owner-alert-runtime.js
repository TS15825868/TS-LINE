"use strict";

/**
 * LINE OA 人工客服個人 LINE 提醒
 * - 正式通知對象由 OWNER_LINE_USER_ID 環境變數指定，不硬編碼任何個人 ID。
 * - 客人輸入「我要人工客服／人工客服／客服協助／聯絡客服」時，可推播提醒管理員私人 LINE。
 * - 管理員接收者只可由受保護的 OWNER_LINE_USER_ID 正式環境設定。
 * - 「綁定人工客服通知」為已停用的舊指令；任何顧客訊息都無權修改通知對象。
 * - 不讀取、不轉送其他聊天內容；提醒只包含人工客服觸發文字與時間。
 */
const line = require("@line/bot-sdk");

const VERSION = "20261026-owner-alert-secure-binding-v2";
const BIND_COMMAND = "綁定人工客服通知";
const SUPPORT_PATTERN = /^(?:我要)?(?:人工客服|客服協助|聯絡客服|找客服)$/;

// LINE may redeliver the SAME webhook event. Send one manager notification
// per signed webhookEventId, including while an earlier push is in flight.
// Keep bounded state and do not log event IDs or customer text. A failed or
// ambiguous push is not auto-retried with the same event ID.
const ownerAlertReceipts = new Map();
const OWNER_ALERT_DEDUP_TTL_MS = 60 * 60 * 1000;
const OWNER_ALERT_RECEIPT_LIMIT = 10000;
let lastOwnerAlertPruneAt = 0;
function claimOwnerAlertEvent(event) {
  const id = String(event?.webhookEventId || "").trim();
  if (!id) return true; // Legacy events without IDs keep existing behavior.
  const now = Date.now();
  if (now - lastOwnerAlertPruneAt > 60000 ||
      ownerAlertReceipts.size >= OWNER_ALERT_RECEIPT_LIMIT) {
    for (const [key, createdAt] of ownerAlertReceipts) {
      if (now - createdAt > OWNER_ALERT_DEDUP_TTL_MS) ownerAlertReceipts.delete(key);
    }
    lastOwnerAlertPruneAt = now;
  }
  if (ownerAlertReceipts.has(id)) return false;
  if (ownerAlertReceipts.size >= OWNER_ALERT_RECEIPT_LIMIT) {
    ownerAlertReceipts.delete(ownerAlertReceipts.keys().next().value);
  }
  ownerAlertReceipts.set(id, now);
  return true;
}


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
  const noticeText = String(text || "人工客服");
  const isPartner = /^【商家(?:合作洽談|採購詢價)】/.test(noticeText);
  const isRetailQuote = /^【LINE 選購需求｜待人工報價】/.test(noticeText);
  const isOrderHandoff = isPartner || isRetailQuote;
  // Checkout clears a confirmed quote from volatile cart state. Do not lose
  // customer contact, shipping or product quantities after a successful push.
  // Only the explicitly configured owner can receive the structured details.
  const noticeTitle = isPartner ? "【仙加味｜新商家合作／採購洽詢】"
    : isRetailQuote ? "【仙加味｜新商品詢價／待人工報價】"
    : "【仙加味｜人工客服提醒】";
  const noticeIntroduction = isPartner
    ? "有商家提交合作或採購需求，請優先查看。"
    : isRetailQuote ? "有顧客提交商品選購需求，尚未成立正式訂單，請人工確認。"
    : "有顧客要求人工協助。";
  const message = [
    noticeTitle,
    noticeIntroduction,
    `時間：${stamp}`,
    `訊息：${noticeText.slice(0, isOrderHandoff ? 3800 : 80)}`,
    sourceUserId ? `顧客識別：${sourceUserId.slice(0, 10)}…` : "",
    "請開啟 LINE Official Account Manager 查看最新聊天室。",
  ].filter(Boolean).join("\n");
  await client.pushMessage({ to: owner, messages: [{ type: "text", text: message }] });
  return true;
}

function inspectEvents(req) {
  const events = Array.isArray(req?.body?.events) ? req.body.events : [];
  for (const event of events) {
    if (event?.type !== "message" || event?.message?.type !== "text" ||
        event?.source?.type !== "user" || !String(event?.source?.userId || "").trim()) continue;
    const text = String(event.message.text || "").trim();

    // Reject unauthenticated enrollment. Only the protected deployment
    // environment may define a manager, never a chat command.
    if (text === BIND_COMMAND) {
      console.warn("[XJW_OWNER_BIND] ignored legacy chat binding; configure secure environment");
      continue;
    }

    if (SUPPORT_PATTERN.test(text) && claimOwnerAlertEvent(event)) {
      pushOwnerAlert(event, text).then((ok) => {
        if (ok) console.log("[XJW_OWNER_ALERT] sent");
        else console.log("[XJW_OWNER_ALERT] skipped: OWNER_LINE_USER_ID not configured");
      }).catch(() => console.error("[XJW_OWNER_ALERT] failed (private error details withheld)"));
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
      try { inspectEvents(req); } catch { console.error("[XJW_OWNER_ALERT] inspect failed (private error details withheld)"); }
      next();
    };
    return nativePost(path, ...handlers, inspectMiddleware, finalHandler);
  };
  Object.defineProperty(app, "__xjwOwnerAlertInstalled", { value: true, enumerable: false });
  return app;
}

module.exports = { VERSION, BIND_COMMAND, SUPPORT_PATTERN, ownerUserId, pushOwnerAlert, inspectEvents, install };
